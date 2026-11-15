'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { giftEventBroker, RawGiftBrokerEvent } from './gift-event-broker';

/**
 * LONKIND FRONTEND GIFT QUEUE & COMBO STACKING MANAGER
 * ====================================================
 * Prevents playing multiple heavy animations on top of each other when 50+ viewers
 * send gifts at the exact same second:
 *
 * 1. Single Fullscreen Stage Lock:
 *    Only ONE fullscreen gift takeover can occupy the stage at a time.
 *
 * 2. Real-Time Combo Coalescing & Stacking ("Alice sent Dragon x5" / "Alice + 49 others x50"):
 *    - If the incoming gift matches the currently playing gift (or an item already waiting in
 *      the queue), it STACKS onto that item (`combo += quantity`) instead of spawning a
 *      duplicate animation or bloating the queue with 50 separate playback cycles.
 *
 * 3. Priority Queue (VIP Value + FIFO):
 *    - Distinct gifts waiting in the queue are ordered by total coin value (`price * combo`)
 *      so whale takeovers rise to the front while preserving combo counts.
 *
 * 4. Dual TikTok Side-Banner Combo Slots:
 *    - Maintains up to 2 live combo pill slots on the left of the stream that tick up
 *      (`x1 -> x5 -> x50`) at 60 FPS without blocking the video feed.
 */

export interface QueuedGiftItem {
  queueId: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  price: number;
  videoUrl?: string;
  webmUrl?: string;
  lottieUrl?: string;
  svgaUrl?: string;
  isSuper?: boolean;
  /** Primary sender shown on the banner (e.g. "Alice") */
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  /** Stacked combo count (e.g. x5 when Alice sends 5, or x50 when 50 people send simultaneously) */
  combo: number;
  /** Unique sender names who contributed to this stacked burst */
  contributors: string[];
  /** Formatted display label, e.g. "Alice" or "Alice + 49 others" */
  displaySenderLabel: string;
  enqueuedAtMs: number;
  lastStackedAtMs: number;
}

export interface EnqueueGiftPayload {
  roomId: string;
  gift: {
    id: string;
    name: string;
    icon: string;
    price: number;
    isSuper?: boolean;
    videoUrl?: string;
    webmUrl?: string;
    lottieUrl?: string;
    svgaUrl?: string;
  };
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  quantity?: number;
}

function formatSenderLabel(primarySender: string, contributors: string[]): string {
  if (contributors.length <= 1) return primarySender;
  return `${primarySender} + ${contributors.length - 1} other${contributors.length - 1 === 1 ? '' : 's'}`;
}

