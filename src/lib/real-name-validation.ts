import { z } from 'zod';

export const MIN_NAME_PART_LEN = 2;
export const MAX_FULL_NAME_LEN = 50;

const BLOCKED_WORDS = new Set([
  // Placeholders & fake names
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'support',
  'official',
  'system',
  'test',
  'testing',
  'tester',
  'user',
  'username',
  'anonymous',
  'anon',
  'fake',
  'fakes',
  'asdf',
  'asdfg',
  'qwerty',
  'zxcv',
  'zxcvb',
  'unknown',
  'guest',
  'nobody',
  'none',
  'null',
  'undefined',
  'demo',
  'sample',
  'example',
  'bot',
  'spam',
  'spammer',
  'scam',
  'scammer',
  'lonkind',
  // Common profanity / slurs
  'fuck',
  'fucker',
  'fucking',
  'shit',
  'shitty',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'cunt',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'porn',
  'xxx',
]);

export interface RealNameValidationResult {
  valid: boolean;
  formattedName: string;
  error?: string;
}

/**
 * Normalizes whitespace and formats clean Title Case capitalization,
 * respecting hyphens ("mary-anne" -> "Mary-Anne") and apostrophes ("o'connor" -> "O'Connor").
 */
export function formatRealFullName(rawInput: string): string {
  const collapsed = String(rawInput || '')
    .normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'") // normalize curly apostrophes to straight
    .trim()
    .replace(/\s+/g, ' ');

  if (!collapsed) return '';

  return collapsed
    .split(' ')
    .map((word) =>
      word
        .split(/([-'])/)
        .map((segment) => {
          if (segment === '-' || segment === "'") return segment;
          if (!segment) return '';
          const chars = Array.from(segment);
          return chars[0]!.toLocaleUpperCase() + chars.slice(1).join('').toLocaleLowerCase();
        })
        .join('')
    )
    .join(' ');
}

/**
 * Strictly validates a real full name (First Name + Last Name) for signup on both frontend & backend.
 */
export function validateRealFullName(rawInput: string): RealNameValidationResult {
  const normalized = String(rawInput || '')
    .normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return {
      valid: false,
      formattedName: '',
      error: 'Please enter your First Name and Last Name.',
    };
  }

  if (normalized.length > MAX_FULL_NAME_LEN) {
    return {
      valid: false,
      formattedName: '',
      error: `Full name must be ${MAX_FULL_NAME_LEN} characters or fewer.`,
    };
  }

  // Reject URLs or domain-like strings
  if (/(www\.|https?:\/\/|\.(com|net|org|io|co|xyz|app|gg|me)\b)/i.test(normalized)) {
    return {
      valid: false,
      formattedName: '',
      error: 'Names cannot contain website links or URLs.',
    };
  }

  // Reject numbers explicitly with a clear message
  if (/\d/.test(normalized)) {
    return {
      valid: false,
      formattedName: '',
      error: 'Numbers are not allowed in your full name.',
    };
  }

  // Allow ONLY Unicode letters (including international accented letters), spaces, hyphens, and apostrophes
  if (!/^[\p{L}\s'-]+$/u.test(normalized)) {
    return {
      valid: false,
      formattedName: '',
      error: 'Use letters only (spaces, hyphens, and apostrophes are allowed — no emojis or symbols).',
    };
  }

  // Reject excessive repeated characters (e.g., "Aaaa", "Xxxx", "Jjjohn")
  if (/(\p{L})\1{2,}/iu.test(normalized)) {
    return {
      valid: false,
      formattedName: '',
      error: 'Please enter a realistic name without excessive repeated letters.',
    };
  }

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) {
    return {
      valid: false,
      formattedName: '',
      error: 'Please enter both your First Name and Last Name separated by a space.',
    };
  }

  for (const part of parts) {
    // Reject leading/trailing/consecutive punctuation like "-John", "Doe'", "A--B"
    if (/^[-']|[-']$|[-']{2,}/.test(part)) {
      return {
        valid: false,
        formattedName: '',
        error: 'Hyphens and apostrophes must appear between letters (e.g., Mary-Anne or O\'Connor).',
      };
    }

    const lettersOnly = part.replace(/[-']/g, '');
    if (Array.from(lettersOnly).length < MIN_NAME_PART_LEN) {
      return {
        valid: false,
        formattedName: '',
        error: 'Each part of your name (First and Last) must be at least 2 letters.',
      };
    }

    const lowerClean = lettersOnly.toLowerCase();
    if (BLOCKED_WORDS.has(lowerClean)) {
      return {
        valid: false,
        formattedName: '',
        error: 'Please use your real name instead of a placeholder or restricted word.',
      };
    }
  }

  // Also block full-string keyboard mash or restricted phrases
  const fullLowerNoSpace = normalized.replace(/[\s'-]/g, '').toLowerCase();
  if (BLOCKED_WORDS.has(fullLowerNoSpace)) {
    return {
      valid: false,
      formattedName: '',
      error: 'Please use your real full name to register on Lonkind.',
    };
  }

  return {
    valid: true,
    formattedName: formatRealFullName(normalized),
  };
}

/**
 * Reusable Zod schema for Full Name inputs in forms and backend APIs.
 */
export const realFullNameSchema = z
  .string()
  .superRefine((val, ctx) => {
    const res = validateRealFullName(val);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || 'Please enter a valid First and Last Name.',
      });
    }
  })
  .transform((val) => formatRealFullName(val));
