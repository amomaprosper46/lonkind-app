
'use server';
/**
 * @fileOverview A Genkit flow for submitting a support ticket.
 *
 * - submitSupportTicket - A function that handles the submission.
 * - SubmitSupportTicketInput - The input type for the function.
 * - SubmitSupportTicketOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SubmitSupportTicketInputSchema = z.object({
  name: z.string().describe('The name of the user submitting the ticket.'),
  email: z.string().describe('The email of the user submitting the ticket.'),
  subject: z.string().describe('The subject of the support ticket.'),
  message: z.string().describe('The content of the support message.'),
});
export type SubmitSupportTicketInput = z.infer<typeof SubmitSupportTicketInputSchema>;

const SubmitSupportTicketOutputSchema = z.object({
  confirmationMessage: z.string().describe('A confirmation message to the user.'),
});
export type SubmitSupportTicketOutput = z.infer<typeof SubmitSupportTicketOutputSchema>;

export async function submitSupportTicket(input: SubmitSupportTicketInput): Promise<SubmitSupportTicketOutput> {
  return submitSupportTicketFlow(input);
}

const submitSupportTicketFlow = ai.defineFlow(
  {
    name: 'submitSupportTicketFlow',
    inputSchema: SubmitSupportTicketInputSchema,
    outputSchema: SubmitSupportTicketOutputSchema,
  },
  async (input) => {
    // In a real application, this would integrate with a support system
    // like Zendesk, send an email, or save to a 'tickets' collection in Firestore.
    console.log('New Support Ticket Submitted:');
    console.log(`From: ${input.name} <${input.email}>`);
    console.log(`Subject: ${input.subject}`);
    console.log(`Message: ${input.message}`);

    return {
      confirmationMessage: `Thank you, ${input.name}. Your support ticket regarding "${input.subject}" has been received. We will get back to you shortly.`,
    };
  }
);
