"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-2xl border p-4 shadow-sm transition-all duration-200 [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-destructive/30 bg-destructive/[0.02] text-destructive dark:border-destructive/40 [&>svg]:text-destructive",
        success:
          "border-emerald-500/30 bg-emerald-500/[0.02] text-emerald-600 dark:text-emerald-400 [&>svg]:text-emerald-500",
        warning:
          "border-amber-500/30 bg-amber-500/[0.02] text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500",
        info:
          "border-blue-500/30 bg-blue-500/[0.02] text-blue-600 dark:text-blue-400 [&>svg]:text-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement, // FIXED: Corrected ref target mapping matching h5 tags
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold tracking-tight text-sm sm:text-base leading-none", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLDivElement, // FIXED: Description renders a div, ref should accept HTMLDivElement
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs sm:text-sm text-muted-foreground/90 font-medium leading-relaxed [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }