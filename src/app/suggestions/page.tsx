"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const LoadingComponent = () => <div className="flex justify-center items-center py-4"><div className="loader" /></div>;
const SuggestionCard = dynamic(() => import('@/components/social/SuggestionCard').then(m => m.SuggestionCard), { loading: () => <LoadingComponent />, ssr: false });

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '15' });
    if (cursor) params.append('cursor', cursor);
    const res = await fetch(`/api/suggestions?${params.toString()}`);
    const data = await res.json();
    setSuggestions(prev => [...prev, ...(data.suggestions || [])]);
    setNextCursor(data.nextCursor || null);
    setLoading(false);
  };

  useEffect(() => { fetchSuggestions(); }, []);

  const handleAddFriend = async (suggestion: any) => {
    await fetch('/api/friend-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid: suggestion.uid }),
    });
    // TODO: optimistic UI update
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">People You May Know</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suggestions.map(s => (
          <SuggestionCard
            key={s.uid}
            suggestion={s}
            onAddFriend={handleAddFriend}
            requestSent={false}
          />
        ))}
      </div>
      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button onClick={() => fetchSuggestions(nextCursor)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
