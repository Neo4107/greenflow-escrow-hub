export type CourierAddress = {
  streetAddress: string;
  suburb: string;
  city: string;
  postalCode: string;
  province: string;
};

export type CourierParcel = {
  description: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type CourierRate = {
  deliveryCents: number;
  serviceName: string;
  reference: string | null;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function priceInCents(rate: JsonObject): number | null {
  const priceFields = ["total_price", "rate", "price", "amount", "total_cost", "cost"];
  for (const field of priceFields) {
    const value = rate[field];
    const raw = typeof value === "number" || typeof value === "string" ? Number(value) : null;
    if (raw !== null && Number.isFinite(raw) && raw > 0) {
      return Math.round(raw * 100);
    }
    if (isObject(value)) {
      const nested = Number(value["amount"] ?? value["value"]);
      if (Number.isFinite(nested) && nested > 0) return Math.round(nested * 100);
    }
  }
  return null;
}

/** Parses ShipLogic rate payloads into the single cheapest usable door-to-door quote. */
export function parseCourierRate(payload: unknown): CourierRate | null {
  const roots: unknown[] = [payload];
  if (isObject(payload)) roots.push(payload["data"]);

  const candidates: JsonObject[] = [];
  for (const root of roots) {
    if (Array.isArray(root)) {
      candidates.push(...root.filter(isObject));
      continue;
    }
    if (!isObject(root)) continue;
    for (const field of ["rates", "rate_options", "quotes"]) {
      const list = root[field];
      if (Array.isArray(list)) candidates.push(...list.filter(isObject));
    }
  }

  const priced = candidates
    .map((rate) => ({ rate, deliveryCents: priceInCents(rate) }))
    .filter((entry): entry is { rate: JsonObject; deliveryCents: number } =>
      entry.deliveryCents !== null && entry.deliveryCents > 0,
    )
    .sort((a, b) => a.deliveryCents - b.deliveryCents);
  const selected = priced[0];
  if (!selected) return null;

  const rate = selected.rate;
  const serviceName = rate["service_name"] ?? rate["service_level_name"] ?? rate["service_level_code"];
  const reference = rate["id"] ?? rate["quote_id"] ?? rate["reference"];
  return {
    deliveryCents: selected.deliveryCents,
    serviceName: typeof serviceName === "string" ? serviceName : "The Courier Guy",
    reference: typeof reference === "string" || typeof reference === "number" ? String(reference) : null,
  };
}