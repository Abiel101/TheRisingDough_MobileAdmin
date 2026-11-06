import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  listApprovalActivity,
  listHolidayRequestActivity,
  type ApprovalActivity,
  type HolidayRequestActivity,
} from "@/lib/workspace";

const SEEN_KEY = "approvalsSeenAt";
const HOLIDAY_REQUESTS_SEEN_KEY = "holidayRequestsSeenAt";

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

export async function getHolidayRequestsSeenAt(): Promise<number> {
  const raw = Platform.OS === "web"
    ? globalThis.localStorage?.getItem(HOLIDAY_REQUESTS_SEEN_KEY)
    : await SecureStore.getItemAsync(HOLIDAY_REQUESTS_SEEN_KEY);
  const stored = Number(raw);
  if (stored > 0) return stored;
  const now = Date.now();
  await markHolidayRequestsSeen(now);
  return now;
}

export async function markHolidayRequestsSeen(at = Date.now()): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(HOLIDAY_REQUESTS_SEEN_KEY, String(at));
  else await SecureStore.setItemAsync(HOLIDAY_REQUESTS_SEEN_KEY, String(at));
}

export function isUnseen(item: ApprovalActivity, seenAt: number): boolean {
  const eventTime = item.status === "approved" ? item.approvedAt : item.status === "declined" ? item.declinedAt : "";
  return Boolean(eventTime) && new Date(eventTime).getTime() > seenAt;
}

export function isUnseenHolidayRequest(item: HolidayRequestActivity, seenAt: number): boolean {
  return new Date(item.createdAt).getTime() > seenAt;
}

export async function countUnseenNotifications(): Promise<number> {
  const [seenAt, requestsSeenAt, approvals, requests] = await Promise.all([
    Platform.OS === "web" ? getSeenAt() : nativeSeenAt || getSeenAt(),
    getHolidayRequestsSeenAt(),
    listApprovalActivity(),
    listHolidayRequestActivity(),
  ]);
  return approvals.filter((item) => isUnseen(item, seenAt)).length
    + requests.filter((item) => isUnseenHolidayRequest(item, requestsSeenAt)).length;
}
