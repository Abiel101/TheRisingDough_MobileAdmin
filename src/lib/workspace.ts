import { supabase } from "@/lib/supabase";
import type { ApprovalStatus, Discount, DiscountType, OrderStatus, PaymentMethod } from "@/domain/orders";

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
};

export type ProductRecord = { id: string; name: string; price: number };
export type OrderLine = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
};
export type OrderItemInput = { product: ProductRecord; quantity: number };
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
type ProductRow = { id: string; name: string; unit_price: number | string };
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
  notes: string;
  created_at: string;
};
type OrderItemRow = {
  id: string;
  order_id: string;
  catalog_product_id: string | null;
  item_name: string;
  unit_price: number | string;
  quantity: number;
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function isMissingPaymentColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
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
  const { data, error } = await supabase
    .from("admin_products")
    .select("id,name,unit_price")
    .order("name", { ascending: true })
    .limit(500);
  throwIfError(error);
  return ((data ?? []) as ProductRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.unit_price),
  }));
}

export async function getProduct(id: string): Promise<ProductRecord | null> {
  const { data, error } = await supabase
    .from("admin_products")
    .select("id,name,unit_price")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  const row = data as ProductRow;
  return { id: row.id, name: row.name, price: Number(row.unit_price) };
}

export async function addProduct(
  ownerId: string,
  name: string,
  price: number,
): Promise<ProductRecord> {
  const { data, error } = await supabase
    .from("admin_products")
    .insert({ owner_id: ownerId, name: name.trim(), unit_price: price })
    .select("id,name,unit_price")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Supabase returned no catalog item.");
  const row = data as ProductRow;
  return { id: row.id, name: row.name, price: Number(row.unit_price) };
}

export async function removeProduct(id: string): Promise<void> {
  const { error } = await supabase.from("admin_products").delete().eq("id", id);
  throwIfError(error);
}

const baseOrderColumns =
  "id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,notes,created_at";
const paymentOrderColumns = `${baseOrderColumns},paid,payment_method,payment_method_other`;
const fullOrderColumns = `${paymentOrderColumns},discount_type,discount_value,approval_token,approval_status,approved_at,approved_by_name,approved_total`;

type OrderFeatures = { paymentTrackingAvailable: boolean; approvalAvailable: boolean };

// Falls back to older column sets until the matching Supabase migrations are applied.
async function selectOrderRows<T extends { error: { code?: string; message: string } | null; data: unknown }>(
  query: (columns: string) => PromiseLike<T>,
): Promise<{ result: T; features: OrderFeatures }> {
  let result = await query(fullOrderColumns);
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
    supabase
      .from("admin_order_items")
      .select("id,order_id,catalog_product_id,item_name,unit_price,quantity")
      .in("order_id", orderIds)
      .limit(2000),
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
  for (const row of (itemResult.data ?? []) as OrderItemRow[]) {
    const lines = itemsByOrder.get(row.order_id) ?? [];
    lines.push({
      id: row.id,
      productId: row.catalog_product_id ?? "",
      name: row.item_name,
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
      notes: row.notes,
      items: itemsByOrder.get(row.id) ?? [],
      createdAt: row.created_at,
    };
  });
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
  const { error } = await supabase.from("admin_order_items").insert(
    items.map(({ product, quantity }) => ({
      owner_id: ownerId,
      order_id: orderId,
      catalog_product_id: product.id,
      item_name: product.name,
      unit_price: product.price,
      quantity,
    })),
  );
  throwIfError(error);
}

export async function createOrder(input: {
  ownerId: string;
  customer: CustomerRecord;
  dueDate: string;
  notes: string;
  items: OrderItemInput[];
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
  const { data, error } = await supabase
    .from("admin_order_items")
    .select("id,catalog_product_id,unit_price,quantity")
    .eq("order_id", orderId);
  throwIfError(error);
  const current = (data ?? []) as {
    id: string;
    catalog_product_id: string | null;
    unit_price: number | string;
    quantity: number;
  }[];
  const nextItems = new Map(current.map((item) => [`${item.catalog_product_id ?? ""}:${Number(item.unit_price)}`, item]));
  const newItems: OrderItemInput[] = [];

  for (const input of items) {
    const key = `${input.product.id}:${input.product.price}`;
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
  status: OrderStatus;
  approvalStatus: ApprovalStatus;
  approvedAt: string;
  approvedTotal: number | null;
  subtotal: number;
  discountAmount: number;
  total: number;
  items: { name: string; unitPrice: number; quantity: number }[];
};

type ApprovalPayload = {
  order_number: string;
  customer_name: string | null;
  due_date: string;
  status: OrderStatus;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_total: number | string | null;
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  items: { name: string; unit_price: number | string; quantity: number }[];
};

function mapApprovalPayload(data: unknown): ApprovalOrder | null {
  if (!data) return null;
  const row = data as ApprovalPayload;
  return {
    orderNumber: row.order_number,
    customerName: row.customer_name ?? "",
    dueDate: row.due_date,
    status: row.status,
    approvalStatus: row.approval_status,
    approvedAt: row.approved_at ?? "",
    approvedTotal: row.approved_total == null ? null : Number(row.approved_total),
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total),
    items: row.items.map((item) => ({
      name: item.name,
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

export async function savePushToken(ownerId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from("admin_push_tokens")
    .upsert({ owner_id: ownerId, token }, { onConflict: "owner_id,token" });
  throwIfError(error);
}
