"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const LoadingComponent = () => <div className="flex justify-center items-center py-4"><div className="loader" /></div>;
const FriendRequestCard = dynamic(() => import('@/components/social/FriendRequestCard').then(m => m.FriendRequestCard), { loading: () => <LoadingComponent />, ssr: false });

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '15' });
    if (cursor) params.append('cursor', cursor);
    const res = await fetch(`/api/friend-requests?${params.toString()}`);
    const data = await res.json();
    setRequests(prev => [...prev, ...(data.friendRequests || [])]);
    setNextCursor(data.nextCursor || null);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAccept = async (id: string) => {
    // Placeholder: remove from UI; real implementation would call an accept endpoint
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleDecline = async (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Friend Requests</h1>
      <div className="space-y-4">
        {requests.map(req => (
          <FriendRequestCard
            key={req.id}
            request={req}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </div>
      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button onClick={() => fetchRequests(nextCursor)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
