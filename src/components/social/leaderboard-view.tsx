import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Star, TrendingUp, HeartHandshake } from 'lucide-react';
import Link from 'next/link';

interface LeaderboardUser {
    uid: string;
    name: string;
    handle: string;
    avatarUrl: string;
    lifetimeTipsReceived?: number;
    lifetimeTipsGiven?: number;
    badges?: string[];
}

export default function LeaderboardView() {
    const [topCreators, setTopCreators] = useState<LeaderboardUser[]>([]);
    const [topSupporters, setTopSupporters] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaderboards() {
            try {
                // Fetch Top Creators
                const creatorsQuery = query(collection(db, 'users'), orderBy('lifetimeTipsReceived', 'desc'), limit(10));
                const creatorsSnapshot = await getDocs(creatorsQuery);
                const creators = creatorsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as LeaderboardUser));
                
                // Fetch Top Supporters
                const supportersQuery = query(collection(db, 'users'), orderBy('lifetimeTipsGiven', 'desc'), limit(10));
                const supportersSnapshot = await getDocs(supportersQuery);
                const supporters = supportersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as LeaderboardUser));

                setTopCreators(creators.filter(c => c.lifetimeTipsReceived && c.lifetimeTipsReceived > 0));
                setTopSupporters(supporters.filter(s => s.lifetimeTipsGiven && s.lifetimeTipsGiven > 0));
            } catch (error) {
                console.error("Error fetching leaderboards:", error);
            } finally {
                setLoading(false);
            }
        }
        
        fetchLeaderboards();
    }, []);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
        if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
        if (index === 2) return <Medal className="h-6 w-6 text-amber-600" />;
        return <span className="text-lg font-bold text-muted-foreground w-6 text-center">{index + 1}</span>;
    };

    const renderUserList = (users: LeaderboardUser[], type: 'creator' | 'supporter') => {
        if (loading) {
            return <div className="p-8 text-center text-muted-foreground">Loading leaderboard...</div>;
        }
        
        if (users.length === 0) {
            return <div className="p-8 text-center text-muted-foreground">No data available yet. Start tipping to climb the ranks!</div>;
        }

        return (
            <div className="space-y-4 mt-4">
                {users.map((user, index) => (
                    <div key={user.uid} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8">
                                {getRankIcon(index)}
                            </div>
                            <Link href={`/profile/${user.handle}`}>
                                <Avatar className="h-12 w-12 border-2 border-primary/20">
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </Link>
                            <div>
                                <Link href={`/profile/${user.handle}`} className="font-semibold hover:underline flex items-center gap-2">
                                    {user.name}
                                    {user.badges?.includes(type === 'creator' ? 'Top Creator' : 'Top Supporter') && (
                                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                    )}
                                </Link>
                                <p className="text-sm text-muted-foreground">@{user.handle}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-lg text-primary flex items-center gap-1 justify-end">
                                {type === 'creator' ? (
                                    <><TrendingUp className="h-4 w-4" /> {user.lifetimeTipsReceived?.toLocaleString()}</>
                                ) : (
                                    <><HeartHandshake className="h-4 w-4" /> {user.lifetimeTipsGiven?.toLocaleString()}</>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">Coins {type === 'creator' ? 'Earned' : 'Given'}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Card className="col-span-9 border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                    Global Leaderboard
                </CardTitle>
                <CardDescription>
                    Discover the most impactful creators and generous supporters on Lonkind.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <Tabs defaultValue="creators" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="creators">Top Creators</TabsTrigger>
                        <TabsTrigger value="supporters">Top Supporters</TabsTrigger>
                    </TabsList>
                    <TabsContent value="creators">
                        {renderUserList(topCreators, 'creator')}
                    </TabsContent>
                    <TabsContent value="supporters">
                        {renderUserList(topSupporters, 'supporter')}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
