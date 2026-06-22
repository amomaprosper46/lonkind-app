import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

const plugins = [];

if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) {
  plugins.push(googleAI());
}

export const ai = genkit({
  plugins,
  model: "googleai/gemini-2.0-flash", 
});