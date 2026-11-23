'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Wallet, Sparkles, Loader2, Megaphone } from 'lucide-react';
import AdminPanelView from '@/components/social/admin-panel-view';
import AdminModerationDashboard from '@/components/social/admin-moderation-dashboard';
import AdminEventsAndGiftsStudio from '@/components/social/admin-events-and-gifts-studio';
import { AdminAdManager } from '@/components/social/admin-ad-manager';
import type { CurrentUser } from '@/components/social/social-dashboard';

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        setCurrentUser({ uid, ...(snap.data() as any) } as CurrentUser);
      }
    });
    return () => unsub();
  }, []);

  if (!currentUser) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="ads" className="space-y-6">
      <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 h-auto gap-1 rounded-xl p-1">
        <TabsTrigger value="ads" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
          <Megaphone className="h-4 w-4" />
          Ad Manager
        </TabsTrigger>
        <TabsTrigger value="payouts" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
          <Wallet className="h-4 w-4" />
          Payout Approvals
        </TabsTrigger>
        <TabsTrigger value="moderation" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
          <ShieldCheck className="h-4 w-4" />
          Moderation
        </TabsTrigger>
        <TabsTrigger value="events" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
          <Sparkles className="h-4 w-4" />
          Events &amp; Gifts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ads">
        <AdminAdManager />
      </TabsContent>

      <TabsContent value="payouts">
        <AdminPanelView currentUser={currentUser} />
      </TabsContent>

      <TabsContent value="moderation">
        <AdminModerationDashboard />
      </TabsContent>

      <TabsContent value="events">
        <AdminEventsAndGiftsStudio />
      </TabsContent>
    </Tabs>
  );
}
