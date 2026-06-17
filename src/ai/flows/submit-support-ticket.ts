'use server';
/**
 * @fileOverview A secure Genkit flow for submitting a support ticket to Firestore.
 *
 * - submitSupportTicket - A function that saves a support ticket to the DB.
 * - SubmitSupportTicketInput - The input type for the function.
 * - SubmitSupportTicketOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK securely on the server if it hasn't been already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminDb = admin.firestore();

const SubmitSupportTicketInputSchema = z.object({
  name: z.string().min(2, 'Name is required').describe('The name of the user submitting the ticket.'),
  email: z.string().email('Invalid email address').describe('The email of the user submitting the ticket.'),
  subject: z.string().min(3, 'Subject is required').describe('The subject of the support ticket.'),
  message: z.string().min(10, 'Message must be at least 10 characters long').describe('The content of the support message.'),
});
export type SubmitSupportTicketInput = z.infer<typeof SubmitSupportTicketInputSchema>;

const SubmitSupportTicketOutputSchema = z.object({
  success: z.boolean(),
  confirmationMessage: z.string().describe('A confirmation or error message to the user.'),
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
  async ({ name, email, subject, message }) => {
    try {
      // Create a new document reference with an auto-generated ID inside 'tickets'
      const ticketRef = adminDb.collection('tickets').doc();

      // Write the payload directly to Firestore securely from the backend
      await ticketRef.set({
        ticketId: ticketRef.id,
        name,
        email,
        subject,
        message,
        status: 'open', // Default status for new tickets
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Support ticket ${ticketRef.id} successfully created for ${email}`);

      return {
        success: true,
        confirmationMessage: `Thank you, ${name}. Your support ticket regarding "${subject}" has been safely received (Ticket ID: ${ticketRef.id}). We will get back to you shortly.`,
      };

    } catch (error: any) {
      console.error('Failed to submit support ticket to Firestore:', error);
      
      return {
        success: false,
        confirmationMessage: 'Something went wrong on our end while submitting your ticket. Please try again later.',
      };
    }
  }
);