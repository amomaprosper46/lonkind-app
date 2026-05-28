'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-2xl bg-red-950/20 border border-red-900 rounded-xl p-8 space-y-4">
        <h2 className="text-2xl font-bold text-red-500">Application Error</h2>
        <p className="text-zinc-300">A client-side exception occurred.</p>
        
        <div className="bg-black/50 p-4 rounded-md overflow-x-auto text-sm text-red-400 font-mono whitespace-pre-wrap">
          {error.message || 'Unknown error message'}
          {'\n\n'}
          {error.stack || 'No stack trace available'}
        </div>

        <Button 
            onClick={() => reset()} 
            variant="destructive"
            className="mt-6"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
