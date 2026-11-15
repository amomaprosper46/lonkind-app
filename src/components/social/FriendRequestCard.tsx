import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useLiveUserProfile } from '@/hooks/use-live-user-profile';

export interface FriendRequestCardProps {
  request: any;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export function FriendRequestCard({ request, onAccept, onDecline }: FriendRequestCardProps) {
  const fromUid = request.from?.uid || request.uid || request.id;
  const liveFrom = useLiveUserProfile(
    fromUid,
    request.from?.avatarUrl,
    request.from?.name,
    request.from?.handle
  );

  return (
    <Card className="flex items-center p-4 bg-background rounded-xl border border-border/60">
      <Avatar className="h-12 w-12 mr-4">
        <AvatarImage src={liveFrom.avatarUrl} alt={liveFrom.name} />
        <AvatarFallback>{liveFrom.name?.charAt(0) ?? 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{liveFrom.name || 'Someone'} wants to connect</p>
        <p className="text-xs text-muted-foreground">@{liveFrom.handle}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={() => onAccept(request.id)}>
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDecline(request.id)}>
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </Card>
  );
}
