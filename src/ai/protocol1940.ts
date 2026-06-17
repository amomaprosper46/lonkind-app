import { config } from 'dotenv';
config();

/**
 * @fileOverview Core Genkit Flow Registry & Subsystem Entry Point.
 * Centralizes system configurations and triggers sequential runtime initialization hooks
 * for premium AI actions, social discovery indices, and billing transaction flows.
 */

// --- Premium AI Command Center Elements ---
import '@/ai/flows/generate-ideas';
import '@/ai/flows/generate-story';
import '@/ai/flows/news-reporter';      // Monetized (2 Coins)
import '@/ai/flows/translate-image-text'; // Monetized (3 Coins)
import '@/ai/flows/assistant';
import '@/ai/flows/personal-ai';         // Secure platform assistant ("Lonki")

// --- Global Utilities & Localization Systems ---
import '@/ai/flows/translate-text';       // Free user content translation
import '@/ai/flows/get-localization-flow'; // Free frontend UI localization

// --- Financial Ledgers & Transaction Pipelines ---
import '@/ai/flows/purchase-coins';       // Paystack international checkout
import '@/ai/flows/send-tip';             // Atomic server-side coin gifting transaction
import '@/ai/flows/request-payout';       // Creator Diamond liquidation matrix with 24h locks

// --- Feeds, Search, & Discovery Graph Matrices ---
import '@/ai/flows/search-posts';          // Tokenized keyword search
import '@/ai/flows/search-nearby-posts';   // High-precision geohash radial neighborhood discovery

// --- Group, Messaging, & Operational Pipelines ---
import '@/ai/flows/create-or-get-conversation';
import '@/ai/flows/create-group';
import '@/ai/flows/create-video-post';
import '@/ai/flows/submit-support-ticket';

// --- Diagnostic & Administrative Script Engines ---
import '@/ai/flows/add-dummy-followers';
import '@/ai/flows/reset-admin-password';  // Shielded backdoor credential initialization master utility

console.log('🚀 Lonkind Genkit Subsystem Core: All system flows registered successfully.');