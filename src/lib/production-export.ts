import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { groupLinesByItem, hasOptionLabel } from "@/domain/orders";
import { listOrders, listRecipes, type OrderRecord, type RecipeIngredient } from "@/lib/workspace";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const formatAmount = (value: number) => String(Math.round(value * 1000) / 1000);

/** Orders still waiting to be started (cancelled orders are excluded). */
export function isNotStarted(order: OrderRecord) {
  return order.status === "Pending";
}

export type IngredientTotal = { ingredient: string; unit: string; quantity: number };

/** Sums recipe amounts (per single unit) across every line of the given orders. */
export function totalIngredients(orders: readonly OrderRecord[], recipes: readonly RecipeIngredient[]) {
  const byProduct = new Map<string, RecipeIngredient[]>();
  for (const entry of recipes) byProduct.set(entry.productId, [...(byProduct.get(entry.productId) ?? []), entry]);
  const totals = new Map<string, IngredientTotal>();
  const missing = new Set<string>();
  for (const order of orders) {
    for (const line of order.items) {
      const recipe = byProduct.get(line.productId);
      if (!recipe) {
        missing.add(line.name);
        continue;
      }
      for (const entry of recipe) {
        const key = `${entry.ingredient.toLocaleLowerCase()}|${entry.unit.toLocaleLowerCase()}`;
        const current = totals.get(key) ?? { ingredient: entry.ingredient, unit: entry.unit, quantity: 0 };
        current.quantity += entry.quantity * line.quantity;
        totals.set(key, current);
      }
    }
  }
  const list = [...totals.values()].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  return { totals: list, missing: [...missing].sort() };
}

function buildHtml(orders: OrderRecord[], recipes: RecipeIngredient[]) {
  const sorted = [...orders].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number.localeCompare(b.number));
  const allLines = sorted.flatMap((order) => order.items);
  const { totals, missing } = totalIngredients(sorted, recipes);

  const productTotals = groupLinesByItem(allLines).map((group) => {
    const options = group.showOptions
      ? group.entries
          .map(({ line }) => `<div class="option">${escapeHtml(hasOptionLabel(line.optionName) ? line.optionName : "Default")} × ${line.quantity}</div>`)
          .join("")
      : "";
    return `<tr><td><strong>${escapeHtml(group.name)}</strong>${options}</td><td class="num">${group.quantity}</td></tr>`;
  });

  const orderRows = sorted.map((order) => {
    const lines = order.items
      .map((item) => `${item.quantity} × ${escapeHtml(item.name)}${hasOptionLabel(item.optionName) ? ` (${escapeHtml(item.optionName)})` : ""}`)
      .join("<br/>");
    return `<tr><td>${escapeHtml(order.number)}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.dueDate)}</td><td>${lines}${order.notes ? `<div class="note">${escapeHtml(order.notes)}</div>` : ""}</td></tr>`;
  });

  const ingredientRows = totals.map(
    (entry) => `<tr><td>${escapeHtml(entry.ingredient)}</td><td class="num">${formatAmount(entry.quantity)} ${escapeHtml(entry.unit)}</td></tr>`,
  );

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #302017; padding: 28px; }
    h1 { margin: 0; color: #174A46; } h2 { margin: 28px 0 8px; color: #174A46; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; border-bottom: 2px solid #302017; padding: 6px 4px; }
    td { padding: 6px 4px; border-bottom: 1px solid #E9E4DA; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; } .option { padding-left: 14px; color: #4A3A2E; }
    .note { color: #82796C; font-size: 12px; margin-top: 4px; } .warn { color: #B3261E; font-size: 13px; margin-top: 8px; }
  </style></head><body>
    <h1>Production list</h1>
    <div>${sorted.length} order${sorted.length === 1 ? "" : "s"} not started · ${escapeHtml(new Date().toLocaleDateString("en-US", { dateStyle: "long" }))}</div>
    <h2>Items to make</h2>
    <table><tr><th>Item</th><th class="num">Qty</th></tr>${productTotals.join("")}</table>
    <h2>Inventory needed</h2>
    ${ingredientRows.length ? `<table><tr><th>Ingredient</th><th class="num">Total</th></tr>${ingredientRows.join("")}</table>` : "<div>No recipes have been added yet.</div>"}
    ${missing.length ? `<div class="warn">No recipe yet for: ${missing.map(escapeHtml).join(", ")}</div>` : ""}
    <h2>Orders</h2>
    <table><tr><th>Order</th><th>Customer</th><th>Due</th><th>Items</th></tr>${orderRows.join("")}</table>
  </body></html>`;
}

/** Exports every order that has not been started, with item and ingredient totals, as a PDF. */
export async function exportNotStartedOrders(): Promise<number> {
  const [orders, recipes] = await Promise.all([listOrders({ limit: 500 }), listRecipes()]);
  const pending = orders.filter(isNotStarted);
  if (!pending.length) throw new Error("There are no orders waiting to be started.");
  const html = buildHtml(pending, recipes);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return pending.length;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Production list" });
  return pending.length;
}
