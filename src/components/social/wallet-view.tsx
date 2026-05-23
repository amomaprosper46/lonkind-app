
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { purchaseCoins } from '@/ai/flows/purchase-coins';
import { Loader2, Gem, Coins, Sparkles, PlusCircle } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { Separator } from '../ui/separator';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

interface WalletViewProps {
    currentUser: CurrentUser;
}

const coinPackages = [
    { coins: 100, price: 2000 },
    { coins: 550, price: 10000, bonus: '10% bonus' },
    { coins: 1200, price: 20000, bonus: '20% bonus' },
    { coins: 3000, price: 50000, bonus: '25% bonus' },
];

interface Transaction {
    id: string;
    coinsAdded: number;
    amountNaira: number;
    status: string;
    time: Timestamp;
}

export default function WalletView({ currentUser }: WalletViewProps) {
    const [isPurchasing, setIsPurchasing] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoadingTx, setIsLoadingTx] = useState(true);

     useEffect(() => {
        const txRef = collection(db, 'transactions');
        const q = query(
            txRef, 
            where('userId', '==', currentUser.uid),
            orderBy('time', 'desc'),
            limit(5)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(txs);
            setIsLoadingTx(false);
        });

        return () => unsubscribe();
    }, [currentUser.uid]);


    const handlePurchase = async (coinAmount: number) => {
        setIsPurchasing(coinAmount);
        try {
            const result = await purchaseCoins({
                userId: currentUser.uid,
                coinAmount: coinAmount,
            });

            if (result.success) {
                toast({
                    title: 'Purchase Successful!',
                    description: `Added ${coinAmount} coins to your wallet.`,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error('Error purchasing coins:', error);
            toast({
                variant: 'destructive',
                title: 'Purchase Failed',
                description: error.message || 'Could not complete the purchase. Please try again.',
            });
        } finally {
            setIsPurchasing(null);
        }
    };
    
    return (
        <main className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>My Wallet</CardTitle>
                    <CardDescription>View your balances and purchase coins.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                             <CardTitle className="text-sm font-medium">Coin Balance</CardTitle>
                             <Coins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold">{(currentUser.coins || 0).toLocaleString()}</div>
                             <p className="text-xs text-muted-foreground">Used for gifting creators.</p>
                        </CardContent>
                    </Card>
                     <Card className="bg-muted/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                             <CardTitle className="text-sm font-medium">Diamond Balance</CardTitle>
                             <Gem className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                             <div className="text-2xl font-bold">{(currentUser.diamonds || 0).toLocaleString()}</div>
                             <p className="text-xs text-muted-foreground">Received from gifts.</p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Purchase Coins</CardTitle>
                    <CardDescription>Add coins to your wallet to send gifts.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {coinPackages.map(pkg => (
                        <Button
                            key={pkg.coins}
                            variant="outline"
                            className="h-auto p-4 flex flex-col items-center gap-1.5"
                            onClick={() => handlePurchase(pkg.coins)}
                            disabled={isPurchasing !== null}
                        >
                            {isPurchasing === pkg.coins ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Coins className="h-6 w-6 text-yellow-500" />
                                        <span className="text-xl font-bold">{pkg.coins}</span>
                                    </div>
                                    <p className="text-sm font-semibold">₦{pkg.price.toLocaleString()}</p>
                                    {pkg.bonus && <p className="text-xs text-green-600 dark:text-green-400 font-bold">{pkg.bonus}</p>}
                                </>
                            )}
                        </Button>
                    ))}
                </CardContent>
            </Card>
            
             <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Your last 5 coin purchases.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingTx ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="h-6 w-6 animate-spin"/>
                        </div>
                    ) : transactions.length > 0 ? (
                        <div className="space-y-4">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                                           <PlusCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">Coin Purchase</p>
                                            <p className="text-sm text-muted-foreground">
                                                {tx.time ? format(tx.time.toDate(), 'PPP p') : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600 dark:text-green-400">+{tx.coinsAdded} Coins</p>
                                        <p className="text-sm text-muted-foreground">-₦{tx.amountNaira.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground p-6">No purchase history found.</p>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
