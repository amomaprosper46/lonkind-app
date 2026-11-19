'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, where, documentId, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark, Search, X, Image as ImageIcon, FileText, Layers } from 'lucide-react';
import PostCard, { type Post } from '@/components/social/post-card';
import CommentSheet from '@/components/social/comment-sheet';
import { useSettingsContext } from '../settings-context';

export default function SettingsSavedPostsPage() {
  const {
    currentUser,
    savedPostIds,
    userReactions,
    onToggleSavePost,
    onReactPost,
    onDeletePost,
    onSubmitComment,
  } = useSettingsContext();

  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'media' | 'text'>('all');
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    const postIds = Array.from(savedPostIds);
    if (postIds.length === 0) {
      setSavedPosts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const idBatches: string[][] = [];
    for (let i = 0; i < postIds.length; i += 30) {
      idBatches.push(postIds.slice(i, i + 30));
    }

    const unsubscribes = idBatches.map((batch) => {
      if (batch.length === 0) return () => {};
      const q = query(collection(db, 'posts'), where(documentId(), 'in', batch));
      return onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
          setSavedPosts((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            fetched.forEach((p) => map.set(p.id, p));
            const currentSet = new Set(postIds);
            return Array.from(map.values())
              .filter((p) => currentSet.has(p.id))
              .sort((a, b) => postIds.indexOf(b.id) - postIds.indexOf(a.id));
          });
          setIsLoading(false);
        },
        (err) => {
          console.error('[SettingsSavedPostsPage] Firestore query error:', err);
          setIsLoading(false);
        }
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [currentUser?.uid, savedPostIds]);

  if (!currentUser) return null;

  const q = searchQuery.trim().toLowerCase();
  const filteredPosts = savedPosts.filter((post) => {
    const hasMedia = Boolean(post.imageUrl || post.videoUrl);
    if (mediaFilter === 'media' && !hasMedia) return false;
    if (mediaFilter === 'text' && hasMedia) return false;
    if (!q) return true;
    return (
      post.content?.toLowerCase().includes(q) ||
      post.author?.name?.toLowerCase().includes(q) ||
      post.author?.handle?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header & Search/Filter Controls */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900/95 via-purple-950/25 to-slate-900/95 p-5 shadow-md space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
            Activity &amp; Content
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 mt-0.5">
            <Bookmark className="h-5 w-5 text-purple-400" />
            Saved Posts ({savedPosts.length})
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            View, search, filter, or unsave your bookmarked Lonkind posts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search saved posts by text, author, or @handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 rounded-xl bg-secondary/45 h-9 text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/40 p-1 rounded-xl border border-border/50 self-start">
            {[
              { id: 'all' as const, label: 'All', icon: Layers },
              { id: 'media' as const, label: 'Media', icon: ImageIcon },
              { id: 'text' as const, label: 'Text', icon: FileText },
            ].map((pill) => {
              const Icon = pill.icon;
              const active = mediaFilter === pill.id;
              return (
                <Button
                  key={pill.id}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'ghost'}
                  onClick={() => setMediaFilter(pill.id)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold gap-1 ${
                    active ? 'bg-indigo-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {pill.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Saved Posts Feed */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onReact={(postId, reaction) => onReactPost(postId, reaction, post.author.uid)}
              onCommentClick={(p) => setSelectedPostForComments(p)}
              onSavePost={onToggleSavePost}
              onDeletePost={onDeletePost}
              userReaction={userReactions.get(post.id)}
              isSaved={savedPostIds.has(post.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground space-y-2">
            <Bookmark className="h-11 w-11 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-bold text-foreground">
              {savedPosts.length === 0 ? 'No Saved Posts Yet' : 'No matching saved posts'}
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              {savedPosts.length === 0
                ? 'Tap the bookmark icon on any post in your Home Feed or Explore to save it here.'
                : 'Try adjusting your search or filter selection.'}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPostForComments && (
        <CommentSheet
          post={selectedPostForComments}
          onOpenChange={(open) => !open && setSelectedPostForComments(null)}
          onCommentSubmit={onSubmitComment}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
