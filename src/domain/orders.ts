export const orderStatuses = [
  "Pending",
  "In progress",
  "Ready",
  "Fulfilled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusLabels: Record<OrderStatus, string> = {
  Pending: "Pending",
  "In progress": "In progress",
  Ready: "Ready",
  Fulfilled: "Delivered",
};

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
