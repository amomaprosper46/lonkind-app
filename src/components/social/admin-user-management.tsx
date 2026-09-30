'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, orderBy, limit, startAt, endAt } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, Ban, UserX, UserCheck, Shield, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface UserData {
  uid: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl?: string;
  isBanned?: boolean;
  bannedReason?: string;
  isRestricted?: boolean;
  restrictionReason?: string;
  isProfessional?: boolean;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch some recent users by default
  useEffect(() => {
    fetchRecentUsers();
  }, []);

  const fetchRecentUsers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), limit(20));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserData)));
    } catch (error) {
      console.error("Error fetching users", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load users.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchRecentUsers();
      return;
    }
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('handle'),
        startAt(searchQuery.toLowerCase()),
        endAt(searchQuery.toLowerCase() + '\uf8ff'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserData)));
    } catch (error) {
      console.error("Search error", error);
      toast({ variant: 'destructive', title: 'Search Failed', description: 'Could not search users.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (userId: string, action: 'ban' | 'restrict' | 'unban' | 'verify') => {
    setProcessingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      if (action === 'ban') {
        await updateDoc(userRef, { isBanned: true, bannedReason: 'Admin Manual Ban', updatedAt: serverTimestamp() });
        toast({ title: 'User Banned' });
      } else if (action === 'unban') {
        await updateDoc(userRef, { isBanned: false, bannedReason: null, isRestricted: false, restrictionReason: null, updatedAt: serverTimestamp() });
        toast({ title: 'User Restored' });
      } else if (action === 'restrict') {
        const expires = new Date();
        expires.setHours(expires.getHours() + 168);
        await updateDoc(userRef, { isRestricted: true, restrictionReason: 'Admin Manual Restriction', restrictionExpiresAt: expires, updatedAt: serverTimestamp() });
        toast({ title: 'User Restricted (7 Days)' });
      } else if (action === 'verify') {
        await updateDoc(userRef, { isProfessional: true, updatedAt: serverTimestamp() });
        toast({ title: 'User Verified', description: 'Verification badge granted.' });
      }
      
      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          if (action === 'ban') return { ...u, isBanned: true };
          if (action === 'unban') return { ...u, isBanned: false, isRestricted: false };
          if (action === 'restrict') return { ...u, isRestricted: true };
          if (action === 'verify') return { ...u, isProfessional: true };
        }
        return u;
      }));
    } catch (error) {
      console.error("Action error", error);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not apply action to user.' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by handle..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>
      </div>

      <div className="space-y-3">
        {users.length === 0 && !isLoading && (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            <UserX className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No users found.</p>
          </Card>
        )}
        
        {users.map(user => (
          <Card key={user.uid} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-border/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{user.name}</span>
                  {user.isProfessional && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {user.isBanned && <Badge variant="destructive" className="text-[10px]">BANNED</Badge>}
                  {user.isRestricted && <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">RESTRICTED</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">@{user.handle} &middot; {user.email}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">UID: {user.uid}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!user.isProfessional && (
                <Button size="sm" variant="outline" onClick={() => handleAction(user.uid, 'verify')} disabled={processingId === user.uid} className="h-8 text-xs">
                  <Shield className="h-3.5 w-3.5 mr-1" /> Verify
                </Button>
              )}
              {user.isBanned || user.isRestricted ? (
                <Button size="sm" variant="outline" onClick={() => handleAction(user.uid, 'unban')} disabled={processingId === user.uid} className="h-8 text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10">
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Restore
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleAction(user.uid, 'restrict')} disabled={processingId === user.uid} className="h-8 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10">
                    <UserX className="h-3.5 w-3.5 mr-1" /> Restrict
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAction(user.uid, 'ban')} disabled={processingId === user.uid} className="h-8 text-xs">
                    <Ban className="h-3.5 w-3.5 mr-1" /> Ban
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
