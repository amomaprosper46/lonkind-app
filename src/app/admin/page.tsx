'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Wallet, Sparkles, Megaphone, Lock } from 'lucide-react';
import { SettingsRowSkeleton, AdCardSkeleton } from '@/components/ui/skeletons';
import type { CurrentUser } from '@/components/social/social-dashboard';

// Route-level code splitting: lazy-load all heavy Admin modules with zero-CLS skeletons
const AdminPanelView = dynamic(() => import('@/components/social/admin-panel-view'), {
  ssr: false,
  loading: () => <SettingsRowSkeleton count={4} />,
});
const AdminModerationDashboard = dynamic(
  () => import('@/components/social/admin-moderation-dashboard'),
  { ssr: false, loading: () => <SettingsRowSkeleton count={4} /> }
);
const AdminEventsAndGiftsStudio = dynamic(
  () => import('@/components/social/admin-events-and-gifts-studio'),
  { ssr: false, loading: () => <SettingsRowSkeleton count={4} /> }
);
const AdminAdManager = dynamic(
  () => import('@/components/social/admin-ad-manager').then((m) => m.AdminAdManager),
  { ssr: false, loading: () => <AdCardSkeleton /> }
);
const AdminSecurityShield = dynamic(
  () => import('@/components/social/admin-security-shield').then((m) => m.AdminSecurityShield),
  { ssr: false, loading: () => <SettingsRowSkeleton count={2} /> }
);
const AdminDatabaseBackups = dynamic(
  () => import('@/components/social/admin-database-backups').then((m) => m.AdminDatabaseBackups),
  { ssr: false, loading: () => <SettingsRowSkeleton count={3} /> }
);
const AdminOtpFailoverMonitor = dynamic(
  () => import('@/components/social/admin-otp-failover-monitor').then((m) => m.AdminOtpFailoverMonitor),
  { ssr: false, loading: () => <SettingsRowSkeleton count={3} /> }
);

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
      <div className="space-y-4">
        <SettingsRowSkeleton count={1} />
        <AdCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminSecurityShield />
      <Tabs defaultValue="ads" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-2 sm:grid-cols-5 h-auto gap-1 rounded-xl p-1">
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
          <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm font-semibold py-2">
            <Lock className="h-4 w-4 text-emerald-500" />
            Security &amp; System
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

        <TabsContent value="security" className="space-y-6">
          <AdminOtpFailoverMonitor />
          <AdminDatabaseBackups />
          <AdminSecurityShield showAuditTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
