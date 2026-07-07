'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Lightbulb, Mic, Wand2, BarChart3, Lock, Image as ImageIcon, Film } from 'lucide-react';
import AssistantView from './assistant-view';
import IdeasView from './ideas-view';
import StoryGeneratorView from './story-generator-view';
import AppStatisticsView from './app-statistics-view';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// A helper to wrap disabled tabs with a tooltip
const ProFeatureTab = ({ value, children, isProfessional }: { value: string, children: React.ReactNode, isProfessional: boolean }) => {
    if (isProfessional) {
        return <TabsTrigger value={value}>{children}</TabsTrigger>;
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="relative">
                    <TabsTrigger value={value} disabled className="text-muted-foreground/50">
                        <Lock className="absolute h-3 w-3 top-1 right-1" />
                        {children}
                    </TabsTrigger>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>This is a Professional account feature.</p>
            </TooltipContent>
        </Tooltip>
    );
};


export default function AICommandCenterView({ isProfessional, currentUser }: { isProfessional?: boolean, currentUser?: any }) {
    return (
        <main className="col-span-9 space-y-8">
            <header>
                <h1 className="text-4xl font-bold">AI Command Center</h1>
                <p className="text-muted-foreground mt-2">
                    All of your AI-powered tools in one place. Professional features are locked for standard accounts.
                </p>
            </header>
            <TooltipProvider>
                <Tabs defaultValue="assistant" className="w-full">
                    <TabsList className="grid w-full grid-cols-9">
                        <TabsTrigger value="assistant">
                            <Bot className="mr-2 h-4 w-4" />
                            Assistant
                        </TabsTrigger>
                        <ProFeatureTab value="ideas" isProfessional={!!isProfessional}>
                            <Lightbulb className="mr-2 h-4 w-4" />
                            Ideas
                        </ProFeatureTab>
                         <ProFeatureTab value="story" isProfessional={!!isProfessional}>
                            <Wand2 className="mr-2 h-4 w-4" />
                            Story
                        </ProFeatureTab>
                         <ProFeatureTab value="stats" isProfessional={!!isProfessional}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Stats
                        </ProFeatureTab>
                    </TabsList>

                    <TabsContent value="assistant" className="mt-4">
                        <AssistantView />
                    </TabsContent>
                    <TabsContent value="ideas" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Impactful Ideas</CardTitle>
                                <CardDescription>Generate, share, and vote on ideas that can change the world.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <IdeasView currentUser={currentUser} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="story" className="mt-4">
                        <StoryGeneratorView currentUser={currentUser} />
                    </TabsContent>
                    <TabsContent value="stats" className="mt-4">
                        <AppStatisticsView />
                    </TabsContent>
                </Tabs>
            </TooltipProvider>
        </main>
    );
}
