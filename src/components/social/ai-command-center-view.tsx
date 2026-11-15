'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Lightbulb, Wand2, BarChart3, Sparkles } from 'lucide-react';
import AssistantView from './assistant-view';
import IdeasView from './ideas-view';
import StoryGeneratorView from './story-generator-view';
import AppStatisticsView from './app-statistics-view';

export type AiSpaceTab = 'assistant' | 'story' | 'ideas' | 'stats';

export default function AICommandCenterView({
  currentUser,
  initialTab = 'assistant',
}: {
  isProfessional?: boolean;
  currentUser?: any;
  initialTab?: AiSpaceTab;
}) {
  const [activeTab, setActiveTab] = useState<AiSpaceTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="w-full space-y-6">
      {/* AI Space Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-950 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  AI Space
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  AI Command Hub
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Access Smart Assistant, Automated Storyteller, Idea Lab, and AI Insights in one unified space.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified AI Tools Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AiSpaceTab)}
        className="w-full space-y-5"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1.5 gap-1.5 bg-slate-900/90 border border-border/60 rounded-2xl">
          <TabsTrigger
            value="assistant"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Bot className="h-4 w-4 shrink-0" />
            <span className="truncate">Assistant</span>
          </TabsTrigger>

          <TabsTrigger
            value="story"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Wand2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Storyteller</span>
          </TabsTrigger>

          <TabsTrigger
            value="ideas"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <Lightbulb className="h-4 w-4 shrink-0" />
            <span className="truncate">Idea Lab</span>
          </TabsTrigger>

          <TabsTrigger
            value="stats"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="truncate">AI Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="mt-0 focus-visible:outline-none">
          <AssistantView />
        </TabsContent>

        <TabsContent value="story" className="mt-0 focus-visible:outline-none">
          <StoryGeneratorView currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="ideas" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-2xl border-border/60 shadow-lg">
            <CardHeader>
              <CardTitle>Impactful Ideas Lab</CardTitle>
              <CardDescription>
                Generate, share, and vote on creative ideas with AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IdeasView currentUser={currentUser} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-0 focus-visible:outline-none">
          <AppStatisticsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
