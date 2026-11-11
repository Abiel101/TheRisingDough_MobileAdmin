import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { allocateLineTotals, calculateOrderTotals, groupLinesByItem, hasOptionLabel, type PaymentMethod } from "@/domain/orders";
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
    optionName: item.optionName,
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
  const lineRow = (index: number, label: string, indent: boolean) => {
    const item = order.items[index];
    const original = item.price * item.quantity;
    const discounted = discountedTotals[index];
    const isDiscounted = discounted < original;
    return `<tr>
        <td${indent ? ' class="option"' : ""}>${escapeHtml(label)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${money(item.price)}</td>
        <td class="num">${isDiscounted ? `<span class="was">${money(original)}</span><br/><span class="sale">${money(discounted)}</span>` : money(original)}</td>
      </tr>`;
  };
  const rows = groupLinesByItem(order.items)
    .map((group) =>
      group.showOptions
        ? `<tr class="group"><td colspan="4">${escapeHtml(group.name)}</td></tr>` +
          group.entries
            .map(({ line, index }) => lineRow(index, hasOptionLabel(line.optionName) ? line.optionName : "Default", true))
            .join("")
        : group.entries.map(({ index }) => lineRow(index, order.items[index].name, false)).join(""),
    )
    .join("");
  const status = "PAID";
  const contact = [order.customerPhone, order.customerEmail, order.customerAddress]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br/>");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #302017; margin: 0; padding: 32px; background: #FBF7EF; position: relative; min-height: 100vh; overflow: hidden; }
    .waves { position: absolute; left: 0; width: 100%; z-index: 0; }
    .waves.top { top: 0; height: 170px; }
    .waves.bottom { bottom: 0; height: 190px; }
    .content { position: relative; z-index: 1; }
    .stamp { position: absolute; right: 36px; top: 46%; transform: rotate(-14deg); z-index: 2; border: 4px double #174A46; color: #174A46; border-radius: 12px; padding: 6px 22px; font-family: Georgia, serif; font-size: 44px; font-weight: 700; letter-spacing: 6px; opacity: 0.55; text-align: center; line-height: 1; }
    .stamp small { display: block; font-size: 10px; letter-spacing: 3px; margin-top: 4px; font-family: -apple-system, Helvetica, Arial, sans-serif; }
    h1 { font-family: Georgia, serif; margin: 0; font-size: 30px; color: #174A46; }
    .head .tag { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #8A6A3F; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .meta { text-align: right; font-size: 13px; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 6px; padding: 4px 10px; border: 1.5px solid #174A46; color: #174A46; border-radius: 6px; font-weight: 700; font-size: 12px; }
    .bill { margin: 28px 0 20px; font-size: 14px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; border-bottom: 2px solid #302017; padding: 8px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #E9E4DA; }
    .num { text-align: right; }
    .group td { font-weight: 700; border-bottom: none; padding-bottom: 2px; }
    .option { padding-left: 20px; color: #4A3A2E; }
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
    <svg class="waves top" viewBox="0 0 800 170" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0H800V70C700 120 620 40 520 70C420 100 340 140 240 100C140 60 80 100 0 90Z" fill="#EFE3CC"/>
      <path d="M0 0H800V40C700 85 620 10 520 40C420 70 340 105 240 70C140 35 80 70 0 60Z" fill="#DCE8E2"/>
    </svg>
    <svg class="waves bottom" viewBox="0 0 800 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 80C100 40 180 110 280 80C380 50 460 10 560 50C660 90 720 50 800 70V190H0Z" fill="#EFE3CC"/>
      <path d="M0 120C100 80 180 150 280 120C380 90 460 60 560 95C660 130 720 100 800 110V190H0Z" fill="#DCE8E2"/>
    </svg>
    <div class="stamp">PAID<small>THE RISING DOUGH</small></div>
    <div class="content">
    <div class="head">
      <div><h1>The Rising Dough</h1><div class="tag">Fresh baked · Invoice</div></div>
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
    </div>
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
