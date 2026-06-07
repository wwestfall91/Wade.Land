import { describe, expect, it } from "vitest";
import { parseSpellEffectsFromRow } from "../../combat/spellEffects";
import {
    buildEffectValuesByKey,
    buildMappedEffectRow,
    normalizeEffectLookupKey,
    resolveCombinationPreviewFromEffects,
    type EffectWorkbookRow,
} from "./combinationEffectLookup";

describe("combination effect lookup", () => {
    it("normalizes effect keys across spacing, underscore, and case", () => {
        expect(normalizeEffectLookupKey("Power Combo")).toBe("powercombo");
        expect(normalizeEffectLookupKey("power_combo")).toBe("powercombo");
        expect(normalizeEffectLookupKey("  POWER-COMBO ")).toBe("powercombo");
    });

    it("hydrates mapped effect rows from effects.xlsx values by key", () => {
        const effectRows: EffectWorkbookRow[] = [
            { Effect: "burn\r", Amount: "2", Duration: "3", Target: "enemy" },
            { Effect: "power combo", Amount: "50", Duration: "", Target: "fire" },
        ];

        const effectValuesByKey = buildEffectValuesByKey(effectRows);
        const mappedEffectRow = buildMappedEffectRow("burn", effectValuesByKey);
        const parsed = parseSpellEffectsFromRow(mappedEffectRow, 1);

        expect(parsed).toEqual([
            {
                kind: "burn",
                amount: 2,
                duration: 3,
                target: "enemy",
            },
        ]);
    });

    it("maps multihit amount to hits when hydrating mapped row", () => {
        const effectRows: EffectWorkbookRow[] = [
            { Effect: "multihit", Amount: "3", Duration: "", Target: "" },
        ];

        const effectValuesByKey = buildEffectValuesByKey(effectRows);
        const mappedEffectRow = buildMappedEffectRow("multi hit", effectValuesByKey);
        const parsed = parseSpellEffectsFromRow(mappedEffectRow, 1);

        expect(parsed).toEqual([
            {
                kind: "multi_hit",
                amount: 3,
                hits: 3,
                target: "enemy",
            },
        ]);
    });

    it("applies powerful as a creation-time damage multiplier", () => {
        const resolution = resolveCombinationPreviewFromEffects(
            {
                damage: 20,
                energy: 3,
                effects: [{ kind: "burn", amount: 1, duration: 3, target: "enemy" }],
            },
            [{ kind: "powerful", amount: 150, target: "self" }],
        );

        expect(resolution.damage).toBe(50);
        expect(resolution.isDamageEnhanced).toBe(true);
        expect(resolution.baseDamageBeforeEnhance).toBe(20);
        expect(resolution.effects).toEqual([{ kind: "burn", amount: 1, duration: 3, target: "enemy" }]);
    });

    it("applies energetic and efficient from input effects to output stats and effects", () => {
        const resolution = resolveCombinationPreviewFromEffects(
            {
                damage: 40,
                energy: 4,
                effects: [{ kind: "burn", amount: 2, duration: 3, target: "enemy" }],
            },
            [
                { kind: "energetic", amount: 1, target: "self" },
                { kind: "efficient", amount: 150, target: "self" },
            ],
        );

        expect(resolution.damage).toBe(40);
        expect(resolution.energy).toBe(3);
        expect(resolution.effects).toEqual([
            { kind: "burn", amount: 5, duration: 8, target: "enemy" },
        ]);
    });
});
