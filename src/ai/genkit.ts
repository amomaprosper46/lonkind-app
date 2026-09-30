import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const plugins = [];

if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) {
  plugins.push(googleAI({ apiVersion: 'v1beta' }));
}

export const ai = genkit({
  plugins,
  model: "googleai/gemini-3.5-flash-lite", 
});