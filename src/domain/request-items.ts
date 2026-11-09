import type { CatalogPriceOption } from "@/domain/catalog-pricing";

type MatchableProduct = {
  id: string;
  name: string;
  price: number;
  pricingOptions: CatalogPriceOption[];
};

export type RequestedItem = { productName: string; quantity: number; unitPrice?: number };

export type ResolvedRequestItem = { key: string; quantity: number };

export const packChoiceKey = (productId: string, optionId: string) => `${productId}::${optionId}`;

const SINGLE = 1;

// Order matters: "half dozen" must be stripped before "dozen".
const VARIANT_PATTERNS: { pattern: RegExp; size: number }[] = [
  { pattern: /\b(?:half[\s-]*(?:a[\s-]*)?dozen|1\/2[\s-]*dozen|6[\s-]*(?:pack|pcs?|pieces?|ct|count))\b/g, size: 6 },
  { pattern: /\b(?:(?:a|one|1)[\s-]+)?dozen\b|\b12[\s-]*(?:pack|pcs?|pieces?|ct|count)\b/g, size: 12 },
  { pattern: /\b(?:single(?:[\s-]*items?)?|individual|each|1[\s-]*(?:pc|piece|ct))\b/g, size: SINGLE },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[·•\-–—:,()[\]|/+&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a website line such as "Cinnamon Rolls - Half dozen" into its product name and pack size. */
export function parseRequestedName(name: string): { baseName: string; packSize: number | null } {
  let packSize: number | null = null;
  let stripped = name.toLocaleLowerCase();
  for (const { pattern, size } of VARIANT_PATTERNS) {
    stripped = stripped.replace(pattern, () => {
      packSize ??= size;
      return " ";
    });
  }
  return { baseName: normalize(stripped), packSize };
}

function findProduct<T extends MatchableProduct>(products: T[], baseName: string): T | undefined {
  if (!baseName) return undefined;
  const exact = products.find((product) => normalize(product.name) === baseName);
  if (exact) return exact;
  const partial = products.filter((product) => {
    const productName = normalize(product.name);
    return productName.includes(baseName) || baseName.includes(productName);
  });
  return partial.length === 1 ? partial[0] : undefined;
}

/**
 * Maps a requested website line onto an order line. Half dozen and dozen use the product's
 * matching pack price when one exists; otherwise they expand into individual pieces (6 or 12 each).
 */
export function resolveRequestedItem<T extends MatchableProduct>(requested: RequestedItem, products: T[]): ResolvedRequestItem | null {
  const quantity = Math.max(0, Math.floor(requested.quantity));
  if (quantity < 1) return null;

  const whole = products.find((product) => normalize(product.name) === normalize(requested.productName));
  const parsed = parseRequestedName(requested.productName);
  const product = whole ?? findProduct(products, parsed.baseName);
  if (!product) return null;
  let packSize = whole ? null : parsed.packSize;

  if (packSize === null && requested.unitPrice) {
    const submittedCents = Math.round(requested.unitPrice * 100);
    const byPrice = product.pricingOptions.find((option) => option.priceCents === submittedCents);
    if (byPrice) return { key: packChoiceKey(product.id, byPrice.id), quantity };
  }
  packSize ??= SINGLE;
  if (packSize === SINGLE) return { key: product.id, quantity };

  const option = product.pricingOptions.find((entry) => entry.packSize === packSize);
  if (option) return { key: packChoiceKey(product.id, option.id), quantity };
  return { key: product.id, quantity: quantity * packSize };
}

export function resolveRequestedItems<T extends MatchableProduct>(requested: RequestedItem[], products: T[]) {
  const quantities: Record<string, number> = {};
  const unmatched: RequestedItem[] = [];
  for (const item of requested) {
    const resolved = resolveRequestedItem(item, products);
    if (!resolved) {
      if (item.quantity > 0) unmatched.push(item);
      continue;
    }
    quantities[resolved.key] = (quantities[resolved.key] ?? 0) + resolved.quantity;
  }
  return { quantities, unmatched };
}
