"use server"; // 👈 This line completely blocks Next.js from bundling this file into the browser client!

import * as admin from 'firebase-admin';
import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { gemini15Flash } from '@genkit-ai/google-genai';

interface SerperNewsArticle {
  title: string;
  snippet: string;
}

/**
 * CORE HELPER: News Aggregator Fetcher
 * Hits a low-cost/free search API to grab live contextual news updates.
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
        gl: 'ng', // Focuses search results on Nigerian/West African ecosystems
        num: 3    // Keeps the input payload tight and cheap
      }), 
    });
    
    const data = await response.json() as { news?: SerperNewsArticle[] };
    
    if (!data.news || data.news.length === 0) {
      console.warn('Serper API returned zero news entries.');
      return '';
    }

    return data.news.map((n) => `${n.title}: ${n.snippet}`).join('\n');
  } catch (error: any) {
    console.error('Failed to fetch web news context:', error.message);
    return '';
  }
}

/**
 * GENKIT FLOW: Autonomous News Reporter
 * Takes zero inputs, aggregates data itself, and posts directly to the timeline database.
 */
export const autonomousNewsReporter = ai.defineFlow(
  {
    name: 'autonomousNewsReporter',
  },
  async () => {
    // A. Gather raw live tech data from the web
    const newsContext = await fetchLatestNews('tech startup innovation investment Nigeria');
    
    // B. Pass context to Gemini 1.5 Flash using production naming syntax
    const llmResponse = await ai.generate({
      model: gemini15Flash,
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

    // C. Write directly to Firestore under a fixed system profile token identifier
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
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
      comments: 0,
    });

    return { success: true, postId: newPostRef.id };
  }
);