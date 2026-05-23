
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { giftCoins } from '@/ai/flows/gift-coins';
import { Loader2, Gem, Coins, Sparkles } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';

interface GiftDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: CurrentUser;
    recipient: {
        uid: string;
        name: string;
    };
}

const giftOptions = [
    { coins: 10, diamonds: 1, label: 'Small Thanks' },
    { coins: 50, diamonds: 5, label: 'Nice Job!' },
    { coins: 100, diamonds: 10, label: 'Super Fan!' },
    { coins: 500, diamonds: 55, label: 'Amazing!' },
];

export default function GiftDialog({ isOpen, onOpenChange, currentUser, recipient }: GiftDialogProps) {
    const [isGifting, setIsGifting] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(giftOptions[1].coins);
    
    const userCoins = currentUser.coins || 0;

    const handleGift = async () => {
        const gift = giftOptions.find(o => o.coins === selectedAmount);
        if (!gift) return;

        if (userCoins < gift.coins) {
            toast({
                variant: 'destructive',
                title: 'Not enough coins',
                description: 'You do not have enough coins for this gift. Please purchase more.',
            });
            return;
        }

        setIsGifting(true);
        try {
            const result = await giftCoins({
                fromUserId: currentUser.uid,
                toUserId: recipient.uid,
                coinAmount: gift.coins,
                diamondValue: gift.diamonds,
            });
            
            if (result.success) {
                toast({
                    title: 'Gift Sent!',
                    description: `You sent ${gift.coins} coins to ${recipient.name}.`,
                });
                onOpenChange(false);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Error sending gift:', error);
            toast({
                variant: 'destructive',
                title: 'Gifting Failed',
                description: error.message || 'Could not send the gift. Please try again.',
            });
        } finally {
            setIsGifting(false);
        }
    };

    const handlePurchaseCoins = () => {
        // In a real app, this would open a purchase modal or redirect to a purchase page.
        // For now, we'll just show a toast and link to settings.
        toast({
            title: 'Purchase Coins',
            description: 'You can purchase more coins in your Wallet in the Settings page.',
        });
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send a Gift to {recipient.name}</DialogTitle>
                    <DialogDescription>
                        Show your appreciation by sending a gift. They'll receive diamonds for your coins.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <Card className="bg-muted/50">
                        <CardContent className="p-3 flex justify-between items-center">
                            <p className="font-semibold">Your Balance</p>
                            <div className="flex items-center gap-2 text-lg font-bold">
                                <Coins className="h-5 w-5 text-yellow-500" />
                                <span>{userCoins.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                        {giftOptions.map(option => (
                            <Button
                                key={option.coins}
                                variant={selectedAmount === option.coins ? 'default' : 'outline'}
                                className="h-auto p-3 flex flex-col items-center gap-1"
                                onClick={() => setSelectedAmount(option.coins)}
                            >
                                <div className="flex items-center gap-2">
                                     <Coins className="h-5 w-5 text-yellow-500" />
                                    <span className="text-lg font-bold">{option.coins}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Gem className="h-3 w-3 text-blue-400" />
                                    <span>Gives {option.diamonds}</span>
                                </div>
                                <p className="text-sm font-semibold mt-1">{option.label}</p>
                            </Button>
                        ))}
                    </div>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-2">
                     <Button type="button" variant="outline" onClick={handlePurchaseCoins}>Purchase More Coins</Button>
                    <Button onClick={handleGift} disabled={isGifting || userCoins < selectedAmount}>
                        {isGifting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                           <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Send Gift
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
