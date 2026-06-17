import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide select-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: 
          "border-border bg-background text-foreground hover:bg-muted/30",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium",
        warning:
          "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium",
        info:
          "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Optional boolean to inject keyboard accessibility hooks 
   * if the badge is used as an interactive button link.
   */
  isClickable?: boolean;
}

function Badge({ className, variant, isClickable = false, ...props }: BadgeProps) {
  return (
    <div 
      className={cn(
        badgeVariants({ variant }), 
        isClickable && "cursor-pointer active:scale-95 hover:opacity-90",
        className
      )}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? "button" : undefined}
      {...props}
    />
  )
}

export { Badge, badgeVariants }