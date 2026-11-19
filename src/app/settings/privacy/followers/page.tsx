'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import FollowerPrivacyManager from '@/components/social/follower-privacy-manager';

export default function NestedFollowerPrivacyPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-cyan-950/25 to-slate-900/95 p-5 shadow-md">
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
          Privacy &amp; Safety • Follower Management
        </p>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 mt-0.5">
          <Shield className="h-5 w-5 text-cyan-400" />
          Follower Requests &amp; Privacy
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Control Private Account approval, confirm or decline pending requests, silently remove followers, and manage blocked accounts.
        </p>
      </div>

      <FollowerPrivacyManager initialTab="PENDING" />
    </div>
  );
}
