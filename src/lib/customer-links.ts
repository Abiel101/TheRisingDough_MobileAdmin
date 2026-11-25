import { Platform } from "react-native";

const baseUrl = (process.env.EXPO_PUBLIC_APPROVAL_BASE_URL ?? "").trim().replace(/\/+$/, "");

function origin() {
  const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "";
  return baseUrl || webOrigin;
}

/** Customer page for reviewing/approving an order; also shows the delivery time. */
export function approvalLinkFor(token: string) {
  const base = origin();
  return base && token ? `${base}/approve/${token}` : "";
}

/** Same link as approval: its page switches to a delivery tab (photo, invoice) once confirmed. */
export function deliveredLinkFor(token: string) {
  return approvalLinkFor(token);
}
