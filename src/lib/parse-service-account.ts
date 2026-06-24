/**
 * Helper to safely parse the FIREBASE_ADMIN_SERVICE_ACCOUNT environment variable.
 * 
 * Some environments (like Next.js loaded from .env.local) may preserve the surrounding
 * single quotes in the environment variable. This strips them before calling JSON.parse.
 */
export function getFirebaseAdminServiceAccount() {
  let saStr = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || '';
  
  if (saStr.startsWith("'") && saStr.endsWith("'")) {
    saStr = saStr.slice(1, -1);
  } else if (saStr.startsWith('"') && saStr.endsWith('"')) {
    saStr = saStr.slice(1, -1);
  }

  if (!saStr) return null;

  try {
    const sa = JSON.parse(saStr);
    if (sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }
    return sa;
  } catch (error) {
    console.error("Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT. Make sure it is valid JSON.");
    throw error;
  }
}
