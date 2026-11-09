export type ProductDiscountType = "percent" | "amount";
export type CatalogDiscount = { type: ProductDiscountType; value: number } | null;
export type CatalogPriceOption = {
  id: string;
  label: string;
  packSize: number;
  priceCents: number;
};
export type CatalogPromotion = {
  name: string;
  isActive: boolean;
  discountPercent: number;
  stackOnProductDiscount: boolean;
};

export const DEFAULT_CATALOG_PROMOTION: CatalogPromotion = {
  name: "Holiday promotion",
  isActive: false,
  discountPercent: 0,
  stackOnProductDiscount: false,
};

export function dollarsToCents(value: number): number {
  return Math.max(0, Math.round(value * 100));
}

export function getCatalogUnitPriceCents(
  basePrice: number,
  discount: CatalogDiscount,
  promotion: CatalogPromotion,
  priceOverrideCents?: number,
): number {
  let cents = priceOverrideCents ?? dollarsToCents(basePrice);
  const hasProductDiscount = Boolean(discount && discount.value > 0);
  if (discount && discount.value > 0) {
    cents = discount.type === "percent"
      ? Math.round(cents * (1 - Math.min(discount.value, 100) / 100))
      : Math.max(0, cents - dollarsToCents(discount.value));
  }
  if (promotion.isActive && promotion.discountPercent > 0 && (!hasProductDiscount || promotion.stackOnProductDiscount)) {
    cents = Math.round(cents * (1 - Math.min(promotion.discountPercent, 100) / 100));
  }
  return cents;
}

export function parsePriceOptions(value: unknown): CatalogPriceOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const option = entry as Partial<CatalogPriceOption>;
    if (typeof option.id !== "string" || typeof option.label !== "string") return [];
    if (!Number.isInteger(option.packSize) || Number(option.packSize) < 1) return [];
    if (!Number.isInteger(option.priceCents) || Number(option.priceCents) < 0) return [];
    return [{ id: option.id, label: option.label, packSize: Number(option.packSize), priceCents: Number(option.priceCents) }];
  });
}
