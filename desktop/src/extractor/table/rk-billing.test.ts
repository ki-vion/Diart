import { describe, expect, it } from "vitest";
import {
  assignRkBillingUnit,
  isRkBillingUnit,
  isRkPackagingUnitRow,
  parseRkPeSuffix,
  parseRkQtyUnitLine,
} from "./rk-billing";

describe("parseRkPeSuffix", () => {
  it("reads price_per and billing unit from PE column", () => {
    expect(parseRkPeSuffix("132,02 EUR/100 M")).toEqual({
      price_per: 100,
      billing_unit: "M",
    });
    expect(parseRkPeSuffix("EUR/1 ROL")).toEqual({
      price_per: null,
      billing_unit: "ROL",
    });
    expect(parseRkPeSuffix("EUR/1 M2")).toEqual({
      price_per: null,
      billing_unit: "M2",
    });
    expect(parseRkPeSuffix("EUR/1 KG")).toEqual({
      price_per: null,
      billing_unit: "KG",
    });
  });
});

describe("parseRkQtyUnitLine", () => {
  it("parses combined quantity and billing unit", () => {
    expect(parseRkQtyUnitLine("1 ROL")).toEqual({ quantity: 1, unit: "ROL" });
    expect(parseRkQtyUnitLine("1 PKT")).toEqual({ quantity: 1, unit: "PKT" });
    expect(parseRkQtyUnitLine("ROL")).toBeNull();
  });
});

describe("assignRkBillingUnit", () => {
  it("keeps billing ME over later packaging ST", () => {
    const item = { unit: "M2" as string | null };
    assignRkBillingUnit(item, "ST");
    expect(item.unit).toBe("M2");
  });

  it("replaces packaging unit with billing ME from PE", () => {
    const item = { unit: "ST" as string | null };
    assignRkBillingUnit(item, "M");
    expect(item.unit).toBe("M");
  });
});

describe("isRkPackagingUnitRow", () => {
  it("detects piece-count rows", () => {
    expect(isRkPackagingUnitRow("= 40")).toBe(true);
    expect(isRkPackagingUnitRow("= 40 ST")).toBe(true);
    expect(isRkPackagingUnitRow("1 ROL")).toBe(false);
  });
});

describe("isRkBillingUnit", () => {
  it("accepts ROL, M and KG", () => {
    expect(isRkBillingUnit("ROL")).toBe(true);
    expect(isRkBillingUnit("M")).toBe(true);
    expect(isRkBillingUnit("KG")).toBe(true);
  });
});
