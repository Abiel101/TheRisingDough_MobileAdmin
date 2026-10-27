export type NativeIconName = "close" | "search" | "back" | "forward" | "more";

export type NativeIconProps = {
  name: NativeIconName;
  size?: number;
  color?: string;
};

export const fallbackGlyphs: Record<NativeIconName, string> = {
  close: "✕",
  search: "⌕",
  back: "‹",
  forward: "›",
  more: "•••",
};
