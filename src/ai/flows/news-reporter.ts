"use server";

import * as admin from 'firebase-admin';
import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';

interface RawNewsStory {
  title: string;
  snippet: string;
  link: string;
  source: string;
  date?: string;
  imageUrl?: string;
}

interface NewsAttribution {
  publisher: string;
  originalTitle: string;
  sourceUrl: string;
  publishedDate: string;
  license: string;
}

interface VideoBroadcastScript {
  hook: string;
  narration: string;
  visualCues: string[];
  anchorSignoff: string;
}

/**
 * High-quality, verified license-safe editorial photography library.
 * Fully permitted for commercial and editorial digital publication.
 */
const LICENSED_EDITORIAL_VISUALS: Record<string, string[]> = {
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
  ],
  fintech: [
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop&q=80',
  ],
  energy: [
    'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=1200&auto=format&fit=crop&q=80',
  ],
  startups: [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
  ]
};

/**
 * STEP 1: Discover a story via Serper News Search
 */
async function discoverLatestStories(query: string): Promise<RawNewsStory[]> {
  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '7220135593825b130e1fbfe599249dcb51dfd839',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        q: query, 
        gl: 'ng',
        num: 6 
      }), 
    });
    
    const data = await response.json() as { news?: RawNewsStory[] };
    return data.news || [];
  } catch (error: any) {
    console.error('[Step 1 Discover Error]:', error.message);
    return [];
  }
}

/**
 * STEP 4: Select appropriate visual matching the news theme with safe licensing
 */
function selectAppropriateVisual(title: string, snippet: string): { url: string; license: string } {
  const combinedText = `${title} ${snippet}`.toLowerCase();

  let category = 'default';
  if (combinedText.includes('ai') || combinedText.includes('intelligence') || combinedText.includes('robot') || combinedText.includes('model') || combinedText.includes('data')) {
    category = 'ai';
  } else if (combinedText.includes('fintech') || combinedText.includes('bank') || combinedText.includes('payment') || combinedText.includes('invest') || combinedText.includes('fund') || combinedText.includes('naira') || combinedText.includes('dollar')) {
    category = 'fintech';
  } else if (combinedText.includes('solar') || combinedText.includes('energy') || combinedText.includes('grid') || combinedText.includes('climate') || combinedText.includes('green')) {
    category = 'energy';
  } else if (combinedText.includes('startup') || combinedText.includes('founder') || combinedText.includes('hub') || combinedText.includes('entrepreneur')) {
    category = 'startups';
  }

  const pool = LICENSED_EDITORIAL_VISUALS[category] || LICENSED_EDITORIAL_VISUALS.default;
  const selectedUrl = pool[Math.floor(Math.random() * pool.length)];

  return {
    url: selectedUrl,
    license: 'Permitted Editorial Media (Unsplash Free Commercial & Editorial License)'
  };
}

/**
 * GENKIT FLOW: Autonomous News Reporter
 * Implements the 6-step journalistic workflow:
 * 1. Discover a story
 * 2. Identify the source
 * 3. Write an original summary
 * 4. Select appropriate visuals
 * 5. Create videos (narration & presentation script)
 * 6. Attribute the original reporting
 */
