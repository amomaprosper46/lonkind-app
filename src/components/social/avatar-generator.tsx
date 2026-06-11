'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Copy, Check, Share2, Sparkles, Palette, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AvatarResult {
  avatarDescription: string;
  avatarTitle: string;
  colorPalette: string[];
  shareCaption: string;
}

interface AvatarGeneratorProps {
  user: {
    name: string;
    handle: string;
    bio?: string;
  };
}

const ART_STYLES = [
  { key: 'anime' as const, label: '🎌 Anime', color: 'from-pink-500 to-purple-500' },
  { key: 'cyberpunk' as const, label: '🤖 Cyberpunk', color: 'from-cyan-500 to-blue-600' },
  { key: 'cartoon' as const, label: '🎨 Cartoon', color: 'from-yellow-400 to-orange-500' },
  { key: 'pixel-art' as const, label: '👾 Pixel Art', color: 'from-green-400 to-emerald-600' },
  { key: 'watercolor' as const, label: '🖌️ Watercolor', color: 'from-sky-300 to-indigo-400' },
  { key: 'fantasy' as const, label: '🧙 Fantasy', color: 'from-violet-500 to-fuchsia-500' },
  { key: 'minimalist' as const, label: '⬜ Minimalist', color: 'from-gray-400 to-gray-600' },
  { key: 'afrofuturism' as const, label: '✨ Afrofuturism', color: 'from-amber-500 to-yellow-600' },
];

const MOODS = [
  { key: 'cool' as const, label: '😎 Cool' },
  { key: 'fierce' as const, label: '🔥 Fierce' },
  { key: 'chill' as const, label: '😌 Chill' },
  { key: 'mysterious' as const, label: '🌙 Mysterious' },
  { key: 'happy' as const, label: '😄 Happy' },
  { key: 'boss' as const, label: '👑 Boss' },
];

export default function AvatarGenerator({ user }: AvatarGeneratorProps) {
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<typeof ART_STYLES[number]['key']>('anime');
  const [selectedMood, setSelectedMood] = useState<typeof MOODS[number]['key']>('cool');
  const [copied, setCopied] = useState(false);

  const generateAvatar = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          handle: user.handle,
          bio: user.bio,
          style: selectedStyle,
          mood: selectedMood,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate avatar');
      }

      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      toast({
        title: 'Generation failed',
        description: error.message || 'Try again!',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCaption = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${result.shareCaption}\n\n— Made with Lonkind AI ✨`);
    setCopied(true);
    toast({ title: 'Caption copied! 📋' });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareResult = async () => {
    if (!result) return;
    const text = `${result.shareCaption}\n\n🎨 ${result.avatarTitle} — Made with Lonkind AI ✨`;
    if (navigator.share) {
      try {
        await navigator.share({ text, title: `${result.avatarTitle} — Lonkind AI Avatar` });
      } catch {}
    } else {
      copyCaption();
    }
  };

  const currentStyleInfo = ART_STYLES.find(s => s.key === selectedStyle)!;

  return (
    <div className="space-y-6">
      {/* Style selector */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4" /> Choose Art Style
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ART_STYLES.map((style) => (
            <button
              key={style.key}
              onClick={() => setSelectedStyle(style.key)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                selectedStyle === style.key
                  ? `bg-gradient-to-r ${style.color} text-white border-transparent shadow-lg scale-105`
                  : 'bg-background text-muted-foreground border-border hover:bg-muted hover:scale-[1.02]'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mood selector */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Choose Mood
        </h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood.key}
              onClick={() => setSelectedMood(mood.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                selectedMood === mood.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {mood.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={generateAvatar}
        disabled={isLoading}
        className={`w-full bg-gradient-to-r ${currentStyleInfo.color} hover:opacity-90 text-white font-bold shadow-lg hover:shadow-xl transition-all py-6 text-base`}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Creating your avatar...
          </>
        ) : result ? (
          <>
            <RefreshCw className="mr-2 h-5 w-5" />
            Generate Another
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Generate AI Avatar ✨
          </>
        )}
      </Button>

      {/* Result card */}
      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="overflow-hidden border-2 shadow-xl" style={{
            borderColor: result.colorPalette[0] ? `${result.colorPalette[0]}50` : undefined,
          }}>
            <CardContent className="p-0">
              {/* Color palette header */}
              <div className="flex h-3">
                {result.colorPalette.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="p-6">
                {/* Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full border" style={{
                    backgroundColor: `${result.colorPalette[0]}15`,
                    borderColor: `${result.colorPalette[0]}30`,
                  }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: result.colorPalette[0] }} />
                    <span className="text-xs font-semibold" style={{ color: result.colorPalette[0] }}>AI AVATAR</span>
                  </div>
                  <span className="text-xs text-muted-foreground">for @{user.handle}</span>
                </div>

                <h3 className="text-2xl font-black mb-3" style={{
                  background: `linear-gradient(135deg, ${result.colorPalette.join(', ')})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {result.avatarTitle}
                </h3>

                {/* Description */}
                <p className="text-base leading-relaxed mb-4 text-foreground/90">
                  {result.avatarDescription}
                </p>

                {/* Color palette display */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-muted-foreground font-medium">Color palette:</span>
                  <div className="flex gap-1.5">
                    {result.colorPalette.map((color, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div
                          className="w-6 h-6 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-muted-foreground font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm italic text-muted-foreground">&ldquo;{result.shareCaption}&rdquo;</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    ✨ Generated by <span className="font-semibold text-foreground">Lonkind AI</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyCaption}>
                      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={shareResult}>
                      <Share2 className="h-3.5 w-3.5 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
