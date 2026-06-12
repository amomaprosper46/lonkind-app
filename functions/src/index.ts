import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { createHmac, timingSafeEqual } from "crypto";

// Lazy-initialize Firebase Admin to avoid deployment timeouts
let _db: any = null;
function getDb() {
  if (!_db) {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    _db = admin.firestore();
  }
  return _db!;
}

function getFieldValue() {
  const admin = require("firebase-admin");
  return admin.firestore.FieldValue;
}

// ── Idempotent coin crediting (safe to call multiple times) ──────
async function creditCoinsForPayment(
  reference: string,
  userId: string,
  coinAmount: number,
  amountNaira: number,
) {
  const db = getDb();
  const FieldValue = getFieldValue();
  const txRef = db.collection("transactions").doc(reference);

  await db.runTransaction(async (transaction: any) => {
    const existing = await transaction.get(txRef);

    // Already processed — Paystack retries webhooks, so this is expected
    if (existing.exists) {
      logger.info(`[Webhook] Reference ${reference} already processed — skipping`);
      return;
    }

    const userRef = db.collection("users").doc(userId);

    // Record the transaction
    transaction.set(txRef, {
      userId,
      paystackReference: reference,
      amountNaira,
      coinsAdded: coinAmount,
      status: "success",
      type: "coin_purchase",
      source: "webhook",
      time: FieldValue.serverTimestamp(),
    });

    // Credit coins to user
    transaction.update(userRef, {
      coins: FieldValue.increment(coinAmount),
    });
  });
}

// ── Handle transfer success/failure for payouts ──────────────────
async function handleTransferEvent(event: any) {
  const db = getDb();
  const FieldValue = getFieldValue();
  const transfer = event.data;
  const reference = transfer.reference as string;

  // Find the payout request matching this reference
  const payoutSnap = await db.collection("payoutRequests")
    .where("paystackReference", "==", reference)
    .limit(1)
    .get();

  if (payoutSnap.empty) return;

  const payoutRef = payoutSnap.docs[0].ref;
  const payoutData = payoutSnap.docs[0].data();

  if (event.event === "transfer.success") {
    await payoutRef.update({ status: "completed", paystackStatus: "success" });

    await db.collection("users").doc(payoutData.userId)
      .collection("notifications").add({
        type: "payout_completed",
        amountNaira: payoutData.amountNaira,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
  } else if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
    await db.runTransaction(async (transaction: any) => {
      transaction.update(payoutRef, { status: "failed", paystackStatus: transfer.status });

      const userRef = db.collection("users").doc(payoutData.userId);
      transaction.update(userRef, {
        earningsNaira: FieldValue.increment(payoutData.amountNaira),
        heldEarningsNaira: FieldValue.increment(-payoutData.amountNaira),
      });
    });

    await db.collection("users").doc(payoutData.userId)
      .collection("notifications").add({
        type: "payout_failed",
        amountNaira: payoutData.amountNaira,
        reason: transfer.reason || "Transfer failed",
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
  }
}

export const paystackWebhook = onRequest(async (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    logger.error("PAYSTACK_SECRET_KEY is not set.");
    res.status(500).send("Server configuration error.");
    return;
  }

  const signature = req.headers["x-paystack-signature"] as string;
  if (!signature) {
    logger.warn("[Webhook] Missing signature");
    res.status(401).send("Unauthorized");
    return;
  }

  const rawBody = req.rawBody.toString("utf8");

  const expectedHash = createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  let signatureValid = false;
  try {
    signatureValid = timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch (_e) {
    signatureValid = false;
  }

  if (!signatureValid) {
    logger.warn("[Webhook] Invalid Paystack signature — possible spoofing attempt");
    res.status(401).send("Invalid signature");
    return;
  }

  const event = req.body;
  logger.info(`[Webhook] Received event: ${event.event}`);

  try {
    if (event.event === "charge.success") {
      const { metadata, amount, reference } = event.data;
      const { userId, coinAmount } = metadata || {};

      if (userId && coinAmount && reference) {
        await creditCoinsForPayment(
          reference,
          userId,
          Number(coinAmount),
          amount / 100,
        );
        logger.info(`[Webhook] ✅ Credited ${coinAmount} coins to user ${userId}`);
      } else {
        logger.warn("[Webhook] charge.success missing metadata", metadata);
      }
    } else if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event.event)) {
      await handleTransferEvent(event);
      logger.info(`[Webhook] ✅ Handled ${event.event}`);
    } else {
      logger.info(`[Webhook] Unhandled event type: ${event.event}`);
    }
  } catch (error) {
    logger.error("[Webhook] Processing error:", error);
  }

  res.status(200).send("OK");
});
