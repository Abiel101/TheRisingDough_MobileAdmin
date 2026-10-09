import { supabase } from "@/lib/supabase";
import type { OrderStatus, PaymentMethod } from "@/domain/orders";

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
  productId: string;
  name: string;
  price: number;
  quantity: number;
};
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

export async function listOrders(options: {
  startDate?: string;
  endDateExclusive?: string;
  limit?: number;
} = {}): Promise<OrderRecord[]> {
  const queryOrders = (select: string) => {
    let query = supabase
    .from("admin_orders")
    .select(select)
    .order("due_date", { ascending: true })
    .limit(options.limit ?? 200);

    if (options.startDate) query = query.gte("due_date", options.startDate);
    if (options.endDateExclusive) query = query.lt("due_date", options.endDateExclusive);
    return query;
  };

  let result = await queryOrders(
    "id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,paid,payment_method,payment_method_other,notes,created_at",
  );
  let paymentTrackingAvailable = true;
  if (isMissingPaymentColumn(result.error)) {
    paymentTrackingAvailable = false;
    result = await queryOrders(
      "id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,notes,created_at",
    );
  }
  throwIfError(result.error);
  return mapOrderRows((result.data ?? []) as unknown as OrderRow[], paymentTrackingAvailable);
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const orderColumns =
    "id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,paid,payment_method,payment_method_other,notes,created_at";
  let result = await supabase
    .from("admin_orders")
    .select(orderColumns)
    .eq("id", id)
    .maybeSingle();
  let paymentTrackingAvailable = true;
  if (isMissingPaymentColumn(result.error)) {
    paymentTrackingAvailable = false;
    result = await supabase
      .from("admin_orders")
      .select("id,order_number,customer_id,customer_name,due_date,fulfilled_date,status,notes,created_at")
      .eq("id", id)
      .maybeSingle();
  }
  throwIfError(result.error);
  if (!result.data) return null;
  const orders = await mapOrderRows([result.data as OrderRow], paymentTrackingAvailable);
  return orders[0] ?? null;
}

async function mapOrderRows(
  orderRows: OrderRow[],
  paymentTrackingAvailable: boolean,
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
  },
): Promise<void> {
  const values: {
    status?: OrderStatus;
    paid?: boolean;
    payment_method?: PaymentMethod | null;
    payment_method_other?: string | null;
    fulfilled_date?: string | null;
  } = {};
  if (changes.status) {
    values.status = changes.status;
    values.fulfilled_date = changes.status === "Fulfilled" ? new Date().toISOString().slice(0, 10) : null;
  }
  if (changes.paid !== undefined) values.paid = changes.paid;
  if (changes.paymentMethod !== undefined) values.payment_method = changes.paymentMethod;
  if (changes.paymentMethodOther !== undefined) values.payment_method_other = changes.paymentMethodOther;

  const { data, error } = await supabase
    .from("admin_orders")
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Order was not found for this account.");
}
