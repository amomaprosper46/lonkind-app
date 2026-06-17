import React from "react"
import { cn } from "@/lib/utils"

/**
 * CORE COMPONENT: Skeleton
 * Low-level utility block to structure animated layout fallbacks.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/80", className)}
      {...props}
    />
  )
}

/**
 * PRESET COMPONENT: SkeletonFeedCard
 * Mimics a standard social timeline item or user profile snippet.
 */
export function SkeletonFeedCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl border bg-card p-6 space-y-4 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        {/* Mocking an Avatar Frame */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="space-y-2 w-full">
          {/* Mocking Display Identity String Name */}
          <Skeleton className="h-4 w-1/3" />
          {/* Mocking User Handle or Date Distance Tag */}
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        {/* Mocking Post Content Text Lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

/**
 * PRESET COMPONENT: SkeletonListItem
 * Mimics a row element inside settings view tabs or direct chat sub-drawers.
 */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between border p-4 rounded-2xl bg-card", className)}>
      <div className="flex items-center gap-4 w-full">
        {/* Mock Icon or Status Ring Block */}
        <Skeleton className="h-6 w-6 rounded-xl flex-shrink-0" />
        <div className="space-y-2 w-full">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {/* Mock Button, Switch, or Indicator Toggle Anchor */}
      <Skeleton className="h-8 w-20 rounded-xl flex-shrink-0" />
    </div>
  )
}

export { Skeleton }