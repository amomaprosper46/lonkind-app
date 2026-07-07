/**
 * Helper to safely parse the LONKIND_ADMIN_SERVICE_ACCOUNT environment variable.
 * 
 * Some environments (like Next.js loaded from .env.local) may preserve the surrounding
 * single quotes in the environment variable. This strips them before calling JSON.parse.
 */
export function getFirebaseAdminServiceAccount() {
  let saStr = process.env.LONKIND_ADMIN_SERVICE_ACCOUNT || '';
  
  if (!saStr) return null;

  try {
    // If it's a base64 encoded string, decode it first
    if (!saStr.trim().startsWith('{')) {
      const buffer = Buffer.from(saStr, 'base64');
      saStr = buffer.toString('utf-8');
    }

    const sa = JSON.parse(saStr);
    if (sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }
    if (!sa.project_id || !sa.private_key || !sa.client_email) {
      console.warn("Parsed Service Account is missing critical fields (project_id, private_key, or client_email).");
      return null;
    }
    return sa;
  } catch (error) {
    console.error("Failed to parse LONKIND_ADMIN_SERVICE_ACCOUNT. Make sure it is valid JSON.");
    throw error;
  }
}
