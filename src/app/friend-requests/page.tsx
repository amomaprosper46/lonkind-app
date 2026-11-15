"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';

const LoadingComponent = () => <div className="flex justify-center items-center py-4"><div className="loader" /></div>;
const FriendRequestCard = dynamic(() => import('@/components/social/FriendRequestCard').then(m => m.FriendRequestCard), { loading: () => <LoadingComponent />, ssr: false });

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async (cursor?: string) => {
    setLoading(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const params = new URLSearchParams({ limit: '15' });
      if (cursor) params.append('cursor', cursor);
      const res = await fetch(`/api/friend-requests?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setRequests(prev => [...prev, ...(data.friendRequests || [])]);
      setNextCursor(data.nextCursor || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAccept = async (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleDecline = async (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Friend Requests</h1>
      <div className="space-y-4">
        {requests.map((req, idx) => (
          <FriendRequestCard
            key={req.id || req.uid || idx}
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
