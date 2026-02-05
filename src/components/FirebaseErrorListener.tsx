'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/lib/error-emitter';

/**
 * A client-side component that listens for 'permission-error' events
 * and throws them. This allows the Next.js development overlay to catch
 * and display the detailed error information.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: Error) => {
      // Throw the error so Next.js can catch it in development
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component does not render anything
}
