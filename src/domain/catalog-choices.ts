import { getCatalogUnitPriceCents, type CatalogPromotion } from "@/domain/catalog-pricing";
import { hasOptionLabel, matchRequestedItem } from "@/domain/orders";
import { parseRequestedName, resolveRequestedItem, type RequestedItem } from "@/domain/request-items";
import type { ProductOption, ProductRecord } from "@/lib/workspace";

export const catalogChoiceKey = (productId: string, optionId?: string, packId?: string) =>
  JSON.stringify([productId, optionId ?? "", packId ?? ""]);

export function catalogChoices(product: ProductRecord) {
  const options: (ProductOption | null)[] = product.options.length ? product.options : [null];
  return options.flatMap((option) => [
    {
      key: catalogChoiceKey(product.id, option?.id),
      product,
      option,
      itemName: product.name,
      label: option ? `${option.name} · Single item` : "Single item",
      originalCents: Math.round((option?.price ?? product.price) * 100),
    },
    ...product.pricingOptions.map((pack) => ({
      key: catalogChoiceKey(product.id, option?.id, pack.id),
      product,
      option,
      itemName: `${product.name} · ${pack.label} (${pack.packSize} pieces)`,
      label: `${option ? `${option.name} · ` : ""}${pack.label} · ${pack.packSize} pieces`,
      originalCents: pack.priceCents,
    })),
  ]);
}

export function catalogChoicePrice(choice: ReturnType<typeof catalogChoices>[number], promotion: CatalogPromotion) {
  return getCatalogUnitPriceCents(choice.product.price, choice.product.discount, promotion, choice.originalCents) / 100;
}

export function resolveCatalogRequest(
  products: ProductRecord[],
  requested: RequestedItem & { optionName?: string; sourceName?: string },
): { key: string; quantity: number } | null {
  const parsedOption = parseRequestedName(requested.optionName ?? "");
  const optionName = parsedOption.packSize && !parsedOption.baseName ? undefined : requested.optionName;
  const parsedSource = parseRequestedName(requested.sourceName ?? requested.productName);
  const direct = matchRequestedItem(products, { ...requested, optionName });
  const provisional = resolveRequestedItem(requested, products);
  const product = direct?.product ?? products.find((item) =>
    provisional?.key === item.id || item.pricingOptions.some((pack) => provisional?.key === `${item.id}::${pack.id}`),
  );
  if (!product) return null;

  const match = matchRequestedItem([product], { ...requested, productName: product.name, optionName });
  if (!match || ((product.options.length > 0 || hasOptionLabel(optionName)) && !match.option)) return null;

  const packSize = parsedSource.packSize ?? parsedOption.packSize;
  const packLabel = packSize === 6 ? "half dozen" : packSize === 12 ? "dozen" : "";
  const resolved = resolveRequestedItem({
    ...requested,
    productName: packLabel ? `${product.name} - ${packLabel}` : product.name,
  }, [product]);
  if (!resolved) return null;
  const pack = product.pricingOptions.find((entry) => resolved.key === `${product.id}::${entry.id}`);
  return { key: catalogChoiceKey(product.id, match.option?.id, pack?.id), quantity: resolved.quantity };
}
