import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      admin.initializeApp({ projectId: 'impactful-ideas' });
    }
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
  }
}

export async function GET() {
  try {
    const db = getFirestore();
    const usersSnapshot = await db.collection('users').where('coins', '>', 0).get();
    
    let resetCount = 0;
    let preservedCount = 0;
    let results = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      const realTransactions = await db.collection('transactions')
        .where('userId', '==', userId)
        .where('source', '==', 'webhook')
        .limit(1)
        .get();
        
      if (realTransactions.empty) {
        await userDoc.ref.update({ coins: 0 });
        results.push(`[RESET] User ${userId} (${userData.name}) - Reset to 0.`);
        resetCount++;
      } else {
        results.push(`[PRESERVED] User ${userId} (${userData.name}) - Kept ${userData.coins} coins.`);
        preservedCount++;
      }
    }

    return NextResponse.json({
      message: 'Script complete',
      resetCount,
      preservedCount,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
