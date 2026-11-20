import { z } from 'zod';

export const GMAIL_ONLY_ERROR =
  'Please use a valid @gmail.com address. Temporary or non-Gmail emails are not allowed.';

export const GMAIL_ALIAS_ERROR =
  'Gmail "+" aliases (e.g., name+1@gmail.com) are not allowed. Please use your primary @gmail.com address.';

export type GmailValidationResult =
  | { valid: true; normalizedEmail: string; canonicalEmail: string }
  | { valid: false; error: string };

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_LOCAL_PART_REGEX = /^[a-z0-9](?:[a-z0-9.]*[a-z0-9])?$/;

/**
 * Strictly validates and normalizes a Google Gmail (@gmail.com) address.
 * - Normalizes via trim().toLowerCase()
 * - Rejects all non-gmail.com domains (including @googlemail.com, @yahoo.com,
 *   @outlook.com, custom domains, and all disposable/temp email domains)
 * - Rejects '+' sub-address aliases (e.g. username+1@gmail.com)
 * - Computes canonicalEmail by stripping dots from the local part
 *   (john.doe@gmail.com -> johndoe@gmail.com) for duplicate-account prevention
 */
export function validateStrictGmail(rawInput: string): GmailValidationResult {
  if (typeof rawInput !== 'string') {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  const normalizedEmail = rawInput.trim().toLowerCase();

  if (!normalizedEmail || !BASIC_EMAIL_REGEX.test(normalizedEmail)) {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  const parts = normalizedEmail.split('@');
  if (parts.length !== 2) {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  const [localPart, domain] = parts;

  // Strictly require @gmail.com only (blocks @googlemail.com, Yahoo, Outlook, custom & disposable domains)
  if (domain !== 'gmail.com') {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  // Block '+' aliases to prevent multi-account farming
  if (localPart.includes('+')) {
    return { valid: false, error: GMAIL_ALIAS_ERROR };
  }

  // Reject consecutive dots or invalid characters in Gmail local part
  if (
    localPart.includes('..') ||
    !GMAIL_LOCAL_PART_REGEX.test(localPart) ||
    localPart.length < 3 ||
    localPart.length > 64
  ) {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  // Canonical Gmail address strips dots from local part (john.doe@gmail.com -> johndoe@gmail.com)
  const canonicalLocalPart = localPart.replace(/\./g, '');
  if (canonicalLocalPart.length < 3) {
    return { valid: false, error: GMAIL_ONLY_ERROR };
  }

  const canonicalEmail = `${canonicalLocalPart}@gmail.com`;

  return {
    valid: true,
    normalizedEmail,
    canonicalEmail,
  };
}

/**
 * Zod schema for frontend Signup & Email-Change forms.
 */
export const strictGmailSchema = z.string().superRefine((val, ctx) => {
  const result = validateStrictGmail(val);
  if (!result.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error,
    });
  }
});
