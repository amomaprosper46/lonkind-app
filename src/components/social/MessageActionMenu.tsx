import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface MessageActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll?: () => void; // optional, only for sender
  onEdit: () => void;
  onMore: () => void;
  isSender?: boolean;
}

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  isOpen,
  onClose,
  onCopy,
  onDeleteForMe,
  onDeleteForAll,
  onEdit,
  onMore,
  isSender,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm w-full mx-auto sm:rounded-t-lg sm:rounded-b-none sm:bottom-0 sm:fixed sm:inset-x-0 sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>Message actions</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-2 py-2">
          <Button variant="ghost" onClick={onCopy} className="justify-start">
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button variant="ghost" onClick={onDeleteForMe} className="justify-start">
            <Trash2 className="mr-2 h-4 w-4" /> Delete for me
          </Button>
          {isSender && onDeleteForAll && (
            <Button variant="ghost" onClick={onDeleteForAll} className="justify-start">
              <Trash2 className="mr-2 h-4 w-4" /> Delete for everyone
            </Button>
          )}
          <Button variant="ghost" onClick={onEdit} className="justify-start">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="ghost" onClick={onMore} className="justify-start">
            <MoreHorizontal className="mr-2 h-4 w-4" /> More
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
