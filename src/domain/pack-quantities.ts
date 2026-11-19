import { parseRequestedName } from "@/domain/request-items";

export type PackLine = { name: string; optionName?: string; quantity: number; price: number };

export type PieceLine = {
  /** Item name without the pack label, e.g. "Cinnamon Rolls". */
  baseName: string;
  /** Pack label such as "Dozen", or "Single" for individual pieces. */
  packLabel: string;
  piecesPerPack: number;
  packs: number;
  /** Total individual pieces: packs × piecesPerPack (a dozen counts as 12). */
  pieces: number;
  packPrice: number;
  lineTotal: number;
};

/** Reads pack info from saved line names such as "Cinnamon Rolls · Dozen (12 pieces)". */
export function parsePackName(name: string): { baseName: string; packLabel: string; piecesPerPack: number } {
  const [rawBase, ...rest] = name.split("·").map((part) => part.trim());
  const suffix = rest.join(" · ");
  const explicit = /\((\d+)\s*pieces?\)/i.exec(suffix || name);
  if (explicit) {
    const label = suffix.replace(/\(\d+\s*pieces?\)/i, "").trim();
    return { baseName: rawBase, packLabel: label || `${explicit[1]} pack`, piecesPerPack: Number(explicit[1]) };
  }
  const parsed = parseRequestedName(name);
  if (parsed.packSize && parsed.packSize > 1) {
    const label = parsed.packSize === 6 ? "Half dozen" : parsed.packSize === 12 ? "Dozen" : `${parsed.packSize} pack`;
    const base = name.replace(/[\s·\-–—:(),]*\b(?:half[\s-]*(?:a[\s-]*)?dozen|dozen)\b[\s)]*/gi, " ").replace(/\s+/g, " ").trim();
    return { baseName: base || rawBase, packLabel: label, piecesPerPack: parsed.packSize };
  }
  return { baseName: name.trim(), packLabel: "Single", piecesPerPack: 1 };
}

export function toPieceLine(line: PackLine): PieceLine {
  const { baseName, packLabel, piecesPerPack } = parsePackName(line.name);
  return {
    baseName,
    packLabel,
    piecesPerPack,
    packs: line.quantity,
    pieces: line.quantity * piecesPerPack,
    packPrice: line.price,
    lineTotal: Math.round(line.price * line.quantity * 100) / 100,
  };
}
