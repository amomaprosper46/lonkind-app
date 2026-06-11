'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Flame, Loader2, Copy, Check, RefreshCw, Share2, Download, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RoastResult {
  roastBio: string;
  roastTitle: string;
  savageryLevel: number;
  emoji: string;
}

interface ProfileRoastProps {
  user: {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    bio?: string;
    isProfessional?: boolean;
    followersCount?: number;
    followingCount?: number;
    badges?: string[];
  };
  postCount: number;
  isCurrentUser: boolean;
}

const ROAST_STYLES = [
  { key: 'savage' as const, label: '🔥 Savage', desc: 'No mercy' },
  { key: 'playful' as const, label: '😄 Playful', desc: 'Friendly teasing' },
  { key: 'wholesome-roast' as const, label: '💖 Wholesome', desc: 'Sweet burns' },
];

export default function ProfileRoast({ user, postCount, isCurrentUser }: ProfileRoastProps) {
  const [roast, setRoast] = useState<RoastResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<'savage' | 'playful' | 'wholesome-roast'>('playful');
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateRoast = async () => {
    setIsLoading(true);
    setRoast(null);
    try {
      const res = await fetch('/api/ai/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          handle: user.handle,
          bio: user.bio,
          postCount,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          isProfessional: user.isProfessional,
          badges: user.badges,
          style: selectedStyle,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate roast');
      }

      const data = await res.json();
      setRoast(data);
    } catch (error: any) {
      toast({
        title: 'Roast failed 😢',
        description: error.message || 'Even AI couldn\'t roast this one.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoast = () => {
    if (!roast) return;
    const text = `${roast.emoji} ${roast.roastBio}\n\n— AI Roast on Lonkind (@${user.handle})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Copied! 📋', description: 'Share it on Twitter or TikTok!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoast = async () => {
    if (!roast) return;
    const text = `${roast.emoji} ${roast.roastBio}\n\n— AI Roast on Lonkind (@${user.handle})`;
    if (navigator.share) {
      try {
        await navigator.share({ text, title: `🔥 AI Roast: @${user.handle}` });
      } catch {}
    } else {
      copyRoast();
    }
  };

  const savageryBar = (level: number) => {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Savagery</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-4 rounded-sm transition-all duration-300 ${
                i < level
                  ? level <= 3
                    ? 'bg-green-500'
                    : level <= 6
                    ? 'bg-yellow-500'
                    : level <= 8
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                  : 'bg-muted'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        <span className="text-xs font-bold">{level}/10</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Style selector + generate button */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex gap-2">
          {ROAST_STYLES.map((style) => (
            <button
              key={style.key}
              onClick={() => setSelectedStyle(style.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                selectedStyle === style.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
        <Button
          onClick={generateRoast}
          disabled={isLoading}
          className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cooking...
            </>
          ) : roast ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Roast Again
            </>
          ) : (
            <>
              <Flame className="mr-2 h-4 w-4" />
              {isCurrentUser ? 'Roast Me 🔥' : `Roast @${user.handle} 🔥`}
            </>
          )}
        </Button>
      </div>

      {/* Roast card */}
      {roast && (
        <div ref={cardRef} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="overflow-hidden border-2 border-orange-500/30 bg-gradient-to-br from-background via-background to-orange-500/5 shadow-xl">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 ring-2 ring-orange-500/50 ring-offset-2 ring-offset-background">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 text-lg">{roast.emoji}</span>
                </div>
                <div>
                  <p className="font-bold text-lg">{user.name}</p>
                  <p className="text-sm text-muted-foreground">@{user.handle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">AI ROAST</span>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-black mb-3 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
                {roast.roastTitle}
              </h3>

              {/* The roast bio */}
              <p className="text-lg leading-relaxed mb-4 font-medium">
                &ldquo;{roast.roastBio}&rdquo;
              </p>

              {/* Savagery bar */}
              <div className="mb-4">
                {savageryBar(roast.savageryLevel)}
              </div>

              {/* Branding watermark */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  🔥 Generated by <span className="font-semibold text-foreground">Lonkind AI</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyRoast}>
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={shareRoast}>
                    <Share2 className="h-3.5 w-3.5 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
