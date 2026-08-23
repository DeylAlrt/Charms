export const LETTER_ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const baseColorOptions = ["Silver", "Gold", "Blue", "Black", "Brown", "Red", "Purple", "Pink"] as const;
export type BaseColor = typeof baseColorOptions[number];

export type Charm = {
  id: string;
  img: string;
  filename: string;
  category?: string;
  displayName?: string;
  catalogItem?: boolean;
  isPlaceholder?: boolean;
};

export const getPrice = (filename: string): number => {
  const lower = filename.toLowerCase();

  if (lower.includes("plain")) {
    if (lower.includes("gold")) return 1.50;
    if (lower.includes("silver")) return 1.00;
    if (lower.includes("red")) return 1.50;
    if (lower.includes("blue")) return 1.50;
    if (lower.includes("black")) return 1.50;
    if (lower.includes("brown")) return 1.50;
    if (lower.includes("purple")) return 1.50;
    if (lower.includes("pink")) return 1.50;
    return 1.00;
  }

  if (lower.includes("classic")) {
    if (lower.includes("concave")) return 2.50;
    if (lower.includes("gold")) return 3.00;
    if (lower.includes("outline")) return 3.50;
    if (lower.includes("colored")) return 4.00;
    if (lower.includes("solid")) return 4.50;
    return 0.00;
  }

  if (lower.includes("premium")) {
    if (lower.includes("starter")) return 5.00;
    if (lower.includes("charming")) return 7.00;
    if (lower.includes("iconic")) return 8.00;
    return 7.00;
  }

  if (lower.includes("deluxe")) {
    if (lower.includes("baby")) return 10.00;
    if (lower.includes("silver")) return 12.00;
    if (lower.includes("gold")) return 15.00;
    return 0.00;
  }

  if (lower.includes("flag")) {
    return 8.00;
  }

  if (lower.includes("letters")) {
    if (lower.includes("gold")) return 3.50;
    if (lower.includes("silver")) return 3.00;
    return 0.00;
  }

  if (lower.includes("number")) {
    return 3.00;
  }

  return 0.00;
};

export const getCategory = (filename: string): string => {
  const s = filename.toLowerCase();

  if (s.includes("classic") || s.includes("plain")) return "Classic Charms";
  if (s.includes("premium")) return "Premium Charms";
  if (s.includes("deluxe")) return "Deluxe Charms";
  if (s.includes("letters")) return "A-Z";
  if (s.includes("number")) return "0-9";
  if (s.includes("flags")) return "Flags";
  return "All";
};

export const getPlaceholderCharm = (color: BaseColor) => ({
  id: `placeholder-${color.toLowerCase()}`,
  img: `/charms/${color}_Plain_Charm.png`,
  filename: `${color}_Plain_Charm.png`,
  isPlaceholder: true,
});
