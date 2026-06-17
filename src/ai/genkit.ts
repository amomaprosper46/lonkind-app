import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai'; // 🚀 Fixed package import

const plugins = [];

// Ensure the plugin is pushed correctly if the API key exists
if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) {
  plugins.push(googleAI());
}

export const ai = genkit({
  plugins,
  model: 'googleai/gemini-1.5-flash', // Your default fallback is perfect here
});