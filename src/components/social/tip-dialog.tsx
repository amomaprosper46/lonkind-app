'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { sendTip } from '@/ai/flows/send-tip';
import { Loader2, Gem, Coins, Sparkles } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { Card, CardContent } from '../ui/card';

interface TipDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUser: CurrentUser;
    recipient: {
        uid: string;
        name: string;
    };
}

const tipOptions = [
    { coins: 10, diamonds: 10, label: 'Small Thanks' },
    { coins: 50, diamonds: 50, label: 'Nice Job!' },
    { coins: 100, diamonds: 100, label: 'Super Fan!' },
    { coins: 500, diamonds: 500, label: 'Amazing!' },
];

export default function TipDialog({ isOpen, onOpenChange, currentUser, recipient }: TipDialogProps) {
    const [isTipping, setIsTipping] = useState(false);
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
            const result = await sendTip({
                fromUserId: currentUser.uid,
                toUserId: recipient.uid,
                coinAmount: tip.coins,
            });
            
            if (result.success) {
                toast({
                    title: 'Tip Sent!',
                    description: `You sent ${tip.coins} coins to ${recipient.name}.`,
                });
                onOpenChange(false);
            } else {
                throw new Error(result.message);
            }
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

                    <div className="grid grid-cols-2 gap-3">
                        {tipOptions.map(option => (
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

                <DialogFooter>
                    <Button onClick={handleSendTip} disabled={isTipping || userCoins < selectedAmount} className="w-full">
                        {isTipping ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                           <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Send Tip
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
