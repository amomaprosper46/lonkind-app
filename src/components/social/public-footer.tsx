import React from 'react';
import Link from 'next/link';
import { Globe, Mail } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/20 mt-auto">
      <div className="container max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Lonkind Technologies (CAC, Nigeria)
          </span>
          <span className="hidden sm:inline">•</span>
          <span>© 2026 Lonkind Technologies. All rights reserved.</span>
        </div>

        <nav
          aria-label="Legal and Support"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-medium"
        >
          <Link href="/about" className="hover:text-primary transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>
          <Link href="/refund-policy" className="hover:text-primary transition-colors">
            Coins &amp; Refund Policy
          </Link>
          <Link href="/contact" className="hover:text-primary transition-colors">
            Help &amp; Support
          </Link>
          <a
            href="mailto:support@lonkind.com"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Mail className="h-3 w-3" />
            support@lonkind.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
