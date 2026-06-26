'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp, increment } from 'firebase/firestore';
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
}

export const baseTipOptions = [
    { coins: 10, diamonds: 10, label: 'Rose', emoji: '🌹' },
    { coins: 50, diamonds: 50, label: 'Coffee', emoji: '☕' },
    { coins: 100, diamonds: 100, label: 'Diamond', emoji: '💎' },
    { coins: 500, diamonds: 500, label: 'Heart', emoji: '💖' },
    { coins: 1000, diamonds: 1000, label: 'Crown', emoji: '👑' },
];

export const premiumTipOptions = [
    { coins: 10000, diamonds: 10000, label: 'Lion', emoji: '🦁', isPremium: true },
    { coins: 50000, diamonds: 50000, label: 'Universe', emoji: '🌌', isPremium: true },
];

export default function TipDialog({ isOpen, onOpenChange, currentUser, recipient, mode = 'post', spaceId }: TipDialogProps) {
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
            const COIN_TO_DIAMOND_CONVERSION_RATE = 1;
            
            await runTransaction(db, async (transaction) => {
                const senderRef = doc(db, 'users', currentUser.uid);
                const receiverRef = doc(db, 'users', recipient.uid);
        
                const senderDoc = await transaction.get(senderRef);
                if (!senderDoc.exists() || (senderDoc.data()?.coins || 0) < tip.coins) {
                  throw new Error('Insufficient coins or sender not found.');
                }
                
                const receiverDoc = await transaction.get(receiverRef);
                if (!receiverDoc.exists()) {
                    throw new Error('Receiver not found.');
                }
        
                const diamondValue = Math.floor(tip.coins * COIN_TO_DIAMOND_CONVERSION_RATE);
                const giftRef = doc(collection(db, 'gifts'));
                transaction.set(giftRef, {
                    fromUserId: currentUser.uid,
                    fromUserName: senderDoc.data()?.name || 'Unknown User',
                    toUserId: recipient.uid,
                    toUserName: receiverDoc.data()?.name || 'Unknown User',
                    coins: tip.coins,
                    diamonds: diamondValue,
                    giftName: tip.label,
                    giftEmoji: tip.emoji,
                    time: serverTimestamp(),
                });
        
                const senderUpdate: any = { coins: increment(-tip.coins), lifetimeTipsGiven: increment(tip.coins) };
                const newLifetimeTipsGiven = (senderDoc.data()?.lifetimeTipsGiven || 0) + tip.coins;
                let senderBadges = senderDoc.data()?.badges || [];
                let addedSenderBadge = false;
                if (newLifetimeTipsGiven >= 1000 && !senderBadges.includes('Top Supporter')) {
                    senderBadges.push('Top Supporter');
                    addedSenderBadge = true;
                }
                if (newLifetimeTipsGiven >= 10000 && !senderBadges.includes('Whale')) {
                    senderBadges.push('Whale');
                    addedSenderBadge = true;
                }
                if (addedSenderBadge) {
                    senderUpdate.badges = senderBadges;
                }
                transaction.update(senderRef, senderUpdate);

                const receiverUpdate: any = { diamonds: increment(diamondValue), lifetimeTipsReceived: increment(tip.coins) };
                const newLifetimeTipsReceived = (receiverDoc.data()?.lifetimeTipsReceived || 0) + tip.coins;
                let receiverBadges = receiverDoc.data()?.badges || [];
                let addedReceiverBadge = false;
                if (newLifetimeTipsReceived >= 1000 && !receiverBadges.includes('Rising Star')) {
                    receiverBadges.push('Rising Star');
                    addedReceiverBadge = true;
                }
                if (newLifetimeTipsReceived >= 10000 && !receiverBadges.includes('Top Creator')) {
                    receiverBadges.push('Top Creator');
                    addedReceiverBadge = true;
                }
                if (addedReceiverBadge) {
                    receiverUpdate.badges = receiverBadges;
                }
                transaction.update(receiverRef, receiverUpdate);
        
                if (spaceId) {
                    const spaceRef = doc(db, 'spaces', spaceId);
                    const spaceDoc = await transaction.get(spaceRef);
                    if (spaceDoc.exists()) {
                        const newGift = {
                            senderName: senderDoc.data()?.name || 'Someone',
                            giftName: tip.label,
                            giftEmoji: tip.emoji,
                            timestamp: new Date().getTime(),
                            id: Math.random().toString(36).substring(7),
                        };
                        const currentGifts = spaceDoc.data()?.recentGifts || [];
                        const updatedGifts = [...currentGifts, newGift].slice(-10);
                        transaction.update(spaceRef, { recentGifts: updatedGifts });
                    }
                }
              });

            toast({
                title: 'Tip Sent!',
                description: `You sent ${tip.coins} coins to ${recipient.name}.`,
            });
            onOpenChange(false);
            
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
            const amountInNaira = selectedAmount * 15;
            const response = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email || 'user@lonkind.com',
                    amountNaira: amountInNaira,
                    coinsToCredit: selectedAmount,
                    userId: currentUser.uid,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Payment initialization failed');
            if (data.authorization_url) {
                window.location.href = data.authorization_url;
            } else {
                throw new Error('No authorization URL returned');
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
                                <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-[10px] text-green-500 font-medium">
                                    <span>Creator earns ₦{(option.diamonds * 15).toLocaleString()}</span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    {userCoins < selectedAmount ? (
                        <Button onClick={handlePurchaseCoins} disabled={isTipping} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                            {isTipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                            Buy {selectedAmount} Coins (₦{(selectedAmount * 15).toLocaleString()}) to Send
                        </Button>
                    ) : (
                        <Button onClick={handleSendTip} disabled={isTipping} className="w-full">
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
