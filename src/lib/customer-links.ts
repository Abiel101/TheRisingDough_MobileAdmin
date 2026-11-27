import { Platform } from "react-native";

const baseUrl = (process.env.EXPO_PUBLIC_APPROVAL_BASE_URL ?? "").trim().replace(/\/+$/, "");

function origin() {
  const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "";
  return baseUrl || webOrigin;
}

/** Customer page for reviewing, approving, and tracking an order. */
export function approvalLinkFor(token: string) {
  const base = origin();
  return base && token ? `${base}/approve/${token}` : "";
}
