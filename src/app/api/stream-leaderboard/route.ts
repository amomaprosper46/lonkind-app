import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { redisStreamLeaderboard } from '@/lib/redis-leaderboard';

const processedLeaderboardIdemKeys = new Set<string>();

const ZincrbyPayloadSchema = z.object({
  roomId: z.string().trim().min(1).default('room_123'),
  member: z.string().trim().min(1),
  coins: z.number().positive().max(200000),
  uid: z.string().optional(),
  avatarUrl: z.string().optional(),
  giftName: z.string().optional(),
  giftIcon: z.string().optional(),
  idempotencyKey: z.string().trim().optional(),
  batchEntries: z
    .array(
      z.object({
        member: z.string().trim().min(1),
        coins: z.number().positive().max(200000),
        uid: z.string().optional(),
        avatarUrl: z.string().optional(),
        giftName: z.string().optional(),
        giftIcon: z.string().optional(),
      })
    )
    .max(50)
    .optional(),
});

/**
 * GET /api/stream-leaderboard?roomId=room_123&member=Alice
 * Fetches Top 3 Gifters (`ZREVRANGE stream:leaderboard:room_123 0 2 WITHSCORES`)
 * and Top 25 rankings from the Redis Sorted Set with ZERO strain on the primary database.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId') || 'room_123';
    const member = searchParams.get('member') || undefined;
    const topLimit = Math.min(50, Math.max(3, Number(searchParams.get('top')) || 25));

    const snapshot = await redisStreamLeaderboard.getRoomLeaderboardSnapshot(
      roomId,
      member,
      topLimit
    );

    return NextResponse.json({
      success: true,
      ...snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to read Redis Sorted Set leaderboard.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stream-leaderboard
 * Executes `ZINCRBY stream:leaderboard:<roomId> <coins> "<member>"`
 * Returns updated Top 3 Gifters (`ZREVRANGE ... 0 2 WITHSCORES`) and rank telemetry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ZincrbyPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ZINCRBY payload.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      roomId,
      member,
      coins,
      uid,
      avatarUrl,
      giftName,
      giftIcon,
      idempotencyKey,
      batchEntries,
    } = parsed.data;

    // Idempotency check: if client retried after network drop with the same idempotencyKey,
    // return the current snapshot without double-incrementing ZINCRBY!
    if (idempotencyKey && processedLeaderboardIdemKeys.has(idempotencyKey)) {
      const snapshot = await redisStreamLeaderboard.getRoomLeaderboardSnapshot(roomId, member, 25);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        idempotencyKey,
        result: {
          key: snapshot.key,
          command: `IDEMPOTENT_SKIP (Key ${idempotencyKey} already applied)`,
          readCommand: snapshot.top3Command,
          member,
          incrementBy: 0,
          newScore: snapshot.viewer?.score || 0,
          rank: snapshot.viewer?.rank || 1,
          top3: snapshot.top3,
          topContributors: snapshot.topContributors,
          totalContributors: snapshot.totalContributors,
        },
        ...snapshot,
      });
    }

    if (idempotencyKey) {
      processedLeaderboardIdemKeys.add(idempotencyKey);
    }

    // Support pipelined multi-viewer ZINCRBY bursts (e.g. 50 viewers or competitive overtake simulation)
    if (batchEntries && batchEntries.length > 0) {
      let lastResult = null;
      for (const item of batchEntries) {
        lastResult = await redisStreamLeaderboard.zincrby(roomId, item.coins, item.member, {
          uid: item.uid,
          name: item.member,
          avatarUrl: item.avatarUrl,
          lastGiftName: item.giftName || giftName,
          lastGiftIcon: item.giftIcon || giftIcon,
        });
      }
      const snapshot = await redisStreamLeaderboard.getRoomLeaderboardSnapshot(roomId, member, 25);
      return NextResponse.json({
        success: true,
        alreadyProcessed: false,
        idempotencyKey,
        result: lastResult,
        ...snapshot,
      });
    }

    const result = await redisStreamLeaderboard.zincrby(roomId, coins, member, {
      uid,
      name: member,
      avatarUrl,
      lastGiftName: giftName,
      lastGiftIcon: giftIcon,
    });

    const snapshot = await redisStreamLeaderboard.getRoomLeaderboardSnapshot(roomId, member, 25);

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      idempotencyKey,
      result,
      ...snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to execute Redis ZINCRBY.' },
      { status: 500 }
    );
  }
}
