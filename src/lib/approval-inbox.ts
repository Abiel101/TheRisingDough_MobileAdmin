import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { listApprovalActivity, type ApprovalActivity } from "@/lib/workspace";

const SEEN_KEY = "approvalsSeenAt";

let nativeSeenAt = 0;

export async function getSeenAt(): Promise<number> {
  const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(SEEN_KEY) : await SecureStore.getItemAsync(SEEN_KEY);
  const stored = Number(raw);
  if (stored > 0) return stored;
  // First run: only approvals from now on count as new.
  const now = Date.now();
  await markSeen(now);
  return now;
}

export async function markSeen(at = Date.now()): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(SEEN_KEY, String(at));
  else await SecureStore.setItemAsync(SEEN_KEY, String(at));
  nativeSeenAt = at;
}

export function isUnseen(item: ApprovalActivity, seenAt: number): boolean {
  const eventTime = item.status === "approved" ? item.approvedAt : item.status === "declined" ? item.declinedAt : "";
  return Boolean(eventTime) && new Date(eventTime).getTime() > seenAt;
}

export async function countUnseenApprovals(): Promise<number> {
  const seenAt = Platform.OS === "web" ? await getSeenAt() : nativeSeenAt || await getSeenAt();
  const items = await listApprovalActivity();
  return items.filter((item) => isUnseen(item, seenAt)).length;
}
