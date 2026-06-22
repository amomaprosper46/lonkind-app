import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { createHmac, timingSafeEqual } from "crypto";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// 1. Core Firebase Initialization (Unified for all features)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// 2. Initialize Production Genkit Instance
const ai = genkit({
  plugins: [googleAI({ apiVersion: 'v1beta' })],
});

// ==========================================
// 🧠 FEATURE A: AUTONOMOUS NEWS REPORTER FLOW
// ==========================================

interface SerperNewsArticle {
  title: string;
  snippet: string;
}

/**
 * Helper: Hits a low-cost search API to grab live contextual news updates.
 */
async function fetchLatestNews(query: string): Promise<string> {
  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        q: query, 
        gl: 'ng', // Target the Nigerian tech ecosystem
        num: 3    
      }), 
    });
    
    const data = await response.json() as { news?: SerperNewsArticle[] };
    
    if (!data.news || data.news.length === 0) {
      logger.warn('Serper API returned zero news entries.');
      return '';
    }

    return data.news.map((n) => `${n.title}: ${n.snippet}`).join('\n');
  } catch (error: any) {
    logger.error('Failed to fetch web news context:', error.message);
    return '';
  }
}

/**
 * Genkit Production Automation Pipeline Flow
 */
export const autonomousNewsReporter = ai.defineFlow(
  {
    name: 'autonomousNewsReporter',
  },
  async () => {
    const newsContext = await fetchLatestNews('tech startup innovation investment Nigeria');
    
    // B. Call Gemini using production naming syntax
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `
        You are Lonkind's automated news reporter anchor. Your voice is smart, analytical, and highly engaging.
        ${newsContext ? `Using the following raw recent news data snippets, extract the single most impactful story and write a concise, powerful social media post for our application timeline.` : `Write a concise, powerful social media post about recent tech innovations or startups for our application timeline based on your knowledge.`}
        
        Strict Guidelines:
        - Do not use hashtags under any circumstances.
        - Keep the content punchy, direct, and under 280 characters.
        - Focus purely on genuine factual data; do not introduce editorial bias.
        
        ${newsContext ? `Raw News Data:\n${newsContext}` : ''}
      `,
    });

    const postContent = llmResponse.text;

    if (!postContent) {
      throw new Error('Gemini failed to yield text output content.');
    }

    const SYSTEM_BOT_UID = 'system-news-reporter';
    const newPostRef = db.collection('posts').doc();

    await newPostRef.set({
      content: postContent.trim(),
      author: {
        uid: SYSTEM_BOT_UID,
        name: 'Lonkind News Bot',
        handle: 'lonkindnews',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=lonkindnews',
        isProfessional: true,
      },
      isAutomated: true,
      timestamp: FieldValue.serverTimestamp(),
      reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
      comments: 0,
    });

    return { success: true, postId: newPostRef.id };
  }
);

/**
 * Automated Trigger Instance (6-Hour Heartbeat Cadence)
 */
export const scheduledNewsReporter = onSchedule(
  {
    schedule: "0 */6 * * *", 
    timeZone: "Africa/Lagos", 
    secrets: ["GEMINI_API_KEY", "SERPER_API_KEY"], 
    memory: "512MiB",
    timeoutSeconds: 120, 
  },
  async () => {
    logger.info("⏰ Heartbeat triggered: Executing autonomous news reporter worker...");
    try {
      const result = await autonomousNewsReporter();
      logger.info(`✅ Success! Posted update to timeline. Firestore Post ID: ${result.postId}`);
    } catch (error: any) {
      logger.error("❌ Scheduled function run crashed:", error.message);
    }
  }
);

// ==========================================
// 💳 FEATURE B: PAYSTACK WEBHOOK CONTROLLER
// ==========================================

async function creditCoinsForPayment(
  reference: string,
  userId: string,
  coinAmount: number,
  amountNaira: number,
) {
  const txRef = db.collection("transactions").doc(reference);
  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(txRef);

    if (existing.exists) {
      logger.info(`[Webhook] Reference ${reference} already processed — skipping`);
      return;
    }

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

    transaction.update(userRef, {
      coins: FieldValue.increment(coinAmount),
    });
  });
}

async function handleTransferEvent(event: any) {
  const transfer = event.data;
  const reference = transfer.reference as string;

  const payoutSnap = await db.collection("payoutRequests")
    .where("paystackReference", "==", reference)
    .limit(1)
    .get();

  if (payoutSnap.empty) return;

  const payoutDoc = payoutSnap.docs[0];
  const payoutRef = payoutDoc.ref;
  const payoutData = payoutDoc.data();

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
    await db.runTransaction(async (transaction) => {
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

export const paystackWebhook = onRequest(
  { 
    secrets: ["PAYSTACK_SECRET_KEY"] 
  }, 
  async (req, res) => {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      logger.error("PAYSTACK_SECRET_KEY is not configured in environment secrets.");
      res.status(500).send("Server configuration error.");
      return;
    }

    const signature = req.headers["x-paystack-signature"] as string;
    if (!signature) {
      logger.warn("[Webhook] Missing x-paystack-signature header");
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
      logger.warn("[Webhook] Invalid Paystack signature signature mismatch — block attempt");
      res.status(401).send("Invalid signature");
      return;
    }

    const event = req.body;
    logger.info(`[Webhook] Processing valid event branch: ${event.event}`);

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
          logger.info(`[Webhook] ✅ Successfully processed charge reference: ${reference}`);
        } else {
          logger.warn("[Webhook] charge.success schema payload missing properties", metadata);
        }
      } else if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event.event)) {
        await handleTransferEvent(event);
        logger.info(`[Webhook] ✅ Handled transfer ledger update: ${event.event}`);
      } else {
        logger.info(`[Webhook] Event signature verified but type unhandled: ${event.event}`);
      }
    } catch (error) {
      logger.error("[Webhook] Execution crash inside event switch statement block:", error);
    }

    res.status(200).send("OK");
  }
);