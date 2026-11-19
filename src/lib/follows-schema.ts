import { z } from 'zod';

/**
 * ============================================================================
 * LONKIND FOLLOWER REQUESTS & PRIVACY DATABASE SCHEMA
 * ============================================================================
 *
 * Relational / Firestore Collection Mapping:
 *
 * 1. `users` collection (`users/{uid}`)
 *    - uid: string (PK)
 *    - name: string
 *    - handle: string (unique lowercase username)
 *    - avatarUrl: string
 *    - isPrivateAccount: boolean   // Master "Private Account" toggle
 *    - followerPrivacy: 'public' | 'private'
 *    - friendsCount: number
 *    - followersCount: number
 *
 * 2. `follows` collection (`follows/{followerId}_{targetUserId}`)
 *    - id: `${followerId}_${targetUserId}` (Composite PK)
 *    - followerId: string (FK -> users.uid)
 *    - targetUserId: string (FK -> users.uid)
 *    - status: 'PENDING' | 'ACCEPTED' | 'BLOCKED'
 *    - createdAt: Timestamp
 *    - updatedAt: Timestamp
 *
 *    Mirrored into user subcollections for real-time client listeners:
 *    - PENDING  -> `users/{targetUserId}/friendRequests/{followerId}`
 *    - ACCEPTED -> `users/{targetUserId}/friends/{followerId}`
 *    - BLOCKED  -> `users/{targetUserId}/blockedUsers/{followerId}`
 */

export const FollowStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'BLOCKED']);
export type FollowStatus = z.infer<typeof FollowStatusEnum>;

export interface UserPrivacyRecord {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isProfessional?: boolean;
  isPrivateAccount: boolean;
  followerPrivacy: 'public' | 'private';
  friendsCount: number;
}

export interface FollowRecord {
  id: string;
  followerId: string;
  targetUserId: string;
  status: FollowStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface FollowerListItem {
  uid: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isProfessional?: boolean;
  status: FollowStatus;
  mutualCount: number;
  requestedAtMs: number;
}

export interface PaginatedFollowersResponse {
  items: FollowerListItem[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  counts: {
    pending: number;
    accepted: number;
    blocked: number;
  };
  isPrivateAccount: boolean;
}

export const FollowerActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('toggle_private'),
    privateAccount: z.boolean(),
    autoApprovePending: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('confirm'),
    followerUid: z.string().min(1),
  }),
  z.object({
    action: z.literal('decline'),
    followerUid: z.string().min(1),
  }),
  z.object({
    action: z.literal('approve_all'),
  }),
  z.object({
    action: z.literal('decline_all'),
  }),
  z.object({
    action: z.literal('remove_follower'),
    followerUid: z.string().min(1),
  }),
  z.object({
    action: z.literal('block_user'),
    targetUid: z.string().min(1),
    name: z.string().optional(),
    handle: z.string().optional(),
  }),
  z.object({
    action: z.literal('unblock_user'),
    targetUid: z.string().min(1),
  }),
]);

export type FollowerActionPayload = z.infer<typeof FollowerActionSchema>;
