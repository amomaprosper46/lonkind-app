
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AppStatisticsView() {
    const [userCount, setUserCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserCount = async () => {
            setIsLoading(true);
            try {
                const usersCollectionRef = collection(db, 'users');
                const snapshot = await getDocs(usersCollectionRef);
                setUserCount(snapshot.size);
            } catch (error) {
                console.error("Error fetching user count:", error);
                setUserCount(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserCount();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>App Statistics</CardTitle>
                <CardDescription>A real-time overview of your application's user base.</CardDescription>
            </CardHeader>
            <CardContent>
                <Card className="w-full max-w-xs">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Users
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center py-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="text-4xl font-bold">
                                {userCount?.toLocaleString() ?? '0'}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground pt-2">
                            Total number of registered accounts.
                        </p>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}
