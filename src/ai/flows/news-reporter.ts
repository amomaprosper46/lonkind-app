"use server";

import * as admin from 'firebase-admin';
import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';

interface SerperNewsArticle {
  title: string;
  snippet: string;
  link?: string;
  source?: string;
  imageUrl?: string;
}

const FALLBACK_NEWS_IMAGES = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
];

/**
 * CORE HELPER: News Aggregator Fetcher
 * Hits Google Serper News API to grab live contextual news updates with real images.
 */
async function fetchLatestNews(query: string): Promise<SerperNewsArticle[]> {
  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '7220135593825b130e1fbfe599249dcb51dfd839',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        q: query, 
        gl: 'ng', // Focus on Nigerian & African innovation & tech ecosystem
        num: 6
      }), 
    });
    
    const data = await response.json() as { news?: SerperNewsArticle[] };
    return data.news || [];
  } catch (error: any) {
    console.error('Failed to fetch web news context:', error.message);
    return [];
  }
}

/**
 * GENKIT FLOW: Autonomous News Reporter
 * Aggregates live news, selects top article with picture, crafts engaging post, and publishes to timeline.
 */
export const autonomousNewsReporter = ai.defineFlow(
  {
    name: 'autonomousNewsReporter',
  },
  async () => {
    // A. Gather raw live tech data from the web
    const articles = await fetchLatestNews('tech startup innovation investment Nigeria Africa');
    
    // Pick the most relevant article with a valid image first, or top article
    let chosenArticle: SerperNewsArticle | null = null;
    if (articles.length > 0) {
      chosenArticle = articles.find(a => a.imageUrl && a.imageUrl.startsWith('http')) || articles[0];
    }

    const newsContext = chosenArticle
      ? `Title: ${chosenArticle.title}\nSummary: ${chosenArticle.snippet}\nSource: ${chosenArticle.source || 'Tech News'}`
      : 'Recent breakthrough tech innovations, startup funding, and digital economy growth across Africa.';

    // B. Pass context to Gemini for professional news presentation
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-3.5-flash-lite',
      prompt: `
        You are Lonkind's official AI News Anchor (@lonkindnews).
        Your voice is smart, analytical, and engaging for social media readers.
        
        Using this news story:
        ${newsContext}
        
        Write an eye-catching news post for Lonkind timeline.
        Strict Guidelines:
        - Include an emoji headline at the start (e.g. "🚨 TECH BREAKING:" or "💡 INNOVATION WATCH:").
        - Write 2 concise, punchy paragraphs explaining what happened and why it matters.
        - Do not use hashtags.
        - End with: "📌 Source: ${chosenArticle?.source || 'Lonkind Newsroom'}"
      `,
    });

    const postContent = llmResponse.text;

    if (!postContent) {
      throw new Error('Gemini failed to yield text output content.');
    }

    // Determine final image URL
    const finalImageUrl = chosenArticle?.imageUrl || 
      FALLBACK_NEWS_IMAGES[Math.floor(Math.random() * FALLBACK_NEWS_IMAGES.length)];

    // C. Write directly to Firestore with image attachment
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
        badges: ['Top Creator'],
      },
      isAutomated: true,
      groupId: null, // REQUIRED: Visible on home feed and explore timeline
      imageUrl: finalImageUrl,
      mediaUrl: finalImageUrl,
      mediaType: 'image',
      link: chosenArticle?.link || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
      comments: 0,
    });

    // D. Optional Twilio / SMS Notification Broadcast
    let twilioBroadcastResult = null;
    try {
      const { broadcastTwilioNewsAlert } = await import('@/lib/twilio');

      const subscribersSnap = await db.collection('users')
        .where('newsSubscribed', '==', true)
        .limit(50)
        .get();

      const phoneNumbers: string[] = [];
      subscribersSnap.forEach(doc => {
        const phone = doc.data().phoneNumber || doc.data().phone;
        if (phone) phoneNumbers.push(phone);
      });

      if (phoneNumbers.length > 0) {
        twilioBroadcastResult = await broadcastTwilioNewsAlert(
          phoneNumbers,
          'Tech Breaking Update',
          postContent.trim(),
          'sms'
        );
      }

      await db.collection('twilio_bot_logs').add({
        botName: 'Auto News Reporter Bot',
        action: 'news_post_and_broadcast',
        postId: newPostRef.id,
        content: postContent.trim(),
        imageUrl: finalImageUrl,
        recipientsCount: phoneNumbers.length,
        broadcastSummary: twilioBroadcastResult,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (broadcastErr: any) {
      console.warn('News broadcast notice:', broadcastErr?.message);
    }

    return { 
      success: true, 
      postId: newPostRef.id,
      postContent: postContent.trim(),
      imageUrl: finalImageUrl,
      articleTitle: chosenArticle?.title || null,
      twilioBroadcast: twilioBroadcastResult 
    };
  }
);