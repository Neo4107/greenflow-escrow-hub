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

/** Fixed platform fee charged to each seller's balance every month, in cents. */
export const SUBSCRIPTION_FEE_CENTS = 24000;
/** Same fee, named for the pay-from-sales balance model. */
export const PLATFORM_FEE_CENTS = SUBSCRIPTION_FEE_CENTS;
/** Marketplace cut of the gross product subtotal. */
export const COMMISSION_RATE = 0.1;
/** Days a buyer payment stays in escrow before the seller's 90% is released. */
export const ESCROW_DAYS = 14;
/** Days an unpaid balance may run before the seller gets the outstanding-balance notice. */
export const FEE_NOTICE_DAYS = 90;

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

/** Courier volumetric divisor: L×W×H (cm) / 5000 = volumetric kg. */
export const VOLUMETRIC_DIVISOR = 5000;
/** Delivery base fee covering the first DELIVERY_BASE_KG of chargeable weight. */
export const DELIVERY_BASE_CENTS = 9900;
export const DELIVERY_BASE_KG = 2;
/** Charged for each extra kg (or part of a kg) above the base. */
export const DELIVERY_PER_KG_CENTS = 1500;

export type ParcelSize = { weightKg: number; lengthCm: number; widthCm: number; heightCm: number };

/** Delivery fee: the bigger of real weight and volumetric weight decides the price. */
export function deliveryFee(item: ParcelSize, quantity = 1) {
  const volumetricKg = (item.lengthCm * item.widthCm * item.heightCm) / VOLUMETRIC_DIVISOR;
  const chargeableKg = Math.max(item.weightKg, volumetricKg) * quantity;
  const extraKg = Math.max(0, Math.ceil(chargeableKg - DELIVERY_BASE_KG - 1e-9));
  return {
    chargeableKg: Math.round(chargeableKg * 100) / 100,
    deliveryCents: DELIVERY_BASE_CENTS + extraKg * DELIVERY_PER_KG_CENTS,
  };
}
