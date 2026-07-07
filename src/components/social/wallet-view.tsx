"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2, Gem, Coins, Sparkles, PlusCircle, ArrowDown, ArrowUp, Globe } from 'lucide-react';
import { type CurrentUser } from './social-dashboard';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MINIMUM_PAYOUT_DIAMONDS = 350;

interface WalletViewProps {
    currentUser: CurrentUser;
}

const SUPPORTED_COUNTRIES = [
    { country: 'NG', name: 'Nigeria', currency: 'NGN', flag: '🇳🇬', coinRate: 20, diamondRate: 15, symbol: '₦' },
    { country: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸', coinRate: 0.02, diamondRate: 0.015, symbol: '$' },
    { country: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭', coinRate: 0.30, diamondRate: 0.22, symbol: 'GHS ' },
    { country: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪', coinRate: 3.00, diamondRate: 2.25, symbol: 'KES ' },
    { country: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧', coinRate: 0.016, diamondRate: 0.012, symbol: '£' },
    { country: 'EU', name: 'Europe', currency: 'EUR', flag: '🇪🇺', coinRate: 0.018, diamondRate: 0.014, symbol: '€' },
    { country: 'ZA', name: 'South Africa', currency: 'ZAR', flag: '🇿🇦', coinRate: 0.36, diamondRate: 0.27, symbol: 'R ' },
];

const coinPackages = [
    { coins: 100, priceMult: 100 },
    { coins: 550, priceMult: 500, bonus: '10% bonus' },
    { coins: 1200, priceMult: 1000, bonus: '20% bonus' },
    { coins: 3000, priceMult: 2500, bonus: '25% bonus' },
];

interface PurchaseTransaction { id: string; coinsAdded: number; amount: number; amountNaira?: number; currency?: string; status: string; time: Timestamp; }
interface EarningTransaction { id: string; fromUserName: string; coins: number; diamonds: number; time: Timestamp; giftName?: string; giftEmoji?: string; }
interface PayoutTransaction { id: string; diamondAmount: number; amount: number; amountNaira?: number; currency?: string; status: string; time: Timestamp; }

const getTimestampMillis = (t: any): number => {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (typeof t === 'string') return new Date(t).getTime();
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.toDate === 'function') return t.toDate().getTime();
    if (t instanceof Date) return t.getTime();
    return new Date(t).getTime() || 0;
};

const formatTxTime = (t: any): string => {
    if (!t) return '';
    try {
        const millis = getTimestampMillis(t);
        if (!millis) return '';
        return format(new Date(millis), 'PPP p');
    } catch {
        return '';
    }
};

const payoutFormSchema = z.object({
  diamondAmount: z.coerce
    .number()
    .int()
    .positive("Must be a positive number")
    .min(MINIMUM_PAYOUT_DIAMONDS, { message: `Minimum payout is ${MINIMUM_PAYOUT_DIAMONDS} diamonds.` }),
  bankCode: z.string().min(2, "Please select a bank or mobile money provider."),
  accountNumber: z.string().min(6, "Enter valid account or mobile number").max(25, "Account number too long"),
  accountName: z.string().min(2, "Account must be verified."),
});

export default function WalletView({ currentUser }: WalletViewProps) {
    const [selectedCountry, setSelectedCountry] = useState<string>('NG');
    const currentGeo = SUPPORTED_COUNTRIES.find(c => c.country === selectedCountry) || SUPPORTED_COUNTRIES[0];

    const [isPurchasing, setIsPurchasing] = useState<number | null>(null);
    const [customCoinAmount, setCustomCoinAmount] = useState<string>('');
    const [purchaseTxs, setPurchaseTxs] = useState<PurchaseTransaction[]>([]);
    const [earningTxs, setEarningTxs] = useState<EarningTransaction[]>([]);
    const [payoutTxs, setPayoutTxs] = useState<PayoutTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [banks, setBanks] = useState<{name: string, code: string}[]>([]);
    const [isResolving, setIsResolving] = useState(false);

    const form = useForm<z.infer<typeof payoutFormSchema>>({
        resolver: zodResolver(payoutFormSchema),
        defaultValues: { diamondAmount: MINIMUM_PAYOUT_DIAMONDS, bankCode: '', accountNumber: '', accountName: '' },
    });

    useEffect(() => {
        setBanks([]);
        fetch(`/api/paystack/payout?country=${selectedCountry}`)
            .then(res => res.json())
            .then(data => {
                if (data.banks) setBanks(data.banks);
            }).catch(console.error);
    }, [selectedCountry]);

    useEffect(() => {
        const txRef = collection(db, 'transactions');
        const purchaseQuery = query(txRef, where('userId', '==', currentUser.uid));
        const unsubPurchases = onSnapshot(purchaseQuery, snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseTransaction));
            list.sort((a, b) => getTimestampMillis(b.time) - getTimestampMillis(a.time));
            setPurchaseTxs(list.slice(0, 15));
        }, err => console.error("Purchase history error:", err));

        let unsubEarnings: () => void = () => {};
        let unsubPayouts: () => void = () => {};
        
        const earningsRef = collection(db, 'gifts');
        const earningsQuery = query(earningsRef, where('toUserId', '==', currentUser.uid));
        unsubEarnings = onSnapshot(earningsQuery, snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as EarningTransaction));
            list.sort((a, b) => getTimestampMillis(b.time) - getTimestampMillis(a.time));
            setEarningTxs(list.slice(0, 15));
        }, err => console.error("Earnings history error:", err));
        
        const payoutsRef = collection(db, 'payoutRequests');
        const payoutsQuery = query(payoutsRef, where('userId', '==', currentUser.uid));
        unsubPayouts = onSnapshot(payoutsQuery, snap => {
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    amount: data.amount || data.amountNaira || 0,
                    amountNaira: data.amountNaira,
                    currency: data.currency || 'NGN',
                    status: data.status,
                    time: data.createdAt || data.updatedAt,
                    diamondAmount: data.diamondAmount,
                } as PayoutTransaction;
            });
            list.sort((a, b) => getTimestampMillis(b.time) - getTimestampMillis(a.time));
            setPayoutTxs(list.slice(0, 15));
        }, err => console.error("Payout history error:", err));

        setIsLoading(false);

        return () => {
            unsubPurchases();
            unsubEarnings();
            unsubPayouts();
        };
    }, [currentUser.uid]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const payment = params.get('payment');
            const coins = params.get('coins');
            const ref = params.get('reference') || params.get('trxref');
            
            if (payment === 'success') {
                toast({
                    title: '🎉 Payment Successful!',
                    description: coins ? `Successfully credited ${coins} coins to your balance!` : 'Your payment has been verified and coins added.',
                });
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (payment === 'failed' || payment === 'error') {
                const reason = params.get('reason') || 'Transaction was cancelled or failed to verify.';
                toast({
                    title: 'Payment Incomplete',
                    description: reason.replace(/_/g, ' '),
                    variant: 'destructive',
                });
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (ref && !payment) {
                fetch('/api/paystack/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: ref }),
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        toast({
                            title: '🎉 Payment Verified!',
                            description: `Successfully credited ${data.coinsAdded || 'new'} coins to your balance!`,
                        });
                    } else {
                        toast({
                            title: 'Verification Notice',
                            description: data.error || 'Could not automatically verify payment reference.',
                            variant: 'destructive',
                        });
                    }
                    window.history.replaceState({}, document.title, window.location.pathname);
                })
                .catch(() => {});
            }
        }
    }, []);

    const handlePurchase = async (coinAmount: number) => {
        setIsPurchasing(coinAmount);
        try {
            let priceLocal = Number((coinAmount * currentGeo.coinRate).toFixed(2));
            const pkg = coinPackages.find(p => p.coins === coinAmount);
            if (pkg) priceLocal = Number((pkg.priceMult * currentGeo.coinRate).toFixed(2));

            const res = await fetch('/api/paystack/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email || 'user@example.com',
                    amount: priceLocal,
                    coinsToCredit: coinAmount,
                    currency: currentGeo.currency,
                    userId: currentUser.uid,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to initialize payment with Paystack');

            if (data.authorizationUrl) {
                window.location.href = data.authorizationUrl;
            } else {
                throw new Error("No authorization URL returned from Paystack gateway");
            }
        } catch (error: any) {
            console.error("Purchase error:", error);
            toast({
                title: 'Checkout Error',
                description: error.message || 'There was an error initiating the Paystack checkout.',
                variant: 'destructive',
            });
            setIsPurchasing(null);
        }
    };

    const watchBankCode = form.watch('bankCode');
    const watchAccountNumber = form.watch('accountNumber');

    useEffect(() => {
        if (watchAccountNumber?.length >= 6 && watchBankCode) {
            setIsResolving(true);
            fetch(`/api/paystack/resolve-account?account_number=${watchAccountNumber}&bank_code=${watchBankCode}&country=${selectedCountry}`)
                .then(res => res.json())
                .then(data => {
                    setIsResolving(false);
                    if (data.verified) {
                        form.setValue('accountName', data.accountName, { shouldValidate: true });
                        form.clearErrors('accountNumber');
                    } else {
                        form.setError('accountNumber', { type: 'manual', message: data.error || 'Account could not be verified' });
                        form.setValue('accountName', '');
                    }
                })
                .catch(() => {
                    setIsResolving(false);
                    form.setError('accountNumber', { type: 'manual', message: 'Network error verifying account' });
                    form.setValue('accountName', '');
                });
        }
    }, [watchAccountNumber, watchBankCode, selectedCountry, form]);
    
    const onSubmitPayout = async (values: z.infer<typeof payoutFormSchema>) => {
        setIsPurchasing(-1);
        try {
            const res = await fetch('/api/paystack/payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.uid,
                    diamondAmount: values.diamondAmount,
                    bankCode: values.bankCode,
                    accountNumber: values.accountNumber,
                    accountName: values.accountName,
                    currency: currentGeo.currency
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit payout request');

            toast({ title: 'Global Payout Initiated! 🚀', description: data.message });
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payout Failed', description: error.message || 'Could not complete the payout request.' });
        } finally {
            setIsPurchasing(null);
        }
    };
    
    return (
        <main className="col-span-12 md:col-span-9 space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                        <Globe className="h-8 w-8 text-primary" /> Global Wallet
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage coins, earn diamonds, and request instant automated payouts worldwide.</p>
                </div>
                <div className="flex items-center gap-3 bg-muted/60 p-2.5 rounded-lg border w-full sm:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Country / Currency:</span>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-bold bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SUPPORTED_COUNTRIES.map(c => (
                                <SelectItem key={c.country} value={c.country} className="font-medium text-xs">
                                    {c.flag} {c.name} ({c.currency})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>
            
            <Tabs defaultValue="wallet" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="wallet" className="font-semibold">My Wallet & Coins</TabsTrigger>
                    <TabsTrigger value="creator" className="font-semibold">Earnings & Payouts</TabsTrigger>
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
                                     <Coins className="h-4 w-4 text-yellow-500" />
                                </CardHeader>
                                <CardContent>
                                     <div className="text-2xl font-bold">{(currentUser.coins || 0).toLocaleString()}</div>
                                     <p className="text-xs text-muted-foreground mt-1">Used for tipping and supporting creators.</p>
                                </CardContent>
                            </Card>
                             <Card className="bg-muted/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                     <CardTitle className="text-sm font-medium">Creator Earnings</CardTitle>
                                     <div className="bg-green-500/10 p-1.5 rounded-full"><Gem className="h-4 w-4 text-green-500" /></div>
                                </CardHeader>
                                <CardContent>
                                     <div className="text-2xl font-bold text-green-500">
                                        {currentGeo.symbol}{((currentUser.diamonds || 0) * currentGeo.diamondRate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                     </div>
                                     <p className="text-xs text-muted-foreground mt-1">Available to cash out ({currentGeo.currency} @ {(currentUser.diamonds || 0).toLocaleString()} Diamonds)</p>
                                </CardContent>
                            </Card>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" /> Purchase Coins ({currentGeo.currency})
                            </CardTitle>
                            <CardDescription>Select a package or enter a custom amount to checkout globally via Paystack.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {coinPackages.map(pkg => {
                                    const priceLocal = Number((pkg.priceMult * currentGeo.coinRate).toFixed(2));
                                    return (
                                        <Button
                                            key={pkg.coins}
                                            variant="outline"
                                            className="h-auto p-4 flex flex-col items-center gap-1.5 border-2 hover:border-primary transition-all"
                                            onClick={() => handlePurchase(pkg.coins)}
                                            disabled={isPurchasing !== null}
                                        >
                                            {isPurchasing === pkg.coins ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <Coins className="h-6 w-6 text-yellow-500" />
                                                        <span className="text-xl font-bold">{pkg.coins}</span>
                                                    </div>
                                                    <p className="text-sm font-semibold">{currentGeo.symbol}{priceLocal.toLocaleString()}</p>
                                                    {pkg.bonus && <p className="text-xs text-primary font-bold">{pkg.bonus}</p>}
                                                </>
                                            )}
                                        </Button>
                                    );
                                })}
                            </div>
                            
                            <div className="pt-4 border-t">
                                <h3 className="text-sm font-semibold mb-3">Custom Amount</h3>
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="flex-1 w-full space-y-1">
                                        <Label className="text-xs text-muted-foreground">Number of Coins ({currentGeo.symbol}{currentGeo.coinRate} each)</Label>
                                        <div className="relative">
                                            <Coins className="absolute left-3 top-3 h-4 w-4 text-yellow-500" />
                                            <Input 
                                                type="number" 
                                                min="1"
                                                placeholder="Enter amount..." 
                                                className="pl-9 font-medium"
                                                value={customCoinAmount}
                                                onChange={(e) => setCustomCoinAmount(e.target.value)}
                                                disabled={isPurchasing !== null}
                                            />
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={() => {
                                            const amt = parseInt(customCoinAmount);
                                            if (amt > 0) handlePurchase(amt);
                                        }} 
                                        disabled={isPurchasing !== null || !customCoinAmount || parseInt(customCoinAmount) <= 0}
                                        className="w-full sm:w-auto font-bold"
                                    >
                                        {isPurchasing === parseInt(customCoinAmount) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Pay {currentGeo.symbol}{Number((parseInt(customCoinAmount || '0') * currentGeo.coinRate).toFixed(2)).toLocaleString()}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader>
                            <CardTitle>Recent Purchases</CardTitle>
                            <CardDescription>Your recent coin purchases via Paystack.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : purchaseTxs.length > 0 ? (
                                <div className="space-y-4">
                                    {purchaseTxs.map(tx => {
                                        const displayAmt = tx.amount || tx.amountNaira || 0;
                                        const displayCurr = tx.currency || 'NGN';
                                        return (
                                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full"><PlusCircle className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
                                                    <div>
                                                        <p className="font-semibold flex items-center gap-2">
                                                            Coin Purchase ({displayCurr})
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-mono ${tx.status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>{tx.status || 'success'}</span>
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{formatTxTime(tx.time)}</p>
                                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 select-all">Ref: {tx.id}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-green-600 dark:text-green-400">+{tx.coinsAdded || 0} Coins</p>
                                                    <p className="text-xs text-muted-foreground font-medium">-{displayCurr} {displayAmt.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-center text-sm text-muted-foreground p-6">No purchase history.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="creator" className="mt-4 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Creator Earnings ({currentGeo.name})</CardTitle>
                                <CardDescription>Cash out your diamonds directly to your {currentGeo.name} bank account or mobile money.</CardDescription>
                            </CardHeader>
                             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <Card className="bg-blue-500/10 border-blue-500/20">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                         <CardTitle className="text-sm font-medium">Diamond Balance</CardTitle>
                                         <Gem className="h-4 w-4 text-blue-500" />
                                    </CardHeader>
                                    <CardContent>
                                         <div className="text-2xl font-bold">{(currentUser.diamonds || 0).toLocaleString()}</div>
                                         <p className="text-xs text-muted-foreground mt-1">
                                            Est. Payout: {currentGeo.symbol}{Number(((currentUser.diamonds || 0) * currentGeo.diamondRate).toFixed(2)).toLocaleString()} ({currentGeo.currency})
                                        </p>
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader>
                                         <CardTitle className="text-lg">Request Global Payout</CardTitle>
                                         <CardDescription>Minimum payout is {MINIMUM_PAYOUT_DIAMONDS} diamonds ({currentGeo.symbol}{Number((MINIMUM_PAYOUT_DIAMONDS * currentGeo.diamondRate).toFixed(2))}).</CardDescription>
                                         <div className="mt-3 p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                                             <span><strong>Ecosystem Split:</strong> 75% Creator Share | <strong>25% App Cut (Platform Fee)</strong></span>
                                             <span className="font-semibold">{currentGeo.symbol}{currentGeo.diamondRate} per Diamond</span>
                                         </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Form {...form}>
                                            <form onSubmit={form.handleSubmit(onSubmitPayout)} className="space-y-4">
                                                <FormField control={form.control} name="diamondAmount" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Diamonds to Cash Out</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="bankCode" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Select {currentGeo.name} Bank / Provider</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={`Select bank in ${currentGeo.name}`} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="max-h-[250px]">
                                                                {banks.length > 0 ? banks.map(b => (
                                                                    <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                                                                )) : (
                                                                    <SelectItem value="loading" disabled>Loading providers...</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Account / Mobile Number</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input placeholder={`Enter ${currentGeo.name} account / mobile number`} {...field} />
                                                                {isResolving && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="accountName" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Verified Account Holder</FormLabel>
                                                        <FormControl>
                                                            <Input readOnly placeholder="Verified holder name appears here" className="bg-muted font-semibold text-primary" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="submit" className="w-full font-bold" disabled={form.formState.isSubmitting}>
                                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                    Request Payout of {currentGeo.symbol}{Number((form.watch('diamondAmount') * currentGeo.diamondRate).toFixed(2)).toLocaleString()} ({currentGeo.currency})
                                                </Button>
                                            </form>
                                        </Form>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader><CardTitle>Recent Tips Received</CardTitle></CardHeader>
                                <CardContent>
                                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : earningTxs.length > 0 ? (
                                        <div className="space-y-4">
                                            {earningTxs.map(tx => (
                                                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-full"><ArrowDown className="h-5 w-5 text-pink-600 dark:text-pink-400" /></div>
                                                        <div>
                                                            <p className="font-semibold text-sm">
                                                                {tx.giftName && tx.giftEmoji 
                                                                    ? `Received ${tx.giftName} ${tx.giftEmoji} from ${tx.fromUserName}`
                                                                    : `Tip from ${tx.fromUserName}`}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{formatTxTime(tx.time)}</p>
                                                        </div>
                                                    </div>
                                                    <p className="font-bold text-pink-600 dark:text-pink-400 whitespace-nowrap">+{tx.diamonds} Diamonds</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-center text-sm text-muted-foreground p-6">No tips received yet.</p>}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Global Payout History</CardTitle></CardHeader>
                                <CardContent>
                                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : payoutTxs.length > 0 ? (
                                        <div className="space-y-4">
                                            {payoutTxs.map(tx => {
                                                const displayAmt = tx.amount || tx.amountNaira || 0;
                                                const displayCurr = tx.currency || 'NGN';
                                                const currObj = SUPPORTED_COUNTRIES.find(c => c.currency === displayCurr) || SUPPORTED_COUNTRIES[0];
                                                return (
                                                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                                                        <div className="flex items-center gap-3">
                                                             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full"><ArrowUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div>
                                                            <div>
                                                                <p className="font-semibold text-sm">Payout Request ({displayCurr})</p>
                                                                <p className="text-xs text-muted-foreground">{formatTxTime(tx.time)}</p>
                                                                <p className="text-[10px] font-mono text-muted-foreground mt-0.5 select-all">Ref: {tx.id}</p>
                                                            </div>
                                                        </div>
                                                        <div className='text-right'>
                                                            <p className="font-bold text-indigo-600 dark:text-indigo-400">-{currObj.symbol}{displayAmt.toLocaleString()}</p>
                                                            <p className="text-xs text-muted-foreground capitalize font-medium">{tx.status}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
