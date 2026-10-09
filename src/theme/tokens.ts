export const colors = {
  teal: "#174A46",
  deepTeal: "#0F332F",
  espresso: "#302017",
  background: "#F7F5F0",
  cream: "#F2E4C9",
  paper: "#DCC9A5",
  parchment: "#FAF7F0",
  card: "#FFFEFA",
  mustard: "#D6A21E",
  lightMustard: "#E8BA45",
  sage: "#687A55",
  orange: "#C65A27",
  brick: "#A83F2D",
  bronze: "#A86F32",
  mutedText: "#82796C",
  border: "#E9E4DA",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

// Font files are not part of the starter repository yet. Keep the family names
// centralized so licensed Inter and Noto Serif assets can be added in one pass.
export const typography = {
  bodyFontFamily: "Inter",
  displayFontFamily: "Noto Serif",
} as const;
