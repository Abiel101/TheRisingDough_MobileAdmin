export const orderStatuses = [
  "Pending",
  "In progress",
  "Ready",
  "Fulfilled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number] | "Cancelled";

export const orderStatusLabels: Record<OrderStatus, string> = {
  Pending: "Pending",
  "In progress": "In progress",
  Ready: "Ready",
  Fulfilled: "Completed",
  Cancelled: "Cancelled",
};

/** Orders that reach Ready with payment received complete automatically. */
export function resolveStatus(status: OrderStatus, paid: boolean): OrderStatus {
  return status === "Ready" && paid ? "Fulfilled" : status;
}

export const paymentMethods = ["cash", "zelle", "other"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export type OrderLineItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

export type Order = {
  id: string;
  customerId: string;
  dueAt: string;
  fulfilledAt?: string | null;
  notes?: string | null;
  status: OrderStatus;
  items: OrderLineItem[];
};

export type Customer = {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
};

/** Calculates the order total from each item's saved unit-price snapshot. */
export function calculateOrderTotal(items: readonly OrderLineItem[]): number {
  return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

export type DiscountType = "percent" | "amount";

export type Discount = { type: DiscountType; value: number } | null;

export type ApprovalStatus = "draft" | "pending" | "approved";

const roundCents = (value: number) => Math.round(value * 100) / 100;

/** Percent discounts are capped at 100% and fixed discounts never exceed the subtotal. */
export function calculateDiscountAmount(subtotal: number, discount: Discount): number {
  if (!discount || discount.value <= 0 || subtotal <= 0) return 0;
  if (discount.type === "percent") return roundCents(subtotal * (Math.min(discount.value, 100) / 100));
  return roundCents(Math.min(discount.value, subtotal));
}

export function calculateOrderTotals(items: readonly OrderLineItem[], discount: Discount) {
  const subtotal = calculateOrderTotal(items);
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  return { subtotal, discountAmount, total: roundCents(subtotal - discountAmount) };
}
