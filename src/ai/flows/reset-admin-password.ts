'use server';
/**
 * @fileOverview Secure administrative account initialization and credential mutation utility.
 * Enforces cryptographic master signature checks to prevent unauthorized parameter overwrites.
 */

import { z } from 'genkit';
import { adminAuth } from '@/lib/firebase-admin';

const ResetAdminPasswordInputSchema = z.object({
  masterSecretToken: z.string().describe('Cryptographic emergency bypass verification token.'),
  newSecurePassword: z.string().min(12, 'Password must be at least 12 characters.').describe('The new secure replacement string.'),
});
export type ResetAdminPasswordInput = z.infer<typeof ResetAdminPasswordInputSchema>;

interface ResetAdminPasswordOutput {
  success: z.infer<typeof z.boolean>;
  message: string;
}

/**
 * Administrative Credential Reset Utility
 * Strictly locked behind a server-side environment secret token verification step.
 */
export async function resetAdminPassword(input: ResetAdminPasswordInput): Promise<ResetAdminPasswordOutput> {
  
  const adminEmail = 'admin@lonkind.com';
  const serverSystemSecret = process.env.INTERNAL_SYSTEM_RESET_SECRET;

  try {
    // 1. Structural Guard: Abort if the system secret variable is missing or empty
    if (!serverSystemSecret || serverSystemSecret.length < 32) {
      console.error('CRITICAL: INTERNAL_SYSTEM_RESET_SECRET is misconfigured or lacks cryptographic entropy.');
      return { success: false, message: 'Authentication subsystem configuration failure.' };
    }

    // 2. Authorization Guard: Validate that the caller knows the master environment key
    if (input.masterSecretToken !== serverSystemSecret) {
      console.warn('UNAUTHORIZED ACCESS ATTEMPT: Invalid master secret key supplied during admin account reset loop.');
      return { success: false, message: 'Access Denied. Unauthorized operations signature block.' };
    }

    // 3. Locate and update the target administrative record securely
    const userRecord = await adminAuth.getUserByEmail(adminEmail);
    
    await adminAuth.updateUser(userRecord.uid, {
      password: input.newSecurePassword,
    });

    console.log(`NOTICE: Administrative access privileges successfully reset for target document container: ${adminEmail}`);

    return {
      success: true,
      message: `The credentials for ${adminEmail} have been successfully updated. Secure your master passphrase assets immediately.`,
    };

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: 'Administrative record profile could not be matched inside identity engines.' };
    }
    
    console.error('Internal Identity Platform manipulation failure:', error);
    return { success: false, message: 'System processing exception error.' };
  }
}