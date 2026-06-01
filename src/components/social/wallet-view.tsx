
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { purchaseCoins } from '@/ai/flows/purchase-coins';
import { requestPayout } from '@/ai/flows/request-payout';
import { Loader2, Gem, Coins, Sparkles, PlusCircle, ArrowDown, ArrowUp } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, runTransaction, doc, increment, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const DIAMOND_PAYOUT_RATE_NAIRA = 15;
const MINIMUM_PAYOUT_DIAMONDS = 350; // Approximately 5,250 Naira

interface WalletViewProps {
    currentUser: CurrentUser;
}

const coinPackages = [
    { coins: 100, price: 2000 },
    { coins: 550, price: 10000, bonus: '10% bonus' },
    { coins: 1200, price: 20000, bonus: '20% bonus' },
    { coins: 3000, price: 50000, bonus: '25% bonus' },
];

interface PurchaseTransaction { id: string; coinsAdded: number; amountNaira: number; status: string; time: Timestamp; }
interface EarningTransaction { id: string; fromUserName: string; coins: number; diamonds: number; time: Timestamp; giftName?: string; giftEmoji?: string; }
interface PayoutTransaction { id: string; diamondAmount: number; amountNaira: number; status: string; time: Timestamp; }

const payoutFormSchema = z.object({
  diamondAmount: z.coerce
    .number()
    .int()
    .positive("Must be a positive number")
    .min(MINIMUM_PAYOUT_DIAMONDS, { message: `Minimum payout is ${MINIMUM_PAYOUT_DIAMONDS} diamonds (₦${MINIMUM_PAYOUT_DIAMONDS * DIAMOND_PAYOUT_RATE_NAIRA}).` }),
  paymentDetails: z.string().min(10, "Please provide valid payment details (e.g., Bank Name & Account Number)."),
});


export default function WalletView({ currentUser }: WalletViewProps) {
    const [isPurchasing, setIsPurchasing] = useState<number | null>(null);
    const [purchaseTxs, setPurchaseTxs] = useState<PurchaseTransaction[]>([]);
    const [earningTxs, setEarningTxs] = useState<EarningTransaction[]>([]);
    const [payoutTxs, setPayoutTxs] = useState<PayoutTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<z.infer<typeof payoutFormSchema>>({
        resolver: zodResolver(payoutFormSchema),
        defaultValues: { diamondAmount: MINIMUM_PAYOUT_DIAMONDS, paymentDetails: '' },
    });

    useEffect(() => {
        const txRef = collection(db, 'transactions');
        const purchaseQuery = query(txRef, where('userId', '==', currentUser.uid), orderBy('time', 'desc'), limit(5));
        const unsubPurchases = onSnapshot(purchaseQuery, snap => setPurchaseTxs(snap.docs.map(d => ({id: d.id, ...d.data()} as PurchaseTransaction))));

        let unsubEarnings: () => void = () => {};
        let unsubPayouts: () => void = () => {};
        
        const earningsRef = collection(db, 'gifts');
        const earningsQuery = query(earningsRef, where('toUserId', '==', currentUser.uid), orderBy('time', 'desc'), limit(5));
        unsubEarnings = onSnapshot(earningsQuery, snap => setEarningTxs(snap.docs.map(d => ({id: d.id, ...d.data()} as EarningTransaction))));
        
        const payoutsRef = collection(db, 'payouts');
        const payoutsQuery = query(payoutsRef, where('userId', '==', currentUser.uid), orderBy('time', 'desc'), limit(5));
        unsubPayouts = onSnapshot(payoutsQuery, snap => setPayoutTxs(snap.docs.map(d => ({id: d.id, ...d.data()} as PayoutTransaction))));

        setIsLoading(false);

        return () => {
            unsubPurchases();
            unsubEarnings();
            unsubPayouts();
        };
    }, [currentUser.uid, currentUser.isProfessional]);


    const handlePurchase = async (coinAmount: number) => {
        setIsPurchasing(coinAmount);
        try {
            const pkg = coinPackages.find(p => p.coins === coinAmount);
            if (!pkg) throw new Error("Invalid coin package");

            // Make real payment request to our Paystack backend
            const res = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email || 'user@example.com',
                    amount: pkg.price,
                    userId: currentUser.uid,
                    coinAmount: coinAmount,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');

            // Redirect user to Paystack Checkout URL
            if (data.authorizationUrl) {
                window.location.href = data.authorizationUrl;
            } else {
                throw new Error("No authorization URL returned from Paystack");
            }
        } catch (error: any) {
            console.error("Purchase error:", error);
            toast({
                title: 'Purchase Failed',
                description: error.message || 'There was an error initiating the purchase.',
                variant: 'destructive',
            });
            setIsPurchasing(null);
        }
    };
    
    const onSubmitPayout = async (values: z.infer<typeof payoutFormSchema>) => {
        setIsPurchasing(-1); // Using -1 as a loading state for payout
        try {
            const payoutNaira = values.diamondAmount * DIAMOND_PAYOUT_RATE_NAIRA;
            
            // Execute the database write locally so it uses the authenticated user's permissions
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found.');
                
                const currentDiamonds = userDoc.data().diamonds || 0;
                if (currentDiamonds < values.diamondAmount) throw new Error('Insufficient diamond balance.');

                transaction.update(userRef, { diamonds: increment(-values.diamondAmount) });

                const payoutRef = doc(collection(db, 'payouts'));
                transaction.set(payoutRef, {
                    userId: currentUser.uid,
                    diamondAmount: values.diamondAmount,
                    amountNaira: payoutNaira,
                    paymentMethod: 'Bank Transfer',
                    paymentDetails: values.paymentDetails,
                    status: 'processing',
                    time: serverTimestamp(),
                });
            });

            toast({ title: 'Payout Requested!', description: `Your request for ₦${payoutNaira.toLocaleString()} is processing.` });
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payout Failed', description: error.message || 'Could not complete the payout request.' });
        } finally {
            setIsPurchasing(null);
        }
    };
    
    return (
        <main className="col-span-12 md:col-span-9 space-y-6">
            <header>
                <h1 className="text-4xl font-bold">Wallet</h1>
                <p className="text-muted-foreground mt-2">Manage your coins, diamonds, and earnings.</p>
            </header>
            
            <Tabs defaultValue="wallet" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="wallet">My Wallet</TabsTrigger>
                    <TabsTrigger value="creator">Earnings Dashboard</TabsTrigger>
                </TabsList>
                
                <TabsContent value="wallet" className="mt-4 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Balances</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-muted/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                     <CardTitle className="text-sm font-medium">Coin Balance</CardTitle>
                                     <Coins className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                     <div className="text-2xl font-bold">{(currentUser.coins || 0).toLocaleString()}</div>
                                     <p className="text-xs text-muted-foreground">Used for tipping creators.</p>
                                </CardContent>
                            </Card>
                             <Card className="bg-muted/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                     <CardTitle className="text-sm font-medium">Diamond Balance</CardTitle>
                                     <Gem className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                     <div className="text-2xl font-bold">{(currentUser.diamonds || 0).toLocaleString()}</div>
                                     <p className="text-xs text-muted-foreground">Received from tips.</p>
                                </CardContent>
                            </Card>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Purchase Coins</CardTitle>
                            <CardDescription>Add coins to your wallet to send tips.</CardDescription>
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
                                    {isPurchasing === pkg.coins ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <Coins className="h-6 w-6 text-yellow-500" />
                                                <span className="text-xl font-bold">{pkg.coins}</span>
                                            </div>
                                            <p className="text-sm font-semibold">₦{pkg.price.toLocaleString()}</p>
                                            {pkg.bonus && <p className="text-xs text-primary font-bold">{pkg.bonus}</p>}
                                        </>
                                    )}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader>
                            <CardTitle>Recent Purchases</CardTitle>
                            <CardDescription>Your last 5 coin purchases.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : purchaseTxs.length > 0 ? (
                                <div className="space-y-4">
                                    {purchaseTxs.map(tx => (
                                        <div key={tx.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full"><PlusCircle className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
                                                <div>
                                                    <p className="font-semibold">Coin Purchase</p>
                                                    <p className="text-sm text-muted-foreground">{tx.time ? format(tx.time.toDate(), 'PPP p') : ''}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600 dark:text-green-400">+{tx.coinsAdded} Coins</p>
                                                <p className="text-sm text-muted-foreground">-₦{tx.amountNaira.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-sm text-muted-foreground p-6">No purchase history.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="creator" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Creator Earnings</CardTitle>
                            </CardHeader>
                             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <Card className="bg-blue-500/10 border-blue-500/20">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                         <CardTitle className="text-sm font-medium">Diamond Balance</CardTitle>
                                         <Gem className="h-4 w-4 text-blue-500" />
                                    </CardHeader>
                                    <CardContent>
                                         <div className="text-2xl font-bold">{(currentUser.diamonds || 0).toLocaleString()}</div>
                                         <p className="text-xs text-muted-foreground">
                                            Est. Value: ₦{((currentUser.diamonds || 0) * DIAMOND_PAYOUT_RATE_NAIRA).toLocaleString()}
                                        </p>
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader>
                                         <CardTitle className="text-lg">Request Payout</CardTitle>
                                         <CardDescription>Minimum payout is {MINIMUM_PAYOUT_DIAMONDS} diamonds.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Form {...form}>
                                            <form onSubmit={form.handleSubmit(onSubmitPayout)} className="space-y-4">
                                                <FormField control={form.control} name="diamondAmount" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Diamonds to Cash Out</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="paymentDetails" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bank Details</FormLabel>
                                                        <FormControl><Input placeholder="Bank Name - Account Number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                    Request ₦{(form.watch('diamondAmount') * DIAMOND_PAYOUT_RATE_NAIRA).toLocaleString()}
                                                </Button>
                                            </form>
                                        </Form>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>Recent Earnings</CardTitle></CardHeader>
                                <CardContent>
                                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : earningTxs.length > 0 ? (
                                        <div className="space-y-4">
                                            {earningTxs.map(tx => (
                                                <div key={tx.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-full"><ArrowDown className="h-5 w-5 text-pink-600 dark:text-pink-400" /></div>
                                                        <div>
                                                            <p className="font-semibold">
                                                                {tx.giftName && tx.giftEmoji 
                                                                    ? `Received ${tx.giftName} ${tx.giftEmoji} from ${tx.fromUserName}`
                                                                    : `Tip from ${tx.fromUserName}`}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">{tx.time ? format(tx.time.toDate(), 'PPP p') : ''}</p>
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-pink-600 dark:text-pink-400">+{tx.diamonds} Diamonds</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-center text-sm text-muted-foreground p-6">No tips received yet.</p>}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Payout History</CardTitle></CardHeader>
                                <CardContent>
                                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : payoutTxs.length > 0 ? (
                                        <div className="space-y-4">
                                            {payoutTxs.map(tx => (
                                                <div key={tx.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                         <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full"><ArrowUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                                                        <div>
                                                            <p className="font-semibold">Payout Request</p>
                                                            <p className="text-sm text-muted-foreground">{tx.time ? format(tx.time.toDate(), 'PPP p') : ''}</p>
                                                        </div>
                                                    </div>
                                                    <div className='text-right'>
                                                        <p className="font-bold text-indigo-600 dark:text-indigo-400">-₦{tx.amountNaira.toLocaleString()}</p>
                                                        <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-center text-sm text-muted-foreground p-6">No payout history.</p>}
                                </CardContent>
                            </Card>
                        </div>

                </TabsContent>
            </Tabs>
        </main>
    );
}
