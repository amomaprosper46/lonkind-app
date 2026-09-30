'use client';

import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="bg-card dark:bg-slate-900/60 rounded-2xl p-4 shadow-sm border border-border/50 w-full mb-4 animate-pulse">
      {/* Header Profile Row */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Main Content Lines */}
      <div className="space-y-2 mb-4">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
        </div>
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-2/3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Main Media/Content Box */}
      <div className="w-full h-52 bg-slate-200 dark:bg-slate-800 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
