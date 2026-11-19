import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { hasOptionLabel } from "@/domain/orders";
import { toPieceLine } from "@/domain/pack-quantities";
import { listOrders, listRecipes, type OrderRecord, type RecipeIngredient } from "@/lib/workspace";

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
      const pieces = toPieceLine({ name: line.name, quantity: line.quantity, price: line.price }).pieces;
      const recipe = byProduct.get(line.productId);
      if (!recipe) {
        missing.add(line.name);
        continue;
      }
      for (const entry of recipe) {
        const key = `${entry.ingredient.toLocaleLowerCase()}|${entry.unit.toLocaleLowerCase()}`;
        const current = totals.get(key) ?? { ingredient: entry.ingredient, unit: entry.unit, quantity: 0 };
        current.quantity += entry.quantity * pieces;
        totals.set(key, current);
      }
    }
  }
  const list = [...totals.values()].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  return { totals: list, missing: [...missing].sort() };
}

type Cell = string | number;

function csvCell(value: Cell) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const toCsv = (rows: Cell[][]) => `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

/** Builds the spreadsheet rows: total pieces per item first, then every order line. */
export function buildExportRows(orders: OrderRecord[], recipes: RecipeIngredient[]): Cell[][] {
  const sorted = [...orders].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number.localeCompare(b.number));
  const totals = new Map<string, { item: string; option: string; pieces: number }>();
  for (const order of sorted) {
    for (const line of order.items) {
      const piece = toPieceLine({ name: line.name, quantity: line.quantity, price: line.price });
      const option = hasOptionLabel(line.optionName) ? line.optionName : "";
      const key = `${piece.baseName.toLocaleLowerCase()}|${option.toLocaleLowerCase()}`;
      const entry = totals.get(key) ?? { item: piece.baseName, option, pieces: 0 };
      entry.pieces += piece.pieces;
      totals.set(key, entry);
    }
  }

  const rows: Cell[][] = [["TOTAL TO MAKE"], ["Item", "Option", "Total pieces"]];
  [...totals.values()]
    .sort((a, b) => a.item.localeCompare(b.item) || a.option.localeCompare(b.option))
    .forEach((entry) => rows.push([entry.item, entry.option, entry.pieces]));

  const { totals: ingredients, missing } = totalIngredients(sorted, recipes);
  if (ingredients.length) {
    rows.push([], ["INGREDIENTS NEEDED"], ["Ingredient", "Unit", "Quantity"]);
    ingredients.forEach((entry) => rows.push([entry.ingredient, entry.unit, Number(formatAmount(entry.quantity))]));
  }
  if (missing.length) rows.push([], ["No recipe yet for", missing.join("; ")]);

  rows.push([], ["ORDERS"], ["Order", "Customer", "Due", "Item", "Option", "Pack", "Packs ordered", "Pieces per pack", "Total pieces", "Price per pack", "Line total", "Notes"]);
  for (const order of sorted) {
    order.items.forEach((line, index) => {
      const piece = toPieceLine({ name: line.name, quantity: line.quantity, price: line.price });
      rows.push([
        order.number, order.customer, order.dueDate, piece.baseName,
        hasOptionLabel(line.optionName) ? line.optionName : "",
        piece.packLabel, piece.packs, piece.piecesPerPack, piece.pieces, piece.packPrice.toFixed(2), piece.lineTotal.toFixed(2),
        index === 0 ? order.notes : "",
      ]);
    });
  }
  return rows;
}

/** Exports every order that has not been started as a spreadsheet-ready CSV with piece counts. */
export async function exportNotStartedOrders(): Promise<number> {
  const [orders, recipes] = await Promise.all([listOrders({ limit: 500 }), listRecipes()]);
  const pending = orders.filter(isNotStarted);
  if (!pending.length) throw new Error("There are no orders waiting to be started.");
  const csv = toCsv(buildExportRows(pending, recipes));
  const fileName = `production-list-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return pending.length;
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: "Production list" });
  return pending.length;
}
