'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function ShimmerBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('lonkind-shimmer rounded-md', className)}
      {...props}
    />
  );
}

/**
 * Matches exact card width, padding, avatar, text lines, and 16:9 media frame
 * of `PostCard` so there is ZERO Cumulative Layout Shift (CLS).
 */
export function FeedCardSkeleton({
  withMedia = true,
  className,
}: {
  withMedia?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3.5 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ShimmerBlock className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <ShimmerBlock className="h-3.5 w-32 rounded" />
            <ShimmerBlock className="h-2.5 w-24 rounded" />
          </div>
        </div>
        <ShimmerBlock className="h-7 w-7 rounded-full shrink-0" />
      </div>

      <div className="space-y-2">
        <ShimmerBlock className="h-3.5 w-full rounded" />
        <ShimmerBlock className="h-3.5 w-5/6 rounded" />
      </div>

      {withMedia && (
        <ShimmerBlock className="w-full aspect-[16/9] rounded-xl" />
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-7 w-16 rounded-lg" />
          <ShimmerBlock className="h-7 w-14 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-7 w-16 rounded-lg" />
          <ShimmerBlock className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Matches Live Streams Discovery grid (`aspect-[4/5]` live stream cards).
 */
export function LiveStreamGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-3.5', className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm"
        >
          <ShimmerBlock className="w-full aspect-[4/5] rounded-none" />
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShimmerBlock className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1 flex-1 min-w-0">
                <ShimmerBlock className="h-3 w-3/4 rounded" />
                <ShimmerBlock className="h-2.5 w-1/2 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Matches Profile cover banner, overlapping avatar, bio, and follower counters.
 */
export function ProfileHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm',
        className
      )}
    >
      <ShimmerBlock className="w-full h-36 sm:h-48 rounded-none" />
      <div className="px-5 pb-5 space-y-4">
        <div className="flex items-end justify-between -mt-12">
          <ShimmerBlock className="h-24 w-24 rounded-full border-4 border-card" />
          <div className="flex items-center gap-2 pb-1">
            <ShimmerBlock className="h-9 w-24 rounded-xl" />
            <ShimmerBlock className="h-9 w-24 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <ShimmerBlock className="h-5 w-44 rounded" />
          <ShimmerBlock className="h-3.5 w-28 rounded" />
          <ShimmerBlock className="h-3.5 w-full max-w-md rounded mt-2" />
        </div>
        <div className="flex items-center gap-6 pt-1">
          <ShimmerBlock className="h-4 w-20 rounded" />
          <ShimmerBlock className="h-4 w-20 rounded" />
          <ShimmerBlock className="h-4 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Matches Creator Wallet & Coin Store balances + package cards + transaction rows.
 */
export function WalletBalanceSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-5', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
          <ShimmerBlock className="h-3.5 w-28 rounded" />
          <ShimmerBlock className="h-8 w-40 rounded" />
          <ShimmerBlock className="h-9 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
          <ShimmerBlock className="h-3.5 w-32 rounded" />
          <ShimmerBlock className="h-8 w-40 rounded" />
          <ShimmerBlock className="h-9 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-border/70 bg-card p-4 space-y-2.5"
          >
            <ShimmerBlock className="h-4 w-20 rounded" />
            <ShimmerBlock className="h-6 w-24 rounded" />
            <ShimmerBlock className="h-8 w-full rounded-xl" />
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <SettingsRowSkeleton count={3} />
      </div>
    </div>
  );
}

/**
 * Matches Settings rows, Notification rows, and Admin Audit / Ledger rows.
 */
export function SettingsRowSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border/70 bg-card p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ShimmerBlock className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <ShimmerBlock className="h-3.5 w-1/3 rounded" />
              <ShimmerBlock className="h-3 w-2/3 rounded" />
            </div>
          </div>
          <ShimmerBlock className="h-8 w-16 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Matches `SponsoredAdCard` exact 16:9 media frame & CTA footer (zero CLS).
 */
export function AdCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm',
        className
      )}
    >
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShimmerBlock className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <ShimmerBlock className="h-3.5 w-28 rounded" />
            <ShimmerBlock className="h-2.5 w-20 rounded" />
          </div>
        </div>
        <ShimmerBlock className="h-6 w-20 rounded-full" />
      </div>
      <ShimmerBlock className="w-full aspect-[16/9] rounded-none" />
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <ShimmerBlock className="h-4 w-2/3 rounded" />
          <ShimmerBlock className="h-3 w-5/6 rounded" />
        </div>
        <ShimmerBlock className="h-9 w-24 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

/**
 * Standardized friendly empty state for 0 posts, 0 followers, 0 live streams, or 0 transactions.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center flex flex-col items-center justify-center gap-2.5',
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-sm sm:text-base font-extrabold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