export function useGiftQueueManager(roomId: string) {
  const [activeGift, setActiveGift] = useState<QueuedGiftItem | null>(null);
  const [queuedGifts, setQueuedGifts] = useState<QueuedGiftItem[]>([]);
  const [sideComboSlots, setSideComboSlots] = useState<QueuedGiftItem[]>([]);
  const [brokerStats, setBrokerStats] = useState(() => giftEventBroker.getTelemetry());

  const activeGiftRef = useRef<QueuedGiftItem | null>(null);
  const queueRef = useRef<QueuedGiftItem[]>([]);
  const slotTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    activeGiftRef.current = activeGift;
  }, [activeGift]);

  useEffect(() => {
    queueRef.current = queuedGifts;
  }, [queuedGifts]);

  /**
   * Updates the 2 TikTok-style side combo slots on the left edge of the stream.
   */
  const upsertSideComboSlot = useCallback((item: QueuedGiftItem) => {
    const slotKey = `${item.giftId}::${item.senderName}`;
    setSideComboSlots((prev) => {
      const existingIdx = prev.findIndex((s) => s.giftId === item.giftId);
      let next: QueuedGiftItem[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...item };
      } else {
        next = [{ ...item }, ...prev].slice(0, 2);
      }
      return next;
    });

    const prevTimer = slotTimersRef.current.get(slotKey);
    if (prevTimer) clearTimeout(prevTimer);
    const timer = setTimeout(() => {
      setSideComboSlots((prev) => prev.filter((s) => s.queueId !== item.queueId));
      slotTimersRef.current.delete(slotKey);
    }, 4500);
    slotTimersRef.current.set(slotKey, timer);
  }, []);

  /**
   * Enqueues or stacks a gift event.
   * If 50 people send "Dragon" at the exact same second, all 50 are coalesced into
   * a single stacked combo (`x50`) instead of playing 50 overlapping animations!
   */
  const enqueueGift = useCallback(
    (payload: EnqueueGiftPayload): QueuedGiftItem => {
      const qty = Math.max(1, payload.quantity || 1);
      const now = Date.now();

      // 1. Publish into the partitioned Kafka-style Gift Event Broker
      const brokerEvent: RawGiftBrokerEvent = {
        eventId: `evt_${now}_${Math.random().toString(36).slice(2, 7)}`,
        idempotencyKey: `${payload.roomId}_${payload.senderId}_${payload.gift.id}_${now}`,
        roomId: payload.roomId || roomId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        senderAvatar: payload.senderAvatar,
        recipientId: payload.roomId || roomId,
        giftId: payload.gift.id,
        giftName: payload.gift.name,
        giftIcon: payload.gift.icon,
        unitPrice: payload.gift.price,
        quantity: qty,
        timestampMs: now,
      };
      giftEventBroker.publish(brokerEvent, 'per-gift-burst');
      setBrokerStats(giftEventBroker.getTelemetry());

      // Standard gifts (Rose, Finger Heart, Perfume, Ring, etc.) ONLY show in the bottom Live Chat comment feed
      // Only Top-Tier gifts (`isSuper: true`, e.g. Majestic Lion) play on the stream stage!
      if (!payload.gift.isSuper) {
        return {
          queueId: `chat_only_${payload.gift.id}_${now}`,
          giftId: payload.gift.id,
          giftName: payload.gift.name,
          giftIcon: payload.gift.icon,
          price: payload.gift.price,
          isSuper: false,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          combo: qty,
          contributors: [payload.senderName],
          displaySenderLabel: payload.senderName,
          enqueuedAtMs: now,
          lastStackedAtMs: now,
        };
      }

      // 2. Check if this exact top-tier gift is ALREADY playing on the active fullscreen stage
      const currentActive = activeGiftRef.current;
      if (currentActive && currentActive.giftId === payload.gift.id) {
        const updatedContributors = currentActive.contributors.includes(payload.senderName)
          ? currentActive.contributors
          : [...currentActive.contributors, payload.senderName];

        const stackedActive: QueuedGiftItem = {
          ...currentActive,
          combo: currentActive.combo + qty,
          contributors: updatedContributors,
          displaySenderLabel: formatSenderLabel(currentActive.senderName, updatedContributors),
          lastStackedAtMs: now,
        };

        activeGiftRef.current = stackedActive;
        setActiveGift(stackedActive);
        upsertSideComboSlot(stackedActive);
        return stackedActive;
      }

      // 3. If NO gift is currently playing on the stage, launch immediately on the stage!
      if (!currentActive) {
        const freshItem: QueuedGiftItem = {
          queueId: `q_${payload.gift.id}_${now}_${Math.random().toString(36).slice(2, 6)}`,
          giftId: payload.gift.id,
          giftName: payload.gift.name,
          giftIcon: payload.gift.icon,
          price: payload.gift.price,
          videoUrl: payload.gift.videoUrl,
          webmUrl: payload.gift.webmUrl,
          lottieUrl: payload.gift.lottieUrl,
          svgaUrl: payload.gift.svgaUrl,
          isSuper: payload.gift.isSuper,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          combo: qty,
          contributors: [payload.senderName],
          displaySenderLabel: payload.senderName,
          enqueuedAtMs: now,
          lastStackedAtMs: now,
        };

        activeGiftRef.current = freshItem;
        setActiveGift(freshItem);
        upsertSideComboSlot(freshItem);
        return freshItem;
      }

      // 4. Another gift is currently playing on stage -> Check if this gift is ALREADY in `queueRef`
      const currentQueue = [...queueRef.current];
      const existingIndex = currentQueue.findIndex((item) => item.giftId === payload.gift.id);

      let targetItem: QueuedGiftItem;
      if (existingIndex >= 0) {
        // Stack onto the existing queued item!
        const existing = currentQueue[existingIndex];
        const updatedContributors = existing.contributors.includes(payload.senderName)
          ? existing.contributors
          : [...existing.contributors, payload.senderName];

        targetItem = {
          ...existing,
          combo: existing.combo + qty,
          contributors: updatedContributors,
          displaySenderLabel: formatSenderLabel(existing.senderName, updatedContributors),
          lastStackedAtMs: now,
        };
        currentQueue[existingIndex] = targetItem;
      } else {
        // Create a new queued slot
        targetItem = {
          queueId: `q_${payload.gift.id}_${now}_${Math.random().toString(36).slice(2, 6)}`,
          giftId: payload.gift.id,
          giftName: payload.gift.name,
          giftIcon: payload.gift.icon,
          price: payload.gift.price,
          videoUrl: payload.gift.videoUrl,
          webmUrl: payload.gift.webmUrl,
          lottieUrl: payload.gift.lottieUrl,
          svgaUrl: payload.gift.svgaUrl,
          isSuper: payload.gift.isSuper,
          senderId: payload.senderId,
          senderName: payload.senderName,
          senderAvatar: payload.senderAvatar,
          combo: qty,
          contributors: [payload.senderName],
          displaySenderLabel: payload.senderName,
          enqueuedAtMs: now,
          lastStackedAtMs: now,
        };
        currentQueue.push(targetItem);
      }

      // Sort priority queue by total stacked coin value descending, then FIFO
      currentQueue.sort((a, b) => {
        const valDiff = b.price * b.combo - a.price * a.combo;
        if (valDiff !== 0) return valDiff;
        return a.enqueuedAtMs - b.enqueuedAtMs;
      });

      queueRef.current = currentQueue;
      setQueuedGifts(currentQueue);
      upsertSideComboSlot(targetItem);
      return targetItem;
    },
    [roomId, upsertSideComboSlot]
  );

  /**
   * Called when the current fullscreen gift takeover finishes playing (`onComplete`).
   * Automatically pops the next stacked gift from the priority queue and clears the finished side banner!
   */
  const completeActiveGift = useCallback(() => {
    const finished = activeGiftRef.current;
    if (finished) {
      setSideComboSlots((prev) =>
        prev.filter((s) => s.queueId !== finished.queueId && s.giftId !== finished.giftId)
      );
    }
    const nextQueue = [...queueRef.current];
    const nextItem = nextQueue.shift() || null;
    queueRef.current = nextQueue;
    activeGiftRef.current = nextItem;
    setQueuedGifts(nextQueue);
    setActiveGift(nextItem);
  }, []);

  /**
   * Clears all active and queued gifts + side combo banners when a stream ends or restarts.
   */
  const resetGiftQueue = useCallback(() => {
    slotTimersRef.current.forEach((t) => clearTimeout(t));
    slotTimersRef.current.clear();
    queueRef.current = [];
    activeGiftRef.current = null;
    setQueuedGifts([]);
    setActiveGift(null);
    setSideComboSlots([]);
  }, []);

  /**
   * Stress-test helper: Simulates N simultaneous gift events arriving in a viral burst
   * (e.g. "Alice sent Dragon x5" or 50 viewers sending Dragon at the exact same second).
   */
  const simulateSimultaneousBurst = useCallback(
    (
      gift: EnqueueGiftPayload['gift'],
      count = 50,
      mode: 'same-sender' | 'multi-viewer' = 'same-sender',
      primaryName = 'Alice'
    ) => {
      const sampleNames = [
        primaryName,
        'Kofi_VIP',
        'Zainab_Queen',
        'Tunde_Whale',
        'Amara_Gold',
        'Devon_X',
        'Chidi_99',
        'Nadia_Star',
        'Kwame_Boss',
        'Layla_Live',
      ];

      for (let i = 0; i < count; i++) {
        const sName =
          mode === 'same-sender'
            ? primaryName
            : i === 0
            ? primaryName
            : `${sampleNames[i % sampleNames.length]}_${i}`;
        enqueueGift({
          roomId,
          gift,
          senderId: `sim_${sName}`,
          senderName: sName,
          quantity: 1,
        });
      }
    },
    [enqueueGift, roomId]
  );

  useEffect(() => {
    const timers = slotTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return {
    activeGift,
    queuedGifts,
    sideComboSlots,
    brokerStats,
    enqueueGift,
    completeActiveGift,
    resetGiftQueue,
    simulateSimultaneousBurst,
  };
}
