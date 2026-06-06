import { describe, expect, it } from "vitest";
import { getEffectSummaryLines } from "./effectSummary";
import { parseSpellEffectsFromRow } from "./spellEffects";

describe("statusEffectsRegistry", () => {
    it("parses and summarizes newly added status effect kinds", () => {
        const effects = parseSpellEffectsFromRow({
            "Effect 1 Kind": "Poison",
            "Effect 1 Amount": 3,
            "Effect 1 Target": "enemy",
            "Effect 2 Kind": "Energy Combo",
            "Effect 2 Target": "fire",
            "Effect 3 Kind": "Rage",
            "Effect 3 Amount": 2,
            "Effect 3 Target": "self",
        });

        expect(effects.map((effect) => effect.kind)).toEqual(["poison", "energy_combo", "rage"]);

        expect(getEffectSummaryLines(effects)).toEqual([
            "Poison: +3",
            "Energy Combo: next Fire attack costs -1 energy",
            "Rage: +2",
        ]);
    });
});