
import { config } from 'dotenv';
config();

// This file imports all Genkit flows and is used as the entry point
// for the 'protocol1940' CLI command.

import '@/ai/flows/generate-ideas.ts';
import '@/ai/flows/assistant.ts';
import '@/ai/flows/generate-story.ts';
import '@/ai/flows/news-reporter.ts';
import '@/ai/flows/add-dummy-friends.ts';
import '@/ai/flows/text-to-speech.ts';
import '@/ai/flows/personal-ai.ts';
import '@/ai/flows/submit-support-ticket.ts';
import '@/ai/flows/request-payout.ts';
import '@/ai/flows/search-posts.ts';
import '@/ai/flows/create-or-get-conversation.ts';
import '@/ai/flows/translate-text.ts';
import '@/ai/flows/get-localization-flow.ts';
import '@/ai/flows/generate-image.ts';
import '@/ai/flows/create-group.ts';
import '@/ai/flows/translate-image-text.ts';
import '@/ai/flows/animate-image.ts';
import '@/ai/flows/search-nearby-posts.ts';
import '@/ai/flows/remix-image.ts';
import '@/ai/flows/send-tip.ts';
import '@/ai/flows/purchase-coins.ts';
import '@/ai/flows/reset-admin-password.ts';
