import { describe, expect, it } from "vitest";
import { clusterLineIntoCells, inferColumnBoundaries } from "./cluster-columns";

describe("inferColumnBoundaries", () => {
  it("creates boundaries at large x gaps", () => {
    const boundaries = inferColumnBoundaries(
      [
        { text: "001", x: 40 },
        { text: "Artikel", x: 120 },
        { text: "2,00", x: 300 },
        { text: "Stk", x: 360 },
        { text: "10,00", x: 420 },
      ],
      25,
    );
    expect(boundaries.length).toBeGreaterThanOrEqual(3);
  });
});

describe("clusterLineIntoCells", () => {
  it("assigns tokens to columns by x gaps", () => {
    const words = [
      { text: "001", x: 40 },
      { text: "Artikel", x: 120 },
      { text: "2,00", x: 300 },
      { text: "Stk", x: 360 },
      { text: "10,00", x: 420 },
    ];
    const boundaries = inferColumnBoundaries(words, 25);
    const cells = clusterLineIntoCells(words, boundaries);
    expect(cells[0]).toContain("001");
    expect(cells.some((c) => c.includes("Artikel"))).toBe(true);
    expect(cells.some((c) => c.includes("2,00"))).toBe(true);
    expect(cells.some((c) => c.includes("Stk"))).toBe(true);
    expect(cells.some((c) => c.includes("10,00"))).toBe(true);
  });
});
