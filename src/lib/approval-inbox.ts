import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  listApprovalActivity,
  listHolidayRequestActivity,
  type ApprovalActivity,
  type HolidayRequestActivity,
} from "@/lib/workspace";

// Items older than these first-run baselines never count as notifications.
const SEEN_KEY = "approvalsSeenAt";
const HOLIDAY_REQUESTS_SEEN_KEY = "holidayRequestsSeenAt";
const READ_KEYS_KEY = "inboxReadKeys";
const MAX_READ_KEYS = 40;

async function readStored(key: string): Promise<string | null> {
  return Platform.OS === "web" ? (globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key);
}

async function writeStored(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function getBaseline(key: string): Promise<number> {
  const stored = Number(await readStored(key));
  if (stored > 0) return stored;
  const now = Date.now();
  await writeStored(key, String(now));
  return now;
}

let readKeys: Set<string> | null = null;
const listeners = new Set<() => void>();

async function loadReadKeys(): Promise<Set<string>> {
  if (readKeys) return readKeys;
  try {
    const parsed: unknown = JSON.parse((await readStored(READ_KEYS_KEY)) ?? "[]");
    readKeys = new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : []);
  } catch {
    readKeys = new Set();
  }
  return readKeys;
}

async function addReadKeys(additions: string[]): Promise<void> {
  const keys = await loadReadKeys();
  const next = new Set(keys);
  additions.forEach((key) => next.add(key));
  if (next.size === keys.size) return;
  // Oldest entries are dropped first; Set preserves insertion order.
  const recent = [...next].slice(-MAX_READ_KEYS);
  readKeys = new Set(recent);
  listeners.forEach((listener) => listener());
  await writeStored(READ_KEYS_KEY, JSON.stringify(recent));
}

/** Calls `listener` whenever a notification is marked read, so badges update immediately. */
export function subscribeToInbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const requestKey = (id: string) => `request:${id}`;
const approvalKey = (id: string) => `approval:${id}`;

export const markRequestRead = (id: string) => addReadKeys([requestKey(id)]);
export const markApprovalRead = (orderId: string) => addReadKeys([approvalKey(orderId)]);

export type InboxSnapshot = {
  approvals: ApprovalActivity[];
  requests: HolidayRequestActivity[];
  /** Ids of pending website requests that have not been opened yet. */
  unreadRequestIds: Set<string>;
  /** Ids of approved or declined orders whose result has not been opened yet. */
  unreadApprovalIds: Set<string>;
};

export async function loadInbox(): Promise<InboxSnapshot> {
  const [approvalsSeenAt, requestsSeenAt, read, approvals, requests] = await Promise.all([
    getBaseline(SEEN_KEY),
    getBaseline(HOLIDAY_REQUESTS_SEEN_KEY),
    loadReadKeys(),
    listApprovalActivity(),
    listHolidayRequestActivity(),
  ]);
  const unreadRequestIds = new Set(
    requests
      .filter((item) => item.status === "pending" && new Date(item.createdAt).getTime() > requestsSeenAt && !read.has(requestKey(item.id)))
      .map((item) => item.id),
  );
  const unreadApprovalIds = new Set(
    approvals
      .filter((item) => {
        const eventTime = item.status === "approved" ? item.approvedAt : item.status === "declined" ? item.declinedAt : "";
        return Boolean(eventTime) && new Date(eventTime).getTime() > approvalsSeenAt && !read.has(approvalKey(item.id));
      })
      .map((item) => item.id),
  );
  return { approvals, requests, unreadRequestIds, unreadApprovalIds };
}

export async function countUnseenNotifications(): Promise<number> {
  const { unreadRequestIds, unreadApprovalIds } = await loadInbox();
  return unreadRequestIds.size + unreadApprovalIds.size;
}

export const markAllRead = (snapshot: InboxSnapshot) =>
  addReadKeys([...[...snapshot.unreadRequestIds].map(requestKey), ...[...snapshot.unreadApprovalIds].map(approvalKey)]);
