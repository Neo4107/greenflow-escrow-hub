import { describe, expect, it } from "vitest";
import { deliveryFee } from "./eco";

describe("deliveryFee", () => {
  it("charges the R99 base up to 2 kg", () => {
    expect(deliveryFee({ weightKg: 1.5, lengthCm: 10, widthCm: 10, heightCm: 10 }).deliveryCents).toBe(9900);
  });
  it("adds R15 per extra kg of real weight", () => {
    expect(deliveryFee({ weightKg: 4.2, lengthCm: 10, widthCm: 10, heightCm: 10 }).deliveryCents).toBe(9900 + 3 * 1500);
  });
  it("uses volumetric weight when the parcel is bulky", () => {
    // 50×40×30 / 5000 = 12 kg volumetric
    expect(deliveryFee({ weightKg: 1, lengthCm: 50, widthCm: 40, heightCm: 30 }).deliveryCents).toBe(9900 + 10 * 1500);
  });
  it("multiplies by quantity", () => {
    expect(deliveryFee({ weightKg: 1.5, lengthCm: 10, widthCm: 10, heightCm: 10 }, 2).deliveryCents).toBe(9900 + 1500);
  });
});
