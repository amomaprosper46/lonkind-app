'use server';
/**
 * @fileOverview A Genkit flow for resetting the admin password.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ResetAdminPasswordOutputSchema = z.object({
  message: z.string(),
});
export type ResetAdminPasswordOutput = z.infer<typeof ResetAdminPasswordOutputSchema>;

export async function resetAdminPassword(): Promise<ResetAdminPasswordOutput> {
  return resetAdminPasswordFlow();
}

const resetAdminPasswordFlow = ai.defineFlow(
  {
    name: 'resetAdminPasswordFlow',
    inputSchema: z.void(),
    outputSchema: ResetAdminPasswordOutputSchema,
  },
  async () => {
    const adminEmail = 'admin@lonkind.com';
    const defaultPassword = 'password123';

    try {
      const userRecord = await admin.auth().getUserByEmail(adminEmail);
      await admin.auth().updateUser(userRecord.uid, {
        password: defaultPassword,
      });

      return {
        message: `The password for ${adminEmail} has been reset to '${defaultPassword}'. Please try logging in again.`,
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return { message: 'Admin user not found. It may not have been created yet.' };
      }
      console.error('Error resetting admin password:', error);
      throw new Error('Failed to reset admin password.');
    }
  }
);
