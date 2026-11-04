import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { allocateLineTotals, calculateOrderTotals, type PaymentMethod } from "@/domain/orders";
import type { OrderRecord } from "@/lib/workspace";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function longDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const methodLabels: Record<PaymentMethod, string> = { cash: "Cash", zelle: "Zelle", other: "Other" };

function paymentMethodText(order: OrderRecord) {
  if (!order.paymentMethod) return "Not recorded";
  return order.paymentMethod === "other" ? order.paymentMethodOther || "Other" : methodLabels[order.paymentMethod];
}

/** Invoices are only issued once an order is completed (fulfilled and paid). */
export function canInvoice(order: OrderRecord): boolean {
  return order.status === "Fulfilled" && order.paid;
}

export function buildInvoiceHtml(order: OrderRecord): string {
  const lineItems = order.items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    unitPrice: item.price,
    quantity: item.quantity,
  }));
  const { subtotal, discountAmount, total } = calculateOrderTotals(lineItems, order.discount);
  const discountedTotals = allocateLineTotals(lineItems, discountAmount);
  const discountLabel = order.discount
    ? order.discount.type === "percent"
      ? `Discount (${order.discount.value}%)`
      : "Discount"
    : "";
  const rows = order.items
    .map((item, index) => {
      const original = item.price * item.quantity;
      const discounted = discountedTotals[index];
      const isDiscounted = discounted < original;
      return `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${money(item.price)}</td>
        <td class="num">${isDiscounted ? `<span class="was">${money(original)}</span><br/><span class="sale">${money(discounted)}</span>` : money(original)}</td>
      </tr>`;
    })
    .join("");
  const status = "PAID";
  const contact = [order.customerPhone, order.customerEmail, order.customerAddress]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br/>");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #302017; padding: 32px; }
    h1 { font-family: Georgia, serif; margin: 0; font-size: 28px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .meta { text-align: right; font-size: 13px; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 6px; padding: 4px 10px; border: 1.5px solid #174A46; color: #174A46; border-radius: 6px; font-weight: 700; font-size: 12px; }
    .bill { margin: 28px 0 20px; font-size: 14px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; border-bottom: 2px solid #302017; padding: 8px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #E9E4DA; }
    .num { text-align: right; }
    .was { color: #82796C; text-decoration: line-through; font-size: 12px; }
    .sale { color: #D32F2F; font-weight: 700; }
    .pay { margin-top: 24px; font-size: 14px; border: 1px solid #E9E4DA; border-radius: 8px; padding: 12px; }
    .pay div { display: flex; justify-content: space-between; padding: 3px 0; }
    .totals { margin: 16px 0 0 auto; width: 260px; font-size: 14px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .grand { border-top: 2px solid #302017; font-weight: 700; font-size: 17px; margin-top: 4px; padding-top: 8px !important; }
    .notes { margin-top: 28px; font-size: 13px; color: #82796C; white-space: pre-wrap; }
    .foot { margin-top: 40px; text-align: center; font-size: 12px; color: #82796C; }
  </style></head><body>
    <div class="head">
      <div><h1>The Rising Dough</h1><div>Invoice</div></div>
      <div class="meta">
        <div><strong>${escapeHtml(order.number)}</strong></div>
        <div>Issued: ${longDate(new Date().toISOString().slice(0, 10))}</div>
        <div>Due: ${longDate(order.dueDate)}</div>
        <div class="badge">${status}</div>
      </div>
    </div>
    <div class="bill"><strong>Bill to</strong><br/>${escapeHtml(order.customer)}<br/>${contact}</div>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${discountAmount > 0 ? `<div class="sale"><span>${escapeHtml(discountLabel)}</span><span>−${money(discountAmount)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${money(total)}</span></div>
    </div>
    <div class="pay">
      <div><strong>Payment</strong><span></span></div>
      <div><span>Amount paid</span><span>${money(total)}</span></div>
      <div><span>Payment method</span><span>${escapeHtml(paymentMethodText(order))}</span></div>
      ${order.fulfilledDate ? `<div><span>Completed</span><span>${longDate(order.fulfilledDate)}</span></div>` : ""}
    </div>
    ${order.notes ? `<div class="notes"><strong>Notes</strong><br/>${escapeHtml(order.notes)}</div>` : ""}
    <div class="foot">Thank you for your order!</div>
  </body></html>`;
}

export async function printInvoice(order: OrderRecord): Promise<void> {
  if (!canInvoice(order)) throw new Error("Invoices are available once the order is completed.");
  await Print.printAsync({ html: buildInvoiceHtml(order) });
}

export async function shareInvoicePdf(order: OrderRecord): Promise<void> {
  if (!canInvoice(order)) throw new Error("Invoices are available once the order is completed.");
  if (Platform.OS === "web") {
    await printInvoice(order);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(order) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Invoice ${order.number}`,
  });
}
