import React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

export function FriendRequestCard({ request, onAccept, onDecline }) {
  return (
    <Card className="flex items-center p-4 bg-background rounded-xl border border-border/60">
      <Avatar className="h-12 w-12 mr-4">
        <AvatarImage src={request.from?.avatarUrl} alt={request.from?.name} />
        <AvatarFallback>{request.from?.name?.charAt(0) ?? 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{request.from?.name || 'Someone'} wants to connect</p>
        <p className="text-xs text-muted-foreground">@{request.from?.handle}</p>
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
