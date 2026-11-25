'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Wallet } from 'lucide-react';
import { useSettingsContext } from '../settings-context';
import { WalletBalanceSkeleton } from '@/components/ui/skeletons';

const WalletView = dynamic(() => import('@/components/social/wallet-view'), {
  ssr: false,
  loading: () => <WalletBalanceSkeleton />,
});

export default function SettingsWalletPage() {
  const { currentUser } = useSettingsContext();
  if (!currentUser) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-amber-950/25 to-slate-900/95 p-5 shadow-md">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
          Billing &amp; Finance
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 mt-0.5">
          <Wallet className="h-5 w-5 text-amber-400" />
          Creator Wallet &amp; Transactions
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your Coin balance, Diamond earnings, top-ups, and withdrawal history connected directly to Firestore.
        </p>
      </div>

      <WalletView currentUser={currentUser} />
    </div>
  );
}
