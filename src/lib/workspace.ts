import { supabase } from "@/lib/supabase";
import { DEFAULT_CATALOG_PROMOTION, parsePriceOptions, type CatalogDiscount, type CatalogPriceOption, type CatalogPromotion } from "@/domain/catalog-pricing";
import {
  DEFAULT_OPTION_NAME,
  extractOptionName,
  hasOptionLabel,
  splitOptionFromName,
  type ApprovalStatus,
  type Discount,
  type DiscountType,
  type OrderStatus,
  type PaymentMethod,
} from "@/domain/orders";

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
};

/** `price` is null when the option uses the catalog item's own price. */
export type ProductOption = { id: string; name: string; price: number | null };
export type ProductRecord = {
  id: string;
  name: string;
  price: number;
  discount: CatalogDiscount;
  pricingOptions: CatalogPriceOption[];
  options: ProductOption[];
};
export type OrderLine = {
  id: string;
  productId: string;
  name: string;
  optionId: string;
  optionName: string;
  price: number;
  quantity: number;
};
export type OrderItemInput = { product: ProductRecord; option?: ProductOption | null; quantity: number; itemName?: string; unitPrice?: number };

/** Lowest and highest price a customer can pay for an item across its options. */
export function productPriceRange(product: ProductRecord): { min: number; max: number } {
  const prices = product.options.length
    ? product.options.map((option) => option.price ?? product.price)
    : [product.price];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function optionUnitPrice(product: ProductRecord, option?: ProductOption | null): number {
  return option?.price ?? product.price;
}
export type DeliveryMethod = "delivery" | "pickup";

export type OrderRecord = {
  id: string;
  number: string;
  customerId: string;
  customer: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  dueDate: string;
  fulfilledDate: string;
  status: OrderStatus;
  paid: boolean;
  paymentMethod: PaymentMethod | null;
  paymentMethodOther: string;
  paymentTrackingAvailable: boolean;
  approvalAvailable: boolean;
  discount: Discount;
  approvalToken: string;
  approvalStatus: ApprovalStatus;
  approvedAt: string;
  approvedByName: string;
  approvedTotal: number | null;
  declinedAt: string;
  deliveryTime: string;
  customerNotifiedAt: string;
  deliveredAt: string;
  deliveryMethod: DeliveryMethod | null;
  deliveryPhotoPath: string;
  notes: string;
  items: OrderLine[];
  createdAt: string;
};

type CustomerRow = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
};
type ProductRow = {
  id: string;
  name: string;
  unit_price: number | string;
  discount_type?: "percent" | "amount" | null;
  discount_value?: number | string | null;
  discount_ends_on?: string | null;
  pricing_options?: unknown;
};
type ProductOptionRow = {
  id: string;
  product_id: string;
  name: string;
  unit_price: number | string | null;
  sort_order: number;
};
type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  due_date: string;
  fulfilled_date: string | null;
  status: OrderStatus;
  paid?: boolean;
  payment_method?: PaymentMethod | null;
  payment_method_other?: string | null;
  discount_type?: DiscountType | null;
  discount_value?: number | string | null;
  approval_token?: string;
  approval_status?: ApprovalStatus;
  approved_at?: string | null;
  approved_by_name?: string | null;
  approved_total?: number | string | null;
  declined_at?: string | null;
  delivery_time?: string | null;
  customer_notified_at?: string | null;
  delivered_at?: string | null;
  delivery_method?: DeliveryMethod | null;
  delivery_photo_path?: string | null;
  notes: string;
  created_at: string;
};
type OrderItemRow = {
  id: string;
  order_id: string;
  catalog_product_id: string | null;
  catalog_option_id?: string | null;
  item_name: string;
  option_name?: string | null;
  unit_price: number | string;
  quantity: number;
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function isMissingPaymentColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

// Options need the catalog-options migration; behave as "no options" until it is applied.
function isMissingOptionsSchema(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || isMissingPaymentColumn(error);
}

function mapOption(row: ProductOptionRow): ProductOption {
  return { id: row.id, name: row.name, price: row.unit_price == null ? null : Number(row.unit_price) };
}

function mapProduct(row: ProductRow, options: ProductOption[] = []): ProductRecord {
  const discountEndsOn = row.discount_ends_on ?? null;
  const discountExpired = Boolean(discountEndsOn && discountEndsOn < localDateKey());
  return {
    id: row.id,
    name: row.name,
    price: Number(row.unit_price),
    discount: !discountExpired && row.discount_type && Number(row.discount_value) > 0
      ? { type: row.discount_type, value: Number(row.discount_value), endsOn: discountEndsOn }
      : null,
    pricingOptions: parsePriceOptions(row.pricing_options),
    options,
  };
}

function localDateKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

async function clearExpiredProductDiscounts(rows: ProductRow[]) {
  const expired = rows.filter((row) =>
    Boolean(row.discount_type && row.discount_ends_on && row.discount_ends_on < localDateKey()),
  );
  await Promise.all(expired.map(async (row) => {
    const { error } = await supabase
      .from("admin_products")
      .update({ discount_type: null, discount_value: 0, discount_ends_on: null })
      .eq("id", row.id)
      .eq("discount_type", row.discount_type)
      .eq("discount_value", row.discount_value ?? 0)
      .eq("discount_ends_on", row.discount_ends_on!);
    throwIfError(error);
  }));
}

async function listOptionRows(productIds?: string[]): Promise<ProductOptionRow[]> {
  let query = supabase
    .from("admin_product_options")
    .select("id,product_id,name,unit_price,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(2000);
  if (productIds) query = query.in("product_id", productIds);
  const { data, error } = await query;
  if (isMissingOptionsSchema(error)) return [];
  throwIfError(error);
  return (data ?? []) as ProductOptionRow[];
}

function groupOptions(rows: ProductOptionRow[]): Map<string, ProductOption[]> {
  const byProduct = new Map<string, ProductOption[]>();
  for (const row of rows) {
    const options = byProduct.get(row.product_id) ?? [];
    options.push(mapOption(row));
    byProduct.set(row.product_id, options);
  }
  return byProduct;
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    phone: row.phone,
    email: row.email ?? "",
    address: row.address ?? "",
    createdAt: row.created_at,
  };
}

export async function listCustomers(): Promise<CustomerRecord[]> {
  const { data, error } = await supabase
    .from("admin_customer_list")
    .select("id,name,phone,email,address,created_at")
    .order("name", { ascending: true })
    .limit(500);
  throwIfError(error);
  return ((data ?? []) as CustomerRow[]).map(mapCustomer);
}

export async function getCustomer(id: string): Promise<CustomerRecord | null> {
  const { data, error } = await supabase
    .from("admin_customer_list")
    .select("id,name,phone,email,address,created_at")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function updateCustomer(
  id: string,
  input: Pick<CustomerRecord, "name" | "phone" | "email" | "address">,
): Promise<void> {
  const phone = input.phone.trim();
  if (!phone) throw new Error("A phone number is required.");
  const { data, error } = await supabase
    .from("admin_customer_list")
    .update({
      name: input.name.trim() || null,
      phone,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Customer was not found for this account.");
}

export async function deleteCustomer(id: string): Promise<void> {
  // Keep the historical order and customer-name snapshot when removing a profile.
  const customer = await getCustomer(id);
  if (!customer) throw new Error("Customer was not found for this account.");
  const { error: detachError } = await supabase
    .from("admin_orders")
    .update({ customer_id: null, customer_name: customer.name.trim() || customer.phone })
    .eq("customer_id", id);
  throwIfError(detachError);

  const { data, error } = await supabase
    .from("admin_customer_list")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Customer was not found for this account.");
}

export async function addCustomer(
  ownerId: string,
  input: Pick<CustomerRecord, "name" | "phone" | "email" | "address">,
): Promise<CustomerRecord> {
  const { data, error } = await supabase
    .from("admin_customer_list")
    .insert({
      owner_id: ownerId,
      name: input.name.trim() || null,
      phone: input.phone.trim(),
      email: input.email.trim() || null,
      address: input.address.trim() || null,
    })
    .select("id,name,phone,email,address,created_at")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Supabase returned no customer record.");
  return mapCustomer(data as CustomerRow);
}

export async function listProducts(): Promise<ProductRecord[]> {
  const optionRowsPromise = listOptionRows();
  const initial = await supabase
    .from("admin_products")
    .select("id,name,unit_price,discount_type,discount_value,discount_ends_on,pricing_options")
    .order("name", { ascending: true })
    .limit(500);
  let rows = (initial.data ?? []) as ProductRow[];
  let error = initial.error;
  if (isMissingPaymentColumn(error)) {
    const fallback = await supabase
      .from("admin_products")
      .select("id,name,unit_price,discount_type,discount_value,pricing_options")
      .order("name", { ascending: true })
      .limit(500);
    rows = (fallback.data ?? []) as ProductRow[];
    error = fallback.error;
  }
  throwIfError(error);
  const optionRows = await optionRowsPromise;
  await clearExpiredProductDiscounts(rows);
  const optionsByProduct = groupOptions(optionRows);
  return rows.map((row) => mapProduct(row, optionsByProduct.get(row.id)));
}

export async function getProduct(id: string): Promise<ProductRecord | null> {
  let { data, error } = await supabase
    .from("admin_products")
    .select("id,name,unit_price,discount_type,discount_value,discount_ends_on,pricing_options")
    .eq("id", id)
    .maybeSingle();
  if (isMissingPaymentColumn(error)) {
    ({ data, error } = await supabase
      .from("admin_products")
      .select("id,name,unit_price,discount_type,discount_value,pricing_options")
      .eq("id", id)
      .maybeSingle());
  }
  throwIfError(error);
  if (!data) return null;
  const row = data as ProductRow;
  await clearExpiredProductDiscounts([row]);
  const optionRows = await listOptionRows([id]);
  return mapProduct(row, groupOptions(optionRows).get(id));
}

export async function updateProductPricing(
  id: string,
  input: { discount: CatalogDiscount; pricingOptions: CatalogPriceOption[] },
): Promise<void> {
  const { data, error } = await supabase
    .from("admin_products")
    .update({
      discount_type: input.discount?.type ?? null,
      discount_value: input.discount?.value ?? 0,
      discount_ends_on: input.discount?.endsOn ?? null,
      pricing_options: input.pricingOptions,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Catalog item was not found for this account.");
}

/** Applies one temporary discount (or clears it with null) to several catalog items. */
export async function updateProductsDiscount(ids: string[], discount: CatalogDiscount): Promise<void> {
  if (!ids.length) return;
  const { data, error } = await supabase
    .from("admin_products")
    .update({
      discount_type: discount?.type ?? null,
      discount_value: discount?.value ?? 0,
      discount_ends_on: discount?.endsOn ?? null,
    })
    .in("id", ids)
    .select("id");
  throwIfError(error);
  if ((data ?? []).length !== ids.length) throw new Error("Some catalog items could not be updated.");
}

export async function updateProductName(id: string, name: string): Promise<void> {
  const cleanedName = name.trim().replace(/\s+/g, " ");
  if (!cleanedName) throw new Error("An item name is required.");
  const { data, error } = await supabase
    .from("admin_products")
    .update({ name: cleanedName })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Catalog item was not found for this account.");
}

export async function getCatalogPromotion(): Promise<CatalogPromotion> {
  const { data, error } = await supabase
    .from("admin_catalog_promotions")
    .select("name,is_active,discount_percent,stack_on_product_discount")
    .maybeSingle();
  throwIfError(error);
  if (!data) return DEFAULT_CATALOG_PROMOTION;
  const row = data as { name: string; is_active: boolean; discount_percent: number | string; stack_on_product_discount: boolean };
  return {
    name: row.name,
    isActive: row.is_active,
    discountPercent: Number(row.discount_percent),
    stackOnProductDiscount: row.stack_on_product_discount,
  };
}

export async function saveCatalogPromotion(ownerId: string, promotion: CatalogPromotion): Promise<void> {
  const { error } = await supabase.from("admin_catalog_promotions").upsert({
    owner_id: ownerId,
    name: promotion.name.trim() || "Holiday promotion",
    is_active: promotion.isActive,
    discount_percent: promotion.discountPercent,
    stack_on_product_discount: promotion.stackOnProductDiscount,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  throwIfError(error);
}

export type ProductOptionInput = { name: string; price: number };

function cleanOptionInputs(options: ProductOptionInput[]): ProductOptionInput[] {
  const seen = new Set<string>();
  const cleaned: ProductOptionInput[] = [];
  for (const option of options) {
    const name = option.name.trim().replace(/\s+/g, " ");
    const key = name.toLocaleLowerCase();
    if (!name) continue;
    if (!hasOptionLabel(name)) throw new Error(`“${name}” is reserved. Choose a different option name.`);
    if (seen.has(key)) throw new Error(`“${name}” is listed more than once.`);
    if (!Number.isFinite(option.price) || option.price < 0) {
      throw new Error(`Enter a price of zero or more for “${name}”.`);
    }
    seen.add(key);
    cleaned.push({ name, price: option.price });
  }
  return cleaned;
}

export async function addProductOption(
  ownerId: string,
  productId: string,
  input: ProductOptionInput,
  sortOrder = 0,
): Promise<ProductOption> {
  const [option] = cleanOptionInputs([input]);
  if (!option) throw new Error("Enter an option name.");
  const { data, error } = await supabase
    .from("admin_product_options")
    .insert({ owner_id: ownerId, product_id: productId, name: option.name, unit_price: option.price, sort_order: sortOrder })
    .select("id,product_id,name,unit_price,sort_order")
    .single();
  if (error?.code === "23505") throw new Error(`“${option.name}” is already an option for this item.`);
  if (isMissingOptionsSchema(error)) throw new Error("Item options aren’t available yet. Apply the latest Supabase migration first.");
  throwIfError(error);
  if (!data) throw new Error("Supabase returned no option.");
  return mapOption(data as ProductOptionRow);
}

export async function removeProductOption(id: string): Promise<void> {
  const { error } = await supabase.from("admin_product_options").delete().eq("id", id);
  throwIfError(error);
}

export async function updateProductOption(id: string, input: ProductOptionInput): Promise<ProductOption> {
  const [option] = cleanOptionInputs([input]);
  if (!option) throw new Error("Enter an option name.");
  const { data, error } = await supabase
    .from("admin_product_options")
    .update({ name: option.name, unit_price: option.price })
    .eq("id", id)
    .select("id,product_id,name,unit_price,sort_order")
    .single();
  if (error?.code === "23505") throw new Error(`“${option.name}” is already an option for this item.`);
  if (isMissingOptionsSchema(error)) throw new Error("Item options aren’t available yet. Apply the latest Supabase migration first.");
  throwIfError(error);
  if (!data) throw new Error("Supabase returned no option.");
  return mapOption(data as ProductOptionRow);
}

export async function addProduct(
  ownerId: string,
  name: string,
  price: number,
  options: ProductOptionInput[] = [],
): Promise<ProductRecord> {
  const cleaned = cleanOptionInputs(options);
  if (!cleaned.length) throw new Error("Add at least one priced option for this catalog item.");
  const { data, error } = await supabase
    .from("admin_products")
    .insert({ owner_id: ownerId, name: name.trim(), unit_price: price })
    .select("id,name,unit_price,discount_type,discount_value,pricing_options")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Supabase returned no catalog item.");
  const row = data as ProductRow;
  if (!cleaned.length) return mapProduct(row);

  const { data: optionData, error: optionError } = await supabase
    .from("admin_product_options")
    .insert(cleaned.map((option, index) => ({
      owner_id: ownerId,
      product_id: row.id,
      name: option.name,
      unit_price: option.price,
      sort_order: index,
    })))
    .select("id,product_id,name,unit_price,sort_order");
  if (optionError) {
    await supabase.from("admin_products").delete().eq("id", row.id);
    if (isMissingOptionsSchema(optionError)) throw new Error("Item options aren’t available yet. Apply the latest Supabase migration first.");
    throwIfError(optionError);
  }
  return mapProduct(row, ((optionData ?? []) as ProductOptionRow[]).map(mapOption));
}

export async function removeProduct(id: string): Promise<void> {
  const { error } = await supabase.from("admin_products").delete().eq("id", id);
  throwIfError(error);
}

const baseOrderColumns =
  "id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,notes,created_at";
const paymentOrderColumns = `${baseOrderColumns},paid,payment_method,payment_method_other`;
const fullOrderColumns = `${paymentOrderColumns},discount_type,discount_value,approval_token,approval_status,approved_at,approved_by_name,approved_total,declined_at`;
const notifiedOrderColumns = `${fullOrderColumns},delivery_time,customer_notified_at`;
const deliveredOrderColumns = `${notifiedOrderColumns},delivered_at,delivery_method,delivery_photo_path`;

type OrderFeatures = { paymentTrackingAvailable: boolean; approvalAvailable: boolean };

// Falls back to older column sets until the matching Supabase migrations are applied.
async function selectOrderRows<T extends { error: { code?: string; message: string } | null; data: unknown }>(
  query: (columns: string) => PromiseLike<T>,
): Promise<{ result: T; features: OrderFeatures }> {
  let result = await query(deliveredOrderColumns);
  if (!isMissingPaymentColumn(result.error)) {
    return { result, features: { paymentTrackingAvailable: true, approvalAvailable: true } };
  }
  result = await query(notifiedOrderColumns);
  if (!isMissingPaymentColumn(result.error)) {
    return { result, features: { paymentTrackingAvailable: true, approvalAvailable: true } };
  }
  result = await query(fullOrderColumns);
  if (!isMissingPaymentColumn(result.error)) {
    return { result, features: { paymentTrackingAvailable: true, approvalAvailable: true } };
  }
  result = await query(paymentOrderColumns);
  if (!isMissingPaymentColumn(result.error)) {
    return { result, features: { paymentTrackingAvailable: true, approvalAvailable: false } };
  }
  result = await query(baseOrderColumns);
  return { result, features: { paymentTrackingAvailable: false, approvalAvailable: false } };
}

export async function listOrders(options: {
  startDate?: string;
  endDateExclusive?: string;
  customerId?: string;
  limit?: number;
} = {}): Promise<OrderRecord[]> {
  const { result, features } = await selectOrderRows((columns) => {
    let query = supabase
      .from("admin_orders")
      .select(columns)
      .order("due_date", { ascending: true })
      .limit(options.limit ?? 200);

    if (options.startDate) query = query.gte("due_date", options.startDate);
    if (options.endDateExclusive) query = query.lt("due_date", options.endDateExclusive);
    if (options.customerId) query = query.eq("customer_id", options.customerId);
    return query;
  });
  throwIfError(result.error);
  return mapOrderRows((result.data ?? []) as unknown as OrderRow[], features);
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const { result, features } = await selectOrderRows((columns) =>
    supabase.from("admin_orders").select(columns).eq("id", id).maybeSingle(),
  );
  throwIfError(result.error);
  if (!result.data) return null;
  const orders = await mapOrderRows([result.data as unknown as OrderRow], features);
  return orders[0] ?? null;
}

const baseItemColumns = "id,order_id,catalog_product_id,item_name,unit_price,quantity";

async function selectOrderItemRows(orderIds: string[]) {
  const query = (columns: string) =>
    supabase.from("admin_order_items").select(columns).in("order_id", orderIds).limit(2000);
  const result = await query(`${baseItemColumns},catalog_option_id,option_name`);
  if (!isMissingPaymentColumn(result.error)) return result;
  return query(baseItemColumns);
}

async function mapOrderRows(
  orderRows: OrderRow[],
  { paymentTrackingAvailable, approvalAvailable }: OrderFeatures,
): Promise<OrderRecord[]> {
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((row) => row.id);
  const customerIds = [
    ...new Set(orderRows.flatMap((row) => (row.customer_id ? [row.customer_id] : []))),
  ];
  const [itemResult, customerResult] = await Promise.all([
    selectOrderItemRows(orderIds),
    customerIds.length
      ? supabase
          .from("admin_customer_list")
          .select("id,name,phone,email,address,created_at")
          .in("id", customerIds)
      : Promise.resolve({ data: [] as CustomerRow[], error: null }),
  ]);
  throwIfError(itemResult.error);
  throwIfError(customerResult.error);

  const customersById = new Map(
    ((customerResult.data ?? []) as CustomerRow[]).map((row) => [row.id, mapCustomer(row)]),
  );
  const itemsByOrder = new Map<string, OrderLine[]>();
  for (const row of (itemResult.data ?? []) as unknown as OrderItemRow[]) {
    const lines = itemsByOrder.get(row.order_id) ?? [];
    lines.push({
      id: row.id,
      productId: row.catalog_product_id ?? "",
      name: row.item_name,
      optionId: row.catalog_option_id ?? "",
      optionName: row.option_name?.trim() || DEFAULT_OPTION_NAME,
      price: Number(row.unit_price),
      quantity: row.quantity,
    });
    itemsByOrder.set(row.order_id, lines);
  }

  return orderRows.map((row) => {
    const customer = row.customer_id ? customersById.get(row.customer_id) : undefined;
    return {
      id: row.id,
      number: row.order_number,
      customerId: row.customer_id ?? "",
      customer: customer?.name || row.customer_name || customer?.phone || "Customer",
      customerPhone: customer?.phone ?? "",
      customerEmail: customer?.email ?? "",
      customerAddress: customer?.address ?? "",
      dueDate: row.due_date,
      fulfilledDate: row.fulfilled_date ?? "",
      status: row.status,
      paid: row.paid ?? false,
      paymentMethod: row.payment_method ?? null,
      paymentMethodOther: row.payment_method_other ?? "",
      paymentTrackingAvailable,
      approvalAvailable,
      discount:
        row.discount_type && Number(row.discount_value) > 0
          ? { type: row.discount_type, value: Number(row.discount_value) }
          : null,
      approvalToken: row.approval_token ?? "",
      approvalStatus: row.approval_status ?? "draft",
      approvedAt: row.approved_at ?? "",
      approvedByName: row.approved_by_name ?? "",
      approvedTotal: row.approved_total == null ? null : Number(row.approved_total),
      declinedAt: row.declined_at ?? "",
      deliveryTime: row.delivery_time ?? "",
      customerNotifiedAt: row.customer_notified_at ?? "",
      deliveredAt: row.delivered_at ?? "",
      deliveryMethod: row.delivery_method ?? null,
      deliveryPhotoPath: row.delivery_photo_path ?? "",
      notes: row.notes,
      items: itemsByOrder.get(row.id) ?? [],
      createdAt: row.created_at,
    };
  });
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

/** Open orders due today or within the next two days, so customers can be told early. */
export async function listDueSoonOrders(): Promise<OrderRecord[]> {
  const today = localDateKey();
  const orders = await listOrders({ startDate: today, endDateExclusive: addDays(today, 3) });
  return orders.filter((order) => order.status !== "Cancelled" && order.status !== "Fulfilled");
}

/** Records the delivery time and that the customer was told their order is arriving. */
export async function markOrderNotified(id: string, deliveryTime: string): Promise<string> {
  const notifiedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("admin_orders")
    .update({ delivery_time: deliveryTime.trim(), customer_notified_at: notifiedAt })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (isMissingPaymentColumn(error)) throw new Error("Apply the latest Supabase migration to track notified orders.");
  throwIfError(error);
  if (!data) throw new Error("Order was not found for this account.");
  return notifiedAt;
}

/** Saves the delivery time so the customer link shows it as soon as the reminder is shared. */
export async function setOrderDeliveryTime(id: string, deliveryTime: string): Promise<void> {
  const { error } = await supabase.from("admin_orders").update({ delivery_time: deliveryTime.trim() }).eq("id", id);
  if (isMissingPaymentColumn(error)) throw new Error("Apply the latest Supabase migration to save delivery times.");
  throwIfError(error);
}

const DELIVERY_PHOTO_BUCKET = "delivery-photos";

export function deliveryPhotoUrl(path: string): string {
  return path ? supabase.storage.from(DELIVERY_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : "";
}

/** Uploads a delivery photo from a local image URI and returns its storage path. */
export async function uploadDeliveryPhoto(orderId: string, uri: string, mimeType?: string | null): Promise<string> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  if (!auth.user) throw new Error("Sign in again to upload a photo.");
  const type = mimeType?.startsWith("image/") ? mimeType : "image/jpeg";
  const extension = type.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `${auth.user.id}/${orderId}-${Date.now()}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(DELIVERY_PHOTO_BUCKET).upload(path, body, { contentType: type });
  if (error) throw new Error("Could not upload the photo. Apply the latest Supabase migration and try again.");
  return path;
}

/** Records that the order was delivered or picked up, with an optional photo. */
export async function confirmOrderDelivered(
  id: string,
  method: DeliveryMethod,
  photoPath: string | null,
): Promise<string> {
  const deliveredAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("admin_orders")
    .update({ delivered_at: deliveredAt, delivery_method: method, delivery_photo_path: photoPath })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (isMissingPaymentColumn(error)) throw new Error("Apply the latest Supabase migration to confirm deliveries.");
  throwIfError(error);
  if (!data) throw new Error("Order was not found for this account.");
  return deliveredAt;
}

/** Clears a delivery confirmation (for example if it was recorded by mistake). */
export async function clearOrderDelivered(id: string): Promise<void> {
  const { error } = await supabase
    .from("admin_orders")
    .update({ delivered_at: null, delivery_method: null, delivery_photo_path: null })
    .eq("id", id);
  throwIfError(error);
}

export async function updateOrder(
  id: string,
  changes: {
    status?: OrderStatus;
    paid?: boolean;
    paymentMethod?: PaymentMethod | null;
    paymentMethodOther?: string | null;
    dueDate?: string;
    notes?: string;
    discount?: Discount;
    approvalStatus?: ApprovalStatus;
  },
): Promise<void> {
  const values: {
    status?: OrderStatus;
    paid?: boolean;
    payment_method?: PaymentMethod | null;
    payment_method_other?: string | null;
    fulfilled_date?: string | null;
    due_date?: string;
    notes?: string;
    discount_type?: DiscountType | null;
    discount_value?: number;
    approval_status?: ApprovalStatus;
    approved_at?: string | null;
    approved_by_name?: string | null;
    approved_total?: number | null;
    declined_at?: string | null;
  } = {};
  if (changes.status) {
    values.status = changes.status;
    values.fulfilled_date = changes.status === "Fulfilled" ? new Date().toISOString().slice(0, 10) : null;
  }
  if (changes.paid !== undefined) values.paid = changes.paid;
  if (changes.paymentMethod !== undefined) values.payment_method = changes.paymentMethod;
  if (changes.paymentMethodOther !== undefined) values.payment_method_other = changes.paymentMethodOther;
  if (changes.dueDate !== undefined) values.due_date = changes.dueDate;
  if (changes.notes !== undefined) values.notes = changes.notes.trim();
  if (changes.discount !== undefined) {
    values.discount_type = changes.discount?.type ?? null;
    values.discount_value = changes.discount?.value ?? 0;
  }
  if (changes.approvalStatus !== undefined) {
    values.approval_status = changes.approvalStatus;
    if (changes.approvalStatus !== "approved") {
      values.approved_at = null;
      values.approved_by_name = null;
      values.approved_total = null;
    }
    if (changes.approvalStatus !== "declined") values.declined_at = null;
  }

  const { data, error } = await supabase
    .from("admin_orders")
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Order was not found for this account.");
}

function validateOrderItems(items: OrderItemInput[]) {
  if (!items.length || items.some(({ product, quantity }) => !product.id || quantity < 1 || !Number.isInteger(quantity))) {
    throw new Error("Add at least one item with a valid quantity.");
  }
}

async function insertOrderItems(ownerId: string, orderId: string, items: OrderItemInput[]) {
  const rows = items.map(({ product, option, quantity, itemName, unitPrice }) => ({
    owner_id: ownerId,
    order_id: orderId,
    catalog_product_id: product.id,
    item_name: itemName ?? product.name,
    unit_price: unitPrice ?? optionUnitPrice(product, option),
    quantity,
  }));
  const { error } = await supabase.from("admin_order_items").insert(
    rows.map((row, index) => ({
      ...row,
      catalog_option_id: items[index].option?.id ?? null,
      option_name: items[index].option?.name ?? DEFAULT_OPTION_NAME,
    })),
  );
  if (!isMissingPaymentColumn(error)) {
    throwIfError(error);
    return;
  }
  // Options migration not applied yet: only plain items can be saved.
  if (items.some(({ option }) => option)) {
    throw new Error("Item options aren’t available yet. Apply the latest Supabase migration first.");
  }
  const { error: fallbackError } = await supabase.from("admin_order_items").insert(rows);
  throwIfError(fallbackError);
}

const lineKey = (productId: string | null, itemName: string, optionName: string | null | undefined, price: number | string) =>
  JSON.stringify([productId, itemName, optionName?.trim() || DEFAULT_OPTION_NAME, Number(price)]);

export async function createOrder(input: {
  ownerId: string;
  customer: CustomerRecord;
  dueDate: string;
  notes: string;
  items: OrderItemInput[];
  discount?: Discount;
}): Promise<string> {
  validateOrderItems(input.items);
  const { data: latest, error: latestError } = await supabase
    .from("admin_orders")
    .select("order_number")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(latestError);
  const latestNumber = /^RD-(\d+)$/.exec(latest?.order_number ?? "");
  const nextNumber = String((latestNumber ? Number(latestNumber[1]) : 0) + 1).padStart(4, "0");
  const { data: order, error } = await supabase
    .from("admin_orders")
    .insert({
      owner_id: input.ownerId,
      order_number: `RD-${nextNumber}`,
      customer_id: input.customer.id,
      customer_name: input.customer.name.trim() || input.customer.phone,
      due_date: input.dueDate,
      status: "Pending",
      paid: false,
      notes: input.notes.trim(),
      ...(input.discount ? { discount_type: input.discount.type, discount_value: input.discount.value } : {}),
    })
    .select("id")
    .single();
  throwIfError(error);
  if (!order) throw new Error("Supabase returned no order record.");

  try {
    await insertOrderItems(input.ownerId, order.id, input.items);
  } catch (cause) {
    await supabase.from("admin_orders").delete().eq("id", order.id);
    throw cause;
  }
  return order.id;
}

export async function addItemsToOrder(
  ownerId: string,
  orderId: string,
  items: OrderItemInput[],
): Promise<void> {
  validateOrderItems(items);
  const query = (columns: string) =>
    supabase.from("admin_order_items").select(columns).eq("order_id", orderId);
  let { data, error } = await query("id,catalog_product_id,item_name,option_name,unit_price,quantity");
  if (isMissingPaymentColumn(error)) ({ data, error } = await query("id,catalog_product_id,item_name,unit_price,quantity"));
  throwIfError(error);
  const current = (data ?? []) as unknown as {
    id: string;
    catalog_product_id: string | null;
    item_name: string;
    option_name?: string | null;
    unit_price: number | string;
    quantity: number;
  }[];
  const nextItems = new Map(current.map((item) => [lineKey(item.catalog_product_id, item.item_name, item.option_name, item.unit_price), item]));
  const newItems: OrderItemInput[] = [];

  for (const input of items) {
    const key = lineKey(input.product.id, input.itemName ?? input.product.name, input.option?.name, input.unitPrice ?? optionUnitPrice(input.product, input.option));
    const existing = nextItems.get(key);
    if (!existing) {
      newItems.push(input);
      continue;
    }
    const { error: updateError } = await supabase
      .from("admin_order_items")
      .update({ quantity: existing.quantity + input.quantity })
      .eq("id", existing.id);
    throwIfError(updateError);
    nextItems.set(key, { ...existing, quantity: existing.quantity + input.quantity });
  }
  if (newItems.length) await insertOrderItems(ownerId, orderId, newItems);
}

export async function removeOrderItems(orderId: string, itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const { error } = await supabase
    .from("admin_order_items")
    .delete()
    .eq("order_id", orderId)
    .in("id", itemIds);
  throwIfError(error);
}

export async function deleteOrder(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("admin_orders")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Order was not found for this account.");
}

export type ApprovalOrder = {
  orderNumber: string;
  customerName: string;
  dueDate: string;
  deliveryTime: string;
  status: OrderStatus;
  approvalStatus: ApprovalStatus;
  approvedAt: string;
  approvedTotal: number | null;
  declinedAt: string;
  discount: Discount;
  paid: boolean;
  paymentMethod: PaymentMethod | null;
  paymentMethodOther: string;
  fulfilledDate: string;
  deliveredAt: string;
  deliveryMethod: DeliveryMethod | null;
  deliveryPhotoPath: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  items: { name: string; optionName: string; unitPrice: number; quantity: number }[];
};

type ApprovalPayload = {
  order_number: string;
  customer_name: string | null;
  due_date: string;
  delivery_time?: string | null;
  status: OrderStatus;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_total: number | string | null;
  declined_at: string | null;
  discount_type?: DiscountType | null;
  discount_value?: number | string | null;
  paid?: boolean;
  payment_method?: PaymentMethod | null;
  payment_method_other?: string | null;
  fulfilled_date?: string | null;
  delivered_at?: string | null;
  delivery_method?: DeliveryMethod | null;
  delivery_photo_path?: string | null;
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  items: { name: string; option_name?: string | null; unit_price: number | string; quantity: number }[];
};

function mapApprovalPayload(data: unknown): ApprovalOrder | null {
  if (!data) return null;
  const row = data as ApprovalPayload;
  return {
    orderNumber: row.order_number,
    customerName: row.customer_name ?? "",
    dueDate: row.due_date,
    deliveryTime: row.delivery_time?.trim() ?? "",
    status: row.status,
    approvalStatus: row.approval_status,
    approvedAt: row.approved_at ?? "",
    approvedTotal: row.approved_total == null ? null : Number(row.approved_total),
    declinedAt: row.declined_at ?? "",
    discount:
      row.discount_type && Number(row.discount_value) > 0
        ? { type: row.discount_type, value: Number(row.discount_value) }
        : null,
    paid: row.paid ?? false,
    paymentMethod: row.payment_method ?? null,
    paymentMethodOther: row.payment_method_other ?? "",
    fulfilledDate: row.fulfilled_date ?? "",
    deliveredAt: row.delivered_at ?? "",
    deliveryMethod: row.delivery_method ?? null,
    deliveryPhotoPath: row.delivery_photo_path ?? "",
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total),
    items: row.items.map((item) => ({
      name: item.name,
      optionName: item.option_name?.trim() || DEFAULT_OPTION_NAME,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
    })),
  };
}

/** Public, token-gated lookup used by the customer approval page. */
export async function getOrderForApproval(token: string): Promise<ApprovalOrder | null> {
  const { data, error } = await supabase.rpc("get_order_for_approval", { p_token: token });
  throwIfError(error);
  return mapApprovalPayload(data);
}

/** Public, token-gated approval; the approved amount is calculated on the server. */
export async function approveOrder(token: string, name: string): Promise<ApprovalOrder | null> {
  const { data, error } = await supabase.rpc("approve_order", { p_token: token, p_name: name });
  throwIfError(error);
  return mapApprovalPayload(data);
}

/** Public, token-gated decline; only an order awaiting approval can be declined. */
export async function declineOrder(token: string): Promise<ApprovalOrder | null> {
  const { data, error } = await supabase.rpc("decline_order", { p_token: token });
  throwIfError(error);
  return mapApprovalPayload(data);
}

export async function savePushToken(ownerId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from("admin_push_tokens")
    .upsert({ owner_id: ownerId, token }, { onConflict: "owner_id,token" });
  throwIfError(error);
}

export type ApprovalActivity = {
  id: string;
  number: string;
  customer: string;
  status: "pending" | "approved" | "declined";
  approvedAt: string;
  declinedAt: string;
  approvedByName: string;
  approvedTotal: number | null;
  createdAt: string;
};

export type HolidayRequestActivity = {
  id: string;
  sourceOrderId: string;
  number: string;
  customer: string;
  phone: string;
  email: string;
  dueDate: string;
  notes: string;
  requestedItems: { productName: string; optionName: string; sourceName: string; quantity: number; unitPrice: number }[];
  createdAt: string;
  status: "pending" | "converted";
  convertedOrderId: string | null;
};

/** Thanksgiving requests are separate from orders until an owner converts one. */
export async function listHolidayRequestActivity(): Promise<HolidayRequestActivity[]> {
  const { data, error } = await supabase
    .from("admin_order_requests")
    .select("id,source_order_id,source_order_number,customer_name,customer_phone,customer_email,due_date,request_notes,requested_items,created_at,status,converted_order_id")
    .order("created_at", { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceOrderId: row.source_order_id,
    number: row.source_order_number,
    customer: row.customer_name ?? "Customer",
    phone: row.customer_phone ?? "",
    email: row.customer_email ?? "",
    dueDate: row.due_date,
    notes: row.request_notes ?? "",
    requestedItems: Array.isArray(row.requested_items)
      ? row.requested_items.flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const value = item as { productName?: unknown; optionName?: unknown; quantity?: unknown; unitPrice?: unknown };
          if (typeof value.productName !== "string" || !Number.isFinite(Number(value.quantity))) return [];
          const rawOption = extractOptionName((item as { raw?: unknown }).raw);
          const savedOption = hasOptionLabel(typeof value.optionName === "string" ? value.optionName : "")
            ? (value.optionName as string).trim()
            : rawOption;
          // Website names like "Sourdough - Veggie" carry the option in the text when no option was saved.
          const { productName, optionName } = hasOptionLabel(savedOption)
            ? { productName: value.productName.trim(), optionName: savedOption }
            : splitOptionFromName(value.productName);
          return [{ productName, optionName, sourceName: value.productName.trim(), quantity: Number(value.quantity), unitPrice: Number(value.unitPrice) || 0 }];
        })
      : [],
    createdAt: row.created_at,
    status: row.status as "pending" | "converted",
    convertedOrderId: row.converted_order_id ?? null,
  }));
}

export async function deleteHolidayRequest(requestId: string): Promise<void> {
  const { data, error } = await supabase
    .from("admin_order_requests")
    .delete()
    .eq("id", requestId)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Request was not deleted. Apply the latest database migration and try again.");
}

export async function markHolidayRequestConverted(requestId: string, orderId: string): Promise<void> {
  const { data, error } = await supabase
    .from("admin_order_requests")
    .update({ status: "converted", converted_order_id: orderId })
    .eq("id", requestId)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Request was not found for this account.");
}

/** Orders waiting on, or already given, customer approval. Empty until the approval migration is applied. */
export async function listApprovalActivity(): Promise<ApprovalActivity[]> {
  const { data, error } = await supabase
    .from("admin_orders")
    .select("id,order_number,customer_name,approval_status,approved_at,declined_at,approved_by_name,approved_total,created_at,status")
    .in("approval_status", ["pending", "approved", "declined"])
    .neq("status", "Cancelled")
    .order("created_at", { ascending: false })
    .limit(100);
  if (isMissingPaymentColumn(error)) return [];
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.order_number,
    customer: row.customer_name ?? "Customer",
    status: row.approval_status as "pending" | "approved" | "declined",
    approvedAt: row.approved_at ?? "",
    declinedAt: row.declined_at ?? "",
    approvedByName: row.approved_by_name ?? "",
    approvedTotal: row.approved_total == null ? null : Number(row.approved_total),
    createdAt: row.created_at,
  }));
}

/** One ingredient needed to make a single unit of a catalog item. */
export type RecipeIngredient = { id: string; productId: string; ingredient: string; quantity: number; unit: string };
export type RecipeIngredientInput = { ingredient: string; quantity: number; unit: string };

export async function listRecipes(productId?: string): Promise<RecipeIngredient[]> {
  let query = supabase
    .from("admin_product_recipes")
    .select("id,product_id,ingredient,quantity,unit")
    .order("sort_order", { ascending: true })
    .limit(2000);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    productId: row.product_id as string,
    ingredient: row.ingredient as string,
    quantity: Number(row.quantity),
    unit: (row.unit as string) ?? "",
  }));
}

/** Replaces a catalog item's recipe with the given ingredients. */
export async function saveRecipe(ownerId: string, productId: string, ingredients: RecipeIngredientInput[]): Promise<void> {
  const rows = ingredients.map((entry, index) => {
    const ingredient = entry.ingredient.trim();
    if (!ingredient) throw new Error("Every ingredient needs a name.");
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) throw new Error(`Enter an amount above zero for “${ingredient}”.`);
    return { owner_id: ownerId, product_id: productId, ingredient, quantity: entry.quantity, unit: entry.unit.trim(), sort_order: index };
  });
  const { error: deleteError } = await supabase.from("admin_product_recipes").delete().eq("product_id", productId);
  throwIfError(deleteError);
  if (!rows.length) return;
  const { error } = await supabase.from("admin_product_recipes").insert(rows);
  throwIfError(error);
}
