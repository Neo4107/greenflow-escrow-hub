export const ECO_ATTRIBUTES = [
  "zero-waste",
  "vegan",
  "certified-organic",
  "biodegradable",
  "plastic-free",
  "refillable",
  "upcycled",
  "locally-made",
  "carbon-neutral",
  "cruelty-free",
] as const;

export type EcoAttribute = (typeof ECO_ATTRIBUTES)[number];

export const ECO_LABELS: Record<string, string> = {
  "zero-waste": "Zero waste",
  vegan: "Vegan",
  "certified-organic": "Certified organic",
  biodegradable: "Biodegradable",
  "plastic-free": "Plastic free",
  refillable: "Refillable",
  upcycled: "Upcycled",
  "locally-made": "Locally made",
  "carbon-neutral": "Carbon neutral",
  "cruelty-free": "Cruelty free",
};

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

/** Fixed platform fee every seller pays each month, in cents. */
export const SUBSCRIPTION_FEE_CENTS = 24000;
/** Marketplace cut of the gross product subtotal. */
export const COMMISSION_RATE = 0.1;
/** Days a buyer payment stays in escrow before the seller's 90% is released. */
export const ESCROW_DAYS = 14;

export function formatRands(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function commissionBreakdown(subtotalCents: number) {
  const commission = Math.round(subtotalCents * COMMISSION_RATE);
  return {
    subtotalCents,
    commissionCents: commission,
    payoutCents: subtotalCents - commission,
  };
}
