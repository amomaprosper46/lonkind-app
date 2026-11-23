'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');
  const [adminHandle, setAdminHandle] = useState<string>('mow');

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      if (!firebaseUser) {
        setStatus('unauthorized');
        router.replace('/');
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken(true);
        const res = await fetch('/api/admin/verify', {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        });

        if (cancelled) return;

        if (!res.ok) {
          setStatus('unauthorized');
          router.replace('/');
          return;
        }

        const data = await res.json().catch(() => null);
        if (!data?.authorized || data?.role !== 'super_admin') {
          setStatus('unauthorized');
          router.replace('/');
          return;
        }

        setAdminHandle(data.handle || 'mow');
        setStatus('authorized');
      } catch {
        if (!cancelled) {
          setStatus('unauthorized');
          router.replace('/');
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [router]);

  if (status !== 'authorized') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          {status === 'checking'
            ? 'Verifying Super-Admin credentials...'
            : 'Redirecting to home feed...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base truncate">
                  Lonkind Admin Console
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
                  SUPER ADMIN (@{adminHandle})
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Server-verified super_admin access control
              </p>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Feed
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 container max-w-6xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
