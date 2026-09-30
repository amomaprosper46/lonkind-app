import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, Check } from 'lucide-react';
import Link from 'next/link';

export function SuggestionCard({ suggestion, onAddFriend, requestSent }) {
  return (
    <Card className="flex flex-col items-center p-4 bg-background rounded-xl border border-border/60">
      <Link href={`/profile/${suggestion.handle}`} className="flex flex-col items-center">
        <Avatar className="h-20 w-20 mb-2 border-2 border-indigo-500/20">
          <AvatarImage src={suggestion.avatarUrl} alt={suggestion.name} />
          <AvatarFallback>{suggestion.name?.charAt(0) ?? 'U'}</AvatarFallback>
        </Avatar>
        <h3 className="font-bold text-base truncate max-w-[150px]">{suggestion.name}</h3>
        <p className="text-xs text-muted-foreground truncate max-w-[150px]">@{suggestion.handle}</p>
        {suggestion.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[150px]">{suggestion.bio}</p>}
      </Link>
      <Button
        className={`w-full mt-3 ${requestSent ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 text-white'}`}
        onClick={() => !requestSent && onAddFriend(suggestion)}
        disabled={requestSent}
      >
        {requestSent ? (
          <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Request Sent</span>
        ) : (
          <span className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> Add Friend</span>
        )}
      </Button>
    </Card>
  );
}