export const autonomousNewsReporter = ai.defineFlow(
  {
    name: 'autonomousNewsReporter',
  },
  async () => {
    // =========================================================================
    // STEP 1: Discover a story using Serper
    // =========================================================================
    const discoveredStories = await discoverLatestStories('technology startup innovation digital economy Nigeria Africa');
    
    if (!discoveredStories || discoveredStories.length === 0) {
      throw new Error('No news stories discovered from search gateway.');
    }

    // Pick top story with valid metadata
    const selectedStory = discoveredStories.find(s => s.title && s.link && s.source) || discoveredStories[0];

    // =========================================================================
    // STEP 2: Identify the source
    // =========================================================================
    const attribution: NewsAttribution = {
      publisher: selectedStory.source || 'Original Publisher',
      originalTitle: selectedStory.title,
      sourceUrl: selectedStory.link,
      publishedDate: selectedStory.date || 'Recent',
      license: 'Journalistic Attribution under Fair Reporting Standards'
    };

    // =========================================================================
    // STEP 3: Write an original summary (Gemini)
    // Avoids verbatim copy-paste; produces independently worded analysis.
    // =========================================================================
    const summaryPrompt = `
      You are Lonkind's official Chief Technology Reporter (@lonkindnews).
      
      Review the factual details from this discovered story:
      - Title: "${selectedStory.title}"
      - Publisher: "${attribution.publisher}"
      - Date: "${attribution.publishedDate}"
      - Key Facts: "${selectedStory.snippet}"

      TASK:
      Write an original, independently crafted journalistic news post for the Lonkind feed.
      
      CRITICAL EDITORIAL GUIDELINES:
      - DO NOT simply copy-paste or synonym-swap the original text.
      - Synthesize the verified facts into Lonkind's distinctive, authoritative voice.
      - Structure:
        1. Eye-catching headline with emoji (e.g. "🚨 TECH DISPATCH: ...")
        2. First paragraph: Clearly explain the core milestone or event in original words.
        3. Second paragraph: Provide independent analytical context on what this means for founders, creators, or the digital economy.
        4. Attribution line at the end: "📰 Original Reporting: ${attribution.publisher}"
      - Under no circumstances use hashtags (#).
      - Maintain strict factual neutrality and journalistic integrity.
    `;

    const summaryResponse = await ai.generate({
      model: 'googleai/gemini-3.5-flash-lite',
      prompt: summaryPrompt,
    });

    const postContent = summaryResponse.text?.trim();
    if (!postContent) {
      throw new Error('Gemini failed to generate original journalistic summary.');
    }

    // =========================================================================
    // STEP 4: Select appropriate visuals
    // Uses verified license-safe media; never blindly assumes search thumbnails are free to use.
    // =========================================================================
    const visual = selectAppropriateVisual(selectedStory.title, selectedStory.snippet);

    // =========================================================================
    // STEP 5: Create videos (Broadcast narration & presentation script)
    // Prepares video script, hook, on-screen cues, and anchor delivery.
    // =========================================================================
    const videoScriptPrompt = `
      You are a broadcast television producer for Lonkind News Video Channel.
      Based on this story:
      "${selectedStory.title}" - ${selectedStory.snippet}
      Publisher: ${attribution.publisher}

      Create a 30-45 second broadcast news video script.
      Return valid JSON with:
      {
        "hook": "Strong 5-second opening hook for the anchor",
        "narration": "Full 30-40 second broadcast narration script suitable for text-to-speech voiceover",
        "visualCues": ["Cue 1: e.g. [On-screen: headline banner]", "Cue 2: [Cut to AI graphic]", "Cue 3: [Chart/Milestone graphic]"],
        "anchorSignoff": "Quick 3-second sign-off, e.g. 'Reporting for Lonkind News. Stay connected for daily tech updates.'"
      }
      Return ONLY raw JSON.
    `;

    let videoScript: VideoBroadcastScript = {
      hook: `Breaking update: ${selectedStory.title}`,
      narration: postContent,
      visualCues: ['[On-Screen: Headline Graphic]', '[B-Roll: Digital Economy Context]'],
      anchorSignoff: 'Reporting for Lonkind News. Stay tuned for further developments.'
    };

    try {
      const scriptResponse = await ai.generate({
        model: 'googleai/gemini-3.5-flash-lite',
        prompt: videoScriptPrompt,
      });

      const scriptJsonText = scriptResponse.text?.replace(/```json|```/g, '').trim();
      if (scriptJsonText) {
        const parsed = JSON.parse(scriptJsonText);
        if (parsed.hook && parsed.narration) {
          videoScript = parsed;
        }
      }
    } catch (scriptErr: any) {
      console.warn('[Step 5 Video Script Warning]:', scriptErr.message);
    }

    // =========================================================================
    // STEP 6: Attribute the original reporting & Publish to Firestore
    // =========================================================================
    const SYSTEM_BOT_UID = 'system-news-reporter';
    const newPostRef = db.collection('posts').doc();

    const postPayload = {
      content: postContent,
      author: {
        uid: SYSTEM_BOT_UID,
        name: 'Lonkind News Bot',
        handle: 'lonkindnews',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=lonkindnews',
        isProfessional: true,
        badges: ['Top Creator'],
      },
      isAutomated: true,
      groupId: null,
      imageUrl: visual.url,
      mediaUrl: visual.url,
      mediaType: 'image',
      link: attribution.sourceUrl,
      attribution: {
        publisher: attribution.publisher,
        originalTitle: attribution.originalTitle,
        sourceUrl: attribution.sourceUrl,
        publishedDate: attribution.publishedDate,
        license: visual.license,
      },
      videoScript: {
        hook: videoScript.hook,
        narration: videoScript.narration,
        visualCues: videoScript.visualCues || [],
        anchorSignoff: videoScript.anchorSignoff,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      reactions: { like: 0, love: 0, laugh: 0, sad: 0 },
      comments: 0,
    };

    await newPostRef.set(postPayload);

    // Systematic Twilio Auto Messaging Broadcast (if subscribers exist)
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
          postContent,
          'sms'
        );
      }

      await db.collection('twilio_bot_logs').add({
        botName: 'Auto News Reporter Bot',
        action: 'news_post_and_broadcast',
        postId: newPostRef.id,
        content: postContent,
        attribution,
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
      postContent,
      attribution,
      visual,
      videoScript,
      twilioBroadcast: twilioBroadcastResult 
    };
  }
);