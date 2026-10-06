'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { Loader2, Send, Newspaper, MessageSquare, Bot, Sparkles, RefreshCw, PhoneCall, ShieldCheck, CheckCircle2, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AutoNewsBotView() {
  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Systematic Messenger State
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [isBroadcast, setIsBroadcast] = useState(false);

  // Bot Logs
  const [botLogs, setBotLogs] = useState<any[]>([]);

  const fetchBotLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/twilio/auto-messenger');
      const data = await res.json();
      if (data.success && data.recentLogs) {
        setBotLogs(data.recentLogs);
      }
    } catch (err) {
      console.error('Error loading bot logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchBotLogs();
  }, []);

  const handleRunAutoNewsBot = async () => {
    setIsGeneratingNews(true);
    try {
      const res = await fetch('/api/news-reporter', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Auto news reporter failed.');
      }

      toast({
        title: '📰 Auto News Bot Published!',
        description: 'Latest tech news generated & posted to feed, with Twilio alerts dispatched.',
      });

      fetchBotLogs();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Auto News Bot Error',
        description: err.message || 'Could not execute auto news bot.',
      });
    } finally {
      setIsGeneratingNews(false);
    }
  };

  const handleSendSystematicMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim() && !isBroadcast) {
      toast({ variant: 'destructive', title: 'Message Required', description: 'Please type a message to send.' });
      return;
    }

    setIsSendingMessage(true);
    try {
      const res = await fetch('/api/twilio/auto-messenger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone,
          message: customMessage,
          channel,
          isBroadcast,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to dispatch systematic bot message.');
      }

      toast({
        title: '📱 Message Dispatched via Twilio!',
        description: data.message,
      });

      setCustomMessage('');
      fetchBotLogs();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Twilio Bot Error',
        description: err.message || 'Message dispatch failed.',
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center shadow-md text-white">
                <Bot className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Auto News Reporter & Systematic Messaging Bot</CardTitle>
                <CardDescription>Powered by AI News Aggregation & Twilio SMS / WhatsApp API</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1.5 py-1 px-3">
              <ShieldCheck className="h-3.5 w-3.5" /> Twilio Integrated
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Action Hub Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Auto News Reporter Bot */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/60 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Newspaper className="h-4 w-4 text-emerald-500" />
                <span>Autonomous News Reporter Bot</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fetches live tech & startup news via Serper API, compiles Gemini AI summaries, posts directly to the timeline feed, and dispatches Twilio SMS alerts.
              </p>
              <Button
                onClick={handleRunAutoNewsBot}
                disabled={isGeneratingNews}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-sm"
              >
                {isGeneratingNews ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Aggregating & Broadcasting News...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Trigger Auto News Bot Now
                  </>
                )}
              </Button>
            </div>

            {/* Box 2: Systematic Messaging Bot Quick Stat */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/60 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span>Twilio Systematic Bot Status</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send automatic SMS & WhatsApp alerts to individual users or broadcast news digests systematically.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 p-2 rounded-lg bg-background border text-center">
                  <span className="text-xs text-muted-foreground block">Webhook URL</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold truncate block">/api/twilio/webhook</span>
                </div>
                <div className="flex-1 p-2 rounded-lg bg-background border text-center">
                  <span className="text-xs text-muted-foreground block">Channel</span>
                  <span className="text-[11px] font-mono text-indigo-400 font-semibold truncate block">SMS + WhatsApp</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Form Tabs */}
          <Tabs defaultValue="send-message" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send-message" className="gap-2">
                <Send className="h-4 w-4" /> Systematic Auto Messaging
              </TabsTrigger>
              <TabsTrigger value="bot-logs" className="gap-2">
                <History className="h-4 w-4" /> Twilio Bot Activity Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send-message" className="pt-4">
              <form onSubmit={handleSendSystematicMessage} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="broadcast-check"
                      checked={isBroadcast}
                      onChange={(e) => setIsBroadcast(e.target.checked)}
                      className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <Label htmlFor="broadcast-check" className="text-xs font-medium cursor-pointer">
                      Broadcast to all news subscribers
                    </Label>
                  </div>
                </div>

                {!isBroadcast && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Recipient Phone Number (with Country Code)</Label>
                    <Input
                      placeholder="+2348012345678 or +12025550123"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="bg-secondary/40 border-border text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Channel Type</Label>
                  <RadioGroup value={channel} onValueChange={(val: any) => setChannel(val)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="r-sms" />
                      <Label htmlFor="r-sms" className="text-xs cursor-pointer">Twilio SMS</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="whatsapp" id="r-wa" />
                      <Label htmlFor="r-wa" className="text-xs cursor-pointer">Twilio WhatsApp</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Automated Message Content</Label>
                  <Textarea
                    placeholder="Enter systematic message to dispatch..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="bg-secondary/40 border-border text-sm min-h-[100px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSendingMessage}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-2 shadow-sm"
                >
                  {isSendingMessage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Dispatching via Twilio...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Dispatch Systematic Bot Message
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="bot-logs" className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Bot Events</span>
                <Button variant="ghost" size="sm" onClick={fetchBotLogs} disabled={isLoadingLogs} className="h-7 text-xs gap-1">
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {botLogs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">No Twilio bot logs recorded yet.</div>
                ) : (
                  botLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-emerald-500" /> {log.botName || 'Twilio Bot'}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.channel || log.type || 'bot_action'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">{log.content || log.message || log.incomingMessage}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>Status: {log.simulated ? 'Simulated' : log.success ? 'Success' : 'Queued'}</span>
                        <span>{log.timestamp ? formatDistanceToNow(log.timestamp.toDate ? log.timestamp.toDate() : new Date(), { addSuffix: true }) : 'Just now'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
