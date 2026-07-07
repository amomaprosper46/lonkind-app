'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { Loader2, Gem, Coins, Sparkles } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { Card, CardContent } from '../ui/card';
import { sendPushNotification } from '@/app/actions/sendNotification';

interface TipDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: CurrentUser;
    recipient: {
        uid: string;
        name: string;
    };
    mode?: 'post' | 'live';
    spaceId?: string;
    postId?: string;
    isCauseDonation?: boolean;
}

export const baseTipOptions = [
    { coins: 10, diamonds: 10, label: 'Rose', emoji: '🌹' },
    { coins: 50, diamonds: 50, label: 'Coffee', emoji: '☕' },
    { coins: 100, diamonds: 100, label: 'Diamond', emoji: '💎' },
    { coins: 500, diamonds: 500, label: 'Heart', emoji: '💖' },
    { coins: 1000, diamonds: 1000, label: 'Crown', emoji: '👑' },
];

export const premiumTipOptions = [
    { coins: 5000, diamonds: 5000, label: 'Sports Car', emoji: '🏎️', isPremium: true },
    { coins: 10000, diamonds: 10000, label: 'Lion', emoji: '🦁', isPremium: true },
    { coins: 50000, diamonds: 50000, label: 'Yacht', emoji: '🛥️', isPremium: true },
    { coins: 100000, diamonds: 100000, label: 'Private Jet', emoji: '✈️', isPremium: true },
    { coins: 500000, diamonds: 500000, label: 'Universe', emoji: '🌌', isPremium: true },
];

export default function TipDialog({ isOpen, onOpenChange, currentUser, recipient, mode = 'post', spaceId, postId, isCauseDonation }: TipDialogProps) {
    const [isTipping, setIsTipping] = useState(false);
    
    const tipOptions = mode === 'live' ? [...baseTipOptions, ...premiumTipOptions] : baseTipOptions;
    const [selectedAmount, setSelectedAmount] = useState(tipOptions[1].coins);
    
    const userCoins = currentUser.coins || 0;

    const handleSendTip = async () => {
        const tip = tipOptions.find(o => o.coins === selectedAmount);
        if (!tip) return;

        if (userCoins < tip.coins) {
            toast({
                variant: 'destructive',
                title: 'Not enough coins',
                description: 'You do not have enough coins for this tip. Please purchase more from your Wallet.',
            });
            return;
        }

        setIsTipping(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                throw new Error('You must be signed in to send tips.');
            }

            const response = await fetch('/api/gift-coins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    toUserId: recipient.uid,
                    coinAmount: tip.coins,
                    giftName: tip.label,
                    giftEmoji: tip.emoji,
                    spaceId: spaceId || undefined,
                    postId: postId || undefined,
                    isCauseDonation: isCauseDonation || undefined,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send tip.');
            }

            toast({
                title: 'Tip Sent! 🎁',
                description: `You sent ${tip.coins} coins (${tip.label} ${tip.emoji}) to ${recipient.name}.`,
            });
            onOpenChange(false);

            if (tip.coins >= 100 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('super-gift', {
                    detail: {
                        emoji: tip.emoji,
                        label: tip.label,
                        coins: tip.coins,
                        senderName: currentUser.name,
                        recipientName: recipient.name,
                    }
                }));
            }
            
            // Fire push notification in the background
            sendPushNotification(
                recipient.uid,
                'New Tip Received! 🎁',
                `${currentUser.name} just tipped you ${tip.coins} coins (${tip.label} ${tip.emoji})!`
            ).catch(err => console.error('Failed to send push notification:', err));
            
        } catch (error: any) {
            console.error('Error sending tip:', error);
            toast({
                variant: 'destructive',
                title: 'Tipping Failed',
                description: error.message || 'Could not send the tip. Please try again.',
            });
        } finally {
            setIsTipping(false);
        }
    };

    const handlePurchaseCoins = async () => {
        setIsTipping(true);
        try {
            const priceLocal = selectedAmount * 20; // ₦20 per coin
            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email || 'user@lonkind.com',
                    amount: priceLocal,
                    coinsToCredit: selectedAmount,
                    currency: 'NGN',
                    userId: currentUser.uid,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Payment initialization failed');
            if (data.authorizationUrl) {
                window.location.href = data.authorizationUrl;
            } else {
                throw new Error('No authorization URL returned from Paystack gateway');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
            setIsTipping(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send a Tip to {recipient.name}</DialogTitle>
                    <DialogDescription>
                        Show your appreciation by sending a tip. They'll receive diamonds for your coins.
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

                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                        {tipOptions.map((option: any) => (
                            <Button
                                key={option.coins}
                                variant={selectedAmount === option.coins ? 'default' : 'outline'}
                                className={`h-auto p-3 flex flex-col items-center gap-1 ${
                                    option.isPremium 
                                        ? 'border-2 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse' 
                                        : ''
                                }`}
                                onClick={() => setSelectedAmount(option.coins)}
                            >
                                <div className="text-3xl mb-1">{option.emoji}</div>
                                <div className="flex items-center gap-2">
                                     <Coins className="h-4 w-4 text-yellow-500" />
                                    <span className="font-bold">{option.coins.toLocaleString()}</span>
                                </div>
                                <p className="text-sm font-semibold mt-1">{option.label}</p>
                                <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-[10px] text-blue-500 font-bold">
                                    <Gem className="h-3 w-3" />
                                    <span>Creator earns {option.diamonds.toLocaleString()} Diamonds</span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="px-1 py-2 text-[11px] text-center text-muted-foreground bg-muted/40 rounded-lg border border-border/40">
                    💡 <strong>Platform Commission:</strong> Lonkind applies a standard <strong>25% App Cut</strong> on cashout (Creators earn 75% net value).
                </div>

                <DialogFooter>
                    {userCoins < selectedAmount ? (
                        <Button onClick={handlePurchaseCoins} disabled={isTipping} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold">
                            {isTipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                            Buy {selectedAmount} Coins via Paystack
                        </Button>
                    ) : (
                        <Button onClick={handleSendTip} disabled={isTipping} className="w-full font-bold">
                            {isTipping ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                               <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Send Tip
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
