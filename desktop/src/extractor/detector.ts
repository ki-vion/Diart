import { KanIfbStrategy } from "./strategies/kan_ifb";
import { LaierVanStrategy } from "./strategies/laier_van";
import { NoritRechnungStrategy } from "./strategies/norit_rechnung";
import { RkStarkStrategy } from "./strategies/rk_stark";
import type { Strategy } from "./strategies/base";

export const STRATEGIES: Strategy[] = [
  KanIfbStrategy,
  NoritRechnungStrategy,
  RkStarkStrategy,
  LaierVanStrategy,
];

export function detectStrategy(page0Text: string): Strategy {
  for (const strategy of STRATEGIES) {
    if (strategy.matchesPage0Text(page0Text)) return strategy;
  }
  throw new Error("LAYOUT_UNKNOWN");
}

