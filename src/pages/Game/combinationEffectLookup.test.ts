import { describe, expect, it } from "vitest";
import { parseSpellEffectsFromRow } from "../../combat/spellEffects";
import {
    buildEffectValuesByKey,
    buildMappedEffectRow,
    normalizeEffectLookupKey,
    resolveCombinationPreviewFromEffects,
    upgradeElementEffect,
    upgradeElementEffects,
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
            { Effect: "burn\r", "Short Description": "Applies burn on hit.", Amount: "2", Duration: "3", Target: "enemy", Growth: "+" },
            { Effect: "power combo", Amount: "50", Duration: "", Target: "fire", Growth: "+" },
        ];

        const effectValuesByKey = buildEffectValuesByKey(effectRows);
        const mappedEffectRow = buildMappedEffectRow("burn", effectValuesByKey);
        const parsed = parseSpellEffectsFromRow(mappedEffectRow, 1);

        expect(parsed).toEqual([
            {
                kind: "burn",
                shortDescription: "Applies burn on hit.",
                amount: 2,
                duration: 3,
                target: "enemy",
                growth: "+",
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

    describe("upgradeElementEffect", () => {
        it("increments amount when growth is +", () => {
            const effect = { kind: "burn" as const, amount: 2, target: "enemy" as const, growth: "+" as const };
            expect(upgradeElementEffect(effect, 1).amount).toBe(3);
            expect(upgradeElementEffect(effect, 5).amount).toBe(7);
        });

        it("decrements amount when growth is -", () => {
            const effect = { kind: "exhaust" as const, amount: 100, target: "self" as const, growth: "-" as const };
            expect(upgradeElementEffect(effect, 10).amount).toBe(90);
        });

        it("leaves amount unchanged when growth is =", () => {
            const effect = { kind: "heal" as const, amount: 5, target: "self" as const, growth: "=" as const };
            expect(upgradeElementEffect(effect, 1).amount).toBe(5);
        });

        it("leaves amount unchanged when growth is absent", () => {
            const effect = { kind: "heal" as const, amount: 5, target: "self" as const };
            expect(upgradeElementEffect(effect, 1).amount).toBe(5);
        });

        it("does not mutate the original effect", () => {
            const effect = { kind: "soak" as const, amount: 1, target: "enemy" as const, growth: "+" as const };
            const upgraded = upgradeElementEffect(effect, 1);
            expect(effect.amount).toBe(1);
            expect(upgraded.amount).toBe(2);
            expect(upgraded).not.toBe(effect);
        });
    });

    describe("upgradeElementEffects", () => {
        it("upgrades all upgradeable effects and leaves static ones unchanged", () => {
            const effects = [
                { kind: "burn" as const, amount: 2, target: "enemy" as const, growth: "+" as const },
                { kind: "heal" as const, amount: 5, target: "self" as const, growth: "=" as const },
                { kind: "exhaust" as const, amount: 50, target: "self" as const, growth: "-" as const },
            ];
            const upgraded = upgradeElementEffects(effects, 2);
            expect(upgraded[0].amount).toBe(4);
            expect(upgraded[1].amount).toBe(5);
            expect(upgraded[2].amount).toBe(48);
        });
    });
});
