'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sliders, ShieldCheck, FileCheck2 } from 'lucide-react';
import { AppPermissionsManager } from '@/components/social/app-permissions-manager';
import { useSettingsContext } from '../settings-context';

export default function AppPermissionsSettingsPage() {
  const { currentUser } = useSettingsContext();

  if (!currentUser) return null;

  const legalConsent = (currentUser as any)?.legalConsent as
    | {
        consentVersion?: string;
        agreedAt?: string;
        termsAndPrivacyAccepted?: boolean;
        ageVerified?: boolean;
        realNameAndGuidelinesAccepted?: boolean;
      }
    | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-violet-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              App Permissions Manager
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Control contextual device &amp; feature permissions layer by layer. Permissions are only
            requested when you enable them.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-500/40 text-emerald-400 gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Layered Permissions Active
        </Badge>
      </div>

      <AppPermissionsManager uid={currentUser.uid} mode="settings" />

      {legalConsent?.agreedAt && (
        <Card className="border-border/60 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-500" />
              Verified Layer 1 Legal Consent Record
            </CardTitle>
            <CardDescription className="text-xs">
              Timestamped agreement stored on your Lonkind profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-semibold text-foreground">Consent Version:</span>{' '}
              {legalConsent.consentVersion || '2026-11-v1'}
            </div>
            <div>
              <span className="font-semibold text-foreground">Agreed At:</span>{' '}
              {new Date(legalConsent.agreedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
