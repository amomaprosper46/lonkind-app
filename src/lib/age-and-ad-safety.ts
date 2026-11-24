/**
 * Strict 18+ Platform Age Usage Rules & Prohibited Ad Content Safety Validator.
 * Zero React hooks — safe to import in both Server API Routes and Client Components.
 */

export const MINIMUM_PLATFORM_AGE = 18;
export const RESTRICTED_AD_AGE = 21;

export type AdTargetAudience = '18+' | '21+';

export function calculateAgeFromDob(dobIso: string): number | null {
  if (!dobIso || typeof dobIso !== 'string') return null;
  const match = dobIso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dob = new Date(year, month - 1, day);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function validateAdultDob(
  dobIso: string
): { valid: true; age: number; isAdult: true } | { valid: false; error: string } {
  const age = calculateAgeFromDob(dobIso);
  if (age === null || age < 0 || age > 120) {
    return { valid: false, error: 'Please enter a valid Date of Birth.' };
  }
  if (age < MINIMUM_PLATFORM_AGE) {
    return {
      valid: false,
      error: 'Lonkind is an 18+ platform. You must be at least 18 years old to register.',
    };
  }
  return { valid: true, age, isAdult: true };
}

/**
 * Prohibited ad categories:
 * - Scams / Ponzi / guaranteed financial returns
 * - Adult / explicit / escort services
 * - Unverified medical / miracle cure claims
 */
const PROHIBITED_AD_RULES: { category: string; patterns: RegExp[] }[] = [
  {
    category: 'scams or misleading financial promises',
    patterns: [
      /\bdouble\s+your\s+(money|crypto|bitcoin|btc|usdt|cash)\b/i,
      /\bguaranteed\s+(profit|returns?|income|roi)\b/i,
      /\bget\s+rich\s+quick\b/i,
      /\b(ponzi|pyramid\s+scheme|risk[-\s]?free\s+investment|100%\s+profit)\b/i,
      /\bfree\s+(money|btc|bitcoin|usdt|crypto)\s+giveaway\b/i,
      /\bsend\s+\d+\s*(btc|eth|usdt)\s+get\b/i,
    ],
  },
  {
    category: 'adult or sexually explicit content',
    patterns: [
      /\b(porn|xxx|escort\s+service|onlyfans\s+leaks|nude\s+cams?|sex\s+hookup|explicit\s+videos?)\b/i,
    ],
  },
  {
    category: 'unverified medical or miracle cure claims',
    patterns: [
      /\b(miracle\s+cure|cures?\s+(cancer|hiv|aids|diabetes)|instant\s+weight\s+loss\s+pill|100%\s+guaranteed\s+cure)\b/i,
    ],
  },
];

export function validateAdContentSafety(
  title: string,
  description: string,
  destinationUrl: string
): { safe: true } | { safe: false; reason: string } {
  const combined = `${title || ''} ${description || ''} ${destinationUrl || ''}`;
  for (const rule of PROHIBITED_AD_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(combined)) {
        return {
          safe: false,
          reason: `This ad was blocked by Lonkind Content Safety because it appears to promote ${rule.category}.`,
        };
      }
    }
  }
  return { safe: true };
}
