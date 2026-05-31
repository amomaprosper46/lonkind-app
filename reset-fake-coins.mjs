import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin using the service account from .env.local
// Initialize Firebase Admin using default credentials (from firebase CLI or gcloud)
initializeApp({
  projectId: 'impactful-ideas'
});

const db = getFirestore();

async function resetFakeCoins() {
  console.log("Starting script to reset fake coins...");
  
  // Step 1: Find all users who have coins > 0
  const usersSnapshot = await db.collection('users').where('coins', '>', 0).get();
  console.log(`Found ${usersSnapshot.docs.length} users with a coin balance > 0.`);
  
  let resetCount = 0;
  let preservedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // Step 2: Check if they have ANY real transactions from Paystack
    const realTransactions = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('source', '==', 'webhook') // Real payments come from the webhook
      .limit(1)
      .get();
      
    if (realTransactions.empty) {
      // User has no real transactions, meaning they got coins from the simulation. Reset to 0.
      console.log(`[RESET] User ${userId} (${userData.name}) has ${userData.coins} fake coins. Resetting to 0.`);
      await userDoc.ref.update({
        coins: 0
      });
      resetCount++;
    } else {
      // User has a real Paystack transaction! Preserve their coins.
      console.log(`[PRESERVED] User ${userId} (${userData.name}) has real Paystack transactions. Preserving their ${userData.coins} coins.`);
      preservedCount++;
    }
  }
  
  console.log("\n--- SCRIPT COMPLETE ---");
  console.log(`Users Reset to 0 Coins: ${resetCount}`);
  console.log(`Users Preserved (Real Buyers): ${preservedCount}`);
}

resetFakeCoins().catch(console.error);
