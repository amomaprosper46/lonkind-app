"use server";

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const ModeratorInputSchema = z.object({
  targetType: z.enum(['post', 'comment', 'message', 'user', 'livestream']),
  targetId: z.string(),
  reportReason: z.string(),
  reportDescription: z.string().optional(),
  targetContentSnippet: z.string().optional(),
  targetAuthorHandle: z.string().optional(),
  uniqueReportCount: z.number(),
  weightedReportScore: z.number(),
});

export type ModeratorInput = z.infer<typeof ModeratorInputSchema>;

export const ModeratorOutputSchema = z.object({
  confidenceScore: z.number().min(0).max(100),
  recommendedAction: z.enum(['ignore', 'warn', 'hide_content', 'restrict_account', 'escalate']),
  explanation: z.string(),
  isObviouslyFakeOrDuplicate: z.boolean(),
});

export type ModeratorOutput = z.infer<typeof ModeratorOutputSchema>;

/**
 * LONKIND MODERATOR AI ENGINE
 * Powered by Google Gemini 2.5 Flash.
 * Analyzes reported content and user behavior to generate scalable, automated moderation decisions.
 */
export const lonkindModeratorAiFlow = ai.defineFlow(
  {
    name: 'lonkindModeratorAiFlow',
    inputSchema: ModeratorInputSchema,
    outputSchema: ModeratorOutputSchema,
  },
  async (input) => {
    try {
      const promptText = `
You are Lonkind Moderator AI, the chief automated trust and safety engine for the Lonkind social platform.
Your job is to analyze community reports and recommend fair, scalable safety actions without requiring manual human intervention for clear cases.

REPORT DETAILS:
- Target Type: ${input.targetType}
- Target ID: ${input.targetId}
- Reported Reason: ${input.reportReason}
- Reporter Additional Description: ${input.reportDescription || 'None provided'}
- Content Preview / Snippet: "${input.targetContentSnippet || 'No content preview available'}"
- Author Handle: @${input.targetAuthorHandle || 'unknown'}
- Unique Report Count: ${input.uniqueReportCount}
- Weighted Trust Score: ${input.weightedReportScore}

STRICT MODERATION RULES:
1. NEVER recommend permanent bans ('ban_user' is NOT an automated option). For severe threats, child safety, illegal fraud, or hate speech, choose 'escalate'.
2. If the report appears obviously fake, automated spam reporting, or completely contradicts innocent content, set isObviouslyFakeOrDuplicate to true and recommend 'ignore' with a low confidence score.
3. If the weightedReportScore is >= 5 on content (post/comment) and the content violates rules (spam, harassment, nudity, scams), recommend 'hide_content' with high confidence.
4. If the weightedReportScore is >= 10 on a user/account and there is consistent abuse, recommend 'restrict_account'.
5. If only 1 or 2 users reported minor issues without clear evidence, recommend 'ignore' or 'warn'.
6. If confidence is between 40 and 60, recommend 'escalate' for human review.

Respond ONLY in valid JSON matching the schema:
{
  "confidenceScore": number (0 to 100),
  "recommendedAction": "ignore" | "warn" | "hide_content" | "restrict_account" | "escalate",
  "explanation": "concise 1-2 sentence explanation of why this decision was reached",
  "isObviouslyFakeOrDuplicate": boolean
}
      `;

      const response = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: promptText,
        output: {
          schema: ModeratorOutputSchema,
        },
      });

      if (response.output) {
        return response.output;
      }

      // Fallback if structured output parsing fails
      const text = response.text || '';
      try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          confidenceScore: Number(parsed.confidenceScore) || 50,
          recommendedAction: (parsed.recommendedAction as any) || 'escalate',
          explanation: parsed.explanation || 'AI analysis completed with heuristic parsing.',
          isObviouslyFakeOrDuplicate: Boolean(parsed.isObviouslyFakeOrDuplicate),
        };
      } catch (e) {
        return {
          confidenceScore: 50,
          recommendedAction: 'escalate',
          explanation: 'AI evaluation returned non-structured text; defaulting to human escalation.',
          isObviouslyFakeOrDuplicate: false,
        };
      }
    } catch (error: any) {
      console.error('Lonkind Moderator AI execution error:', error);
      // Fail open to safe escalation or ignore for single reports
      return {
        confidenceScore: input.weightedReportScore >= 5 ? 85 : 30,
        recommendedAction: input.weightedReportScore >= 10 ? 'restrict_account' : input.weightedReportScore >= 5 ? 'hide_content' : 'ignore',
        explanation: `Fallback heuristic rule applied due to AI service timeout: ${error?.message || 'unknown error'}`,
        isObviouslyFakeOrDuplicate: false,
      };
    }
  }
);
