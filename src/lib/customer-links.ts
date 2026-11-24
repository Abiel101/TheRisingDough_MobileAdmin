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

/** Customer page confirming delivery or pick-up, with the photo and a printable invoice. */
export function deliveredLinkFor(token: string) {
  const base = origin();
  return base && token ? `${base}/delivered/${token}` : "";
}
