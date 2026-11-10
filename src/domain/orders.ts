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
  optionName?: string;
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

export type ApprovalStatus = "draft" | "pending" | "approved" | "declined";

const roundCents = (value: number) => Math.round(value * 100) / 100;

/** Percent discounts are capped at 100% and fixed discounts never exceed the subtotal. */
export function calculateDiscountAmount(subtotal: number, discount: Discount): number {
  if (!discount || discount.value <= 0 || subtotal <= 0) return 0;
  if (discount.type === "percent") return roundCents(subtotal * (Math.min(discount.value, 100) / 100));
  return roundCents(Math.min(discount.value, subtotal));
}

/**
 * Spreads an order-level discount across its lines in proportion to their value.
 * Returns each line's discounted total; the last discounted line absorbs rounding.
 */
export function allocateLineTotals(items: readonly OrderLineItem[], discountAmount: number): number[] {
  const subtotal = calculateOrderTotal(items);
  if (discountAmount <= 0 || subtotal <= 0) return items.map((item) => roundCents(item.unitPrice * item.quantity));
  let remaining = discountAmount;
  const lastIndex = items.reduce((last, item, index) => (item.unitPrice * item.quantity > 0 ? index : last), -1);
  return items.map((item, index) => {
    const line = roundCents(item.unitPrice * item.quantity);
    const share = index === lastIndex ? remaining : Math.min(roundCents((line / subtotal) * discountAmount), remaining);
    remaining = roundCents(remaining - share);
    return roundCents(line - share);
  });
}

export function calculateOrderTotals(items: readonly OrderLineItem[], discount: Discount) {
  const subtotal = calculateOrderTotal(items);
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  return { subtotal, discountAmount, total: roundCents(subtotal - discountAmount) };
}

export const DEFAULT_OPTION_NAME = "Default";

/** Lines without a real option (or using the "Default" option) show only the item name. */
export function hasOptionLabel(optionName?: string | null): boolean {
  const name = optionName?.trim().toLocaleLowerCase();
  return !!name && name !== DEFAULT_OPTION_NAME.toLocaleLowerCase();
}

export type LineGroup<T> = {
  key: string;
  name: string;
  entries: { line: T; index: number }[];
  quantity: number;
  /** True when any line has a real option, so lines render under the item name. */
  showOptions: boolean;
};

/**
 * Groups order lines by catalog item (e.g. Bagels) so the options under it
 * (Plain, Everything) can be listed beneath one heading. Keeps first-seen order
 * and each line's original index for discount allocation.
 */
export function groupLinesByItem<T extends { productId?: string; name: string; optionName?: string; quantity: number }>(
  lines: readonly T[],
): LineGroup<T>[] {
  const groups = new Map<string, LineGroup<T>>();
  lines.forEach((line, index) => {
    const key = JSON.stringify([line.productId ?? "", line.name.trim().toLocaleLowerCase()]);
    const group = groups.get(key) ?? { key, name: line.name, entries: [], quantity: 0, showOptions: false };
    group.entries.push({ line, index });
    group.quantity += line.quantity;
    group.showOptions = group.showOptions || hasOptionLabel(line.optionName);
    groups.set(key, group);
  });
  return [...groups.values()];
}

/** One-line summary such as "5 × Bagels (3 Plain, 2 Everything)". */
export function summarizeLineGroup(group: LineGroup<{ optionName?: string; quantity: number }>): string {
  if (!group.showOptions) return `${group.quantity} × ${group.name}`;
  const options = group.entries
    .map(({ line }) => `${line.quantity} ${hasOptionLabel(line.optionName) ? line.optionName : DEFAULT_OPTION_NAME}`)
    .join(", ");
  return `${group.quantity} × ${group.name} (${options})`;
}

const optionFieldNames = [
  "option_name", "optionname", "selected_option", "selectedoption", "option", "variant_name", "variant",
  "flavor", "flavour", "item_option", "product_option", "options", "selected_options", "selectedoptions", "choices",
];

function optionText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(optionText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "label", "value", "title"]) {
      const text = optionText(record[key]);
      if (text) return text;
    }
  }
  return "";
}

/** Reads the chosen option from a website order row, whichever field name it uses. */
export function extractOptionName(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  for (const field of optionFieldNames) {
    const key = Object.keys(record).find((candidate) => candidate.toLocaleLowerCase() === field);
    const text = key ? optionText(record[key]) : "";
    if (hasOptionLabel(text)) return text;
  }
  return "";
}

const optionSeparators = [/\s+[-–—]\s+/, /:\s+/, /\s+\/\s+/];

/** Splits website names such as "Sourdough - Veggie" or "Bagels (Plain)" into item and option. */
export function splitOptionFromName(name: string): { productName: string; optionName: string } {
  const trimmed = name.trim();
  const bracket = /^(.+?)\s*[([]\s*([^)\]]+?)\s*[)\]]$/.exec(trimmed);
  if (bracket) return { productName: bracket[1].trim(), optionName: bracket[2].trim() };
  for (const separator of optionSeparators) {
    const match = separator.exec(trimmed);
    if (match && match.index > 0) {
      const optionName = trimmed.slice(match.index + match[0].length).trim();
      if (optionName) return { productName: trimmed.slice(0, match.index).trim(), optionName };
    }
  }
  return { productName: trimmed, optionName: DEFAULT_OPTION_NAME };
}

type MatchableOption = { id: string; name: string };
type MatchableProduct = { id: string; name: string; options: readonly MatchableOption[] };

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

/**
 * Finds the catalog item and option a website request line refers to.
 * Returns null when the item, or the requested option, is not in the catalog.
 */
export function matchRequestedItem<P extends MatchableProduct>(
  products: readonly P[],
  requested: { productName: string; optionName?: string; sourceName?: string },
): { product: P; option: P["options"][number] | null } | null {
  const findOption = (product: P, optionName: string) =>
    product.options.find((option) => normalize(option.name) === normalize(optionName));
  const requestedOption = hasOptionLabel(requested.optionName) ? requested.optionName!.trim() : "";
  const candidates: { productName: string; optionName: string }[] = [
    { productName: requested.productName, optionName: requestedOption },
  ];
  // A catalog item whose own name contains a separator should still match as a whole.
  if (requested.sourceName) candidates.push({ productName: requested.sourceName, optionName: "" });
  if (!requestedOption) candidates.push(splitOptionFromName(requested.productName));

  for (const candidate of candidates) {
    const product = products.find((item) => normalize(item.name) === normalize(candidate.productName));
    if (!product) continue;
    if (!hasOptionLabel(candidate.optionName)) {
      return { product, option: product.options.length === 1 ? product.options[0] : null };
    }
    const option = findOption(product, candidate.optionName);
    if (option) return { product, option };
  }

  // "Veggie Sourdough" / "Sourdough Veggie" where Sourdough is the item and Veggie its option.
  const fullName = normalize(requested.sourceName ?? requested.productName);
  for (const product of products) {
    for (const option of product.options) {
      const combined = [`${option.name} ${product.name}`, `${product.name} ${option.name}`].map(normalize);
      if (combined.includes(fullName)) return { product, option };
    }
  }
  return null;
}
