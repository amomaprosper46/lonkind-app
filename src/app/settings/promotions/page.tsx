'use client';

import React from 'react';
import { useSettingsContext } from '../settings-context';
import { MyPromotionsView } from '@/components/social/my-promotions-view';
import { AdCardSkeleton } from '@/components/ui/skeletons';

export default function SettingsPromotionsPage() {
  const { currentUser } = useSettingsContext();
  if (!currentUser) {
    return (
      <div className="space-y-4">
        <AdCardSkeleton />
        <AdCardSkeleton />
      </div>
    );
  }
  return <MyPromotionsView currentUser={currentUser} />;
}
