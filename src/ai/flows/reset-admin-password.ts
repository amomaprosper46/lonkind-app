'use server';
/**
 * @fileOverview A Genkit flow for resetting the admin password.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

function getAdminApp() {
    if (!admin.apps.length) {
        try {
            const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
                ? JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
                : undefined;
                
            if (sa) {
                admin.initializeApp({
                    credential: admin.credential.cert(sa),
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                });
            } else {
                admin.initializeApp({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                });
            }
        } catch (error) {
            console.error('Failed to initialize Firebase Admin in resetAdminPassword:', error);
        }
    }
    return admin.apps[0];
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
    getAdminApp();
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
