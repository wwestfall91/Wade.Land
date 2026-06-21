import { describe, expect, it } from "vitest";
import {
    applyDivide,
    applyIncubate,
    applyMix,
    applyRefine,
    mergeEnhancements,
    type ElementStats,
} from "./combinationCalculations";

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseElement = (): ElementStats => ({
    letter: "F",
    damage: 100,
    energy: 20,
    level: 1,
    description: "A test element",
    type1: "fire",
    effects: [],
});

// ─── mergeEnhancements ───────────────────────────────────────────────────────

describe("mergeEnhancements", () => {
    it("returns undefined when no flags are set", () => {
        expect(mergeEnhancements(undefined, undefined)).toBeUndefined();
        expect(mergeEnhancements({}, undefined)).toBeUndefined();
    });

    it("sets the incubated flag", () => {
        expect(mergeEnhancements(undefined, "incubate")).toEqual({
            incubated: true, divided: false, mixed: false, refined: false,
        });
    });

    it("sets the refined flag", () => {
        expect(mergeEnhancements(undefined, "refine")).toEqual({
            incubated: false, divided: false, mixed: false, refined: true,
        });
    });

    it("sets the mixed flag", () => {
        expect(mergeEnhancements(undefined, "mix")).toEqual({
            incubated: false, divided: false, mixed: true, refined: false,
        });
    });

    it("sets the divided flag", () => {
        expect(mergeEnhancements(undefined, "divide")).toEqual({
            incubated: false, divided: true, mixed: false, refined: false,
        });
    });

    it("preserves existing flags when adding a new one", () => {
        const inherited = { incubated: true, divided: false, mixed: false, refined: false };
        expect(mergeEnhancements(inherited, "refine")).toEqual({
            incubated: true, divided: false, mixed: false, refined: true,
        });
    });

    it("returns undefined when inherited flags are all false and no stateKey given", () => {
        expect(mergeEnhancements({ incubated: false, divided: false, mixed: false, refined: false }))
            .toBeUndefined();
    });

    it("preserves a flag that was already true without a stateKey", () => {
        expect(mergeEnhancements({ incubated: true })).toEqual({
            incubated: true, divided: false, mixed: false, refined: false,
        });
    });
});

// ─── applyIncubate ───────────────────────────────────────────────────────────

describe("applyIncubate", () => {
    it("does not change damage", () => {
        const result = applyIncubate(baseElement(), 1);
        expect(result.damage).toBe(100);
    });

    it("does not change energy", () => {
        const result = applyIncubate(baseElement(), 1);
        expect(result.energy).toBe(20);
    });

    it("sets the incubated enhancement flag", () => {
        const result = applyIncubate(baseElement(), 1);
        expect(result.enhancements?.incubated).toBe(true);
    });

    it("preserves other enhancement flags", () => {
        const input = { ...baseElement(), enhancements: { refined: true } };
        const result = applyIncubate(input, 1);
        expect(result.enhancements).toEqual({ incubated: true, refined: true, divided: false, mixed: false });
    });

    it("scales effect amounts by battles × 1.75 (rounds)", () => {
        const input = {
            ...baseElement(),
            effects: [
                { kind: "burn" as const, amount: 10 },
                { kind: "poison" as const, amount: 7 },
            ],
        };
        const result = applyIncubate(input, 2); // multiplier = 3.5
        expect(result.effects?.[0].amount).toBe(Math.round(10 * 3.5)); // 35
        expect(result.effects?.[1].amount).toBe(Math.round(7 * 3.5));  // 25 (24.5 rounds to 25)
    });

    it("leaves effects without an amount field unchanged", () => {
        const input = {
            ...baseElement(),
            effects: [{ kind: "explode" as const }],
        };
        const result = applyIncubate(input, 3);
        expect(result.effects?.[0].amount).toBeUndefined();
    });

    it("handles zero effects gracefully", () => {
        const result = applyIncubate({ ...baseElement(), effects: [] }, 2);
        expect(result.effects).toEqual([]);
    });

    it("produces correct multiplier at 1 battle (1.75×)", () => {
        const input = { ...baseElement(), effects: [{ kind: "burn" as const, amount: 100 }] };
        const result = applyIncubate(input, 1);
        expect(result.effects?.[0].amount).toBe(175);
    });

    it("produces correct multiplier at 3 battles (5.25×)", () => {
        const input = { ...baseElement(), effects: [{ kind: "burn" as const, amount: 100 }] };
        const result = applyIncubate(input, 3);
        expect(result.effects?.[0].amount).toBe(525);
    });

    it("preserves non-stat fields (letter, level, types, category)", () => {
        const input = { ...baseElement(), type2: "water", category: "element" };
        const result = applyIncubate(input, 1);
        expect(result.letter).toBe("F");
        expect(result.level).toBe(1);
        expect(result.type1).toBe("fire");
        expect(result.type2).toBe("water");
        expect(result.category).toBe("element");
    });
});

// ─── applyRefine ─────────────────────────────────────────────────────────────

describe("applyRefine", () => {
    it("scales damage by battles × 2", () => {
        expect(applyRefine(baseElement(), 1).damage).toBe(200);
        expect(applyRefine(baseElement(), 2).damage).toBe(400);
        expect(applyRefine(baseElement(), 3).damage).toBe(600);
    });

    it("rounds the scaled damage", () => {
        const input = { ...baseElement(), damage: 33 };
        expect(applyRefine(input, 1).damage).toBe(66);  // exact
    });

    it("does not change energy", () => {
        expect(applyRefine(baseElement(), 2).energy).toBe(20);
    });

    it("sets the refined enhancement flag", () => {
        expect(applyRefine(baseElement(), 1).enhancements?.refined).toBe(true);
    });

    it("preserves other enhancement flags", () => {
        const input = { ...baseElement(), enhancements: { incubated: true } };
        const result = applyRefine(input, 1);
        expect(result.enhancements).toEqual({ incubated: true, divided: false, mixed: false, refined: true });
    });

    it("passes effects through unchanged", () => {
        const effects = [{ kind: "burn" as const, amount: 50 }];
        const input = { ...baseElement(), effects };
        const result = applyRefine(input, 2);
        expect(result.effects).toBe(input.effects); // same reference
    });

    it("preserves non-stat fields", () => {
        const result = applyRefine(baseElement(), 1);
        expect(result.letter).toBe("F");
        expect(result.level).toBe(1);
        expect(result.type1).toBe("fire");
    });
});

// ─── applyDivide ─────────────────────────────────────────────────────────────

describe("applyDivide", () => {
    it("splits damage with ceil bias on top", () => {
        const { top, bottom } = applyDivide({ ...baseElement(), damage: 101 });
        expect(top.damage).toBe(51);    // Math.ceil(101/2)
        expect(bottom.damage).toBe(51); // same due to ceil
    });

    it("splits even damage equally", () => {
        const { top, bottom } = applyDivide({ ...baseElement(), damage: 100 });
        expect(top.damage).toBe(50);
        expect(bottom.damage).toBe(50);
    });

    it("splits energy with ceil top, floor bottom", () => {
        const { top, bottom } = applyDivide({ ...baseElement(), energy: 7 });
        expect(top.energy).toBe(4);    // Math.ceil(7/2)
        expect(bottom.energy).toBe(3); // Math.floor(7/2)
    });

    it("preserves undefined energy", () => {
        const input = { ...baseElement(), energy: undefined };
        const { top, bottom } = applyDivide(input);
        expect(top.energy).toBeUndefined();
        expect(bottom.energy).toBeUndefined();
    });

    it("splits 4 effects evenly (2 each)", () => {
        const effects = [
            { kind: "burn" as const, amount: 1 },
            { kind: "burn" as const, amount: 2 },
            { kind: "poison" as const, amount: 3 },
            { kind: "poison" as const, amount: 4 },
        ];
        const { top, bottom } = applyDivide({ ...baseElement(), effects });
        expect(top.effects).toHaveLength(2);
        expect(bottom.effects).toHaveLength(2);
        expect(top.effects?.[0].amount).toBe(1);
        expect(bottom.effects?.[0].amount).toBe(3);
    });

    it("splits 3 effects with ceil bias (2 top, 1 bottom)", () => {
        const effects = [
            { kind: "burn" as const, amount: 1 },
            { kind: "burn" as const, amount: 2 },
            { kind: "poison" as const, amount: 3 },
        ];
        const { top, bottom } = applyDivide({ ...baseElement(), effects });
        expect(top.effects).toHaveLength(2);
        expect(bottom.effects).toHaveLength(1);
    });

    it("splits 1 effect: top gets it, bottom gets none", () => {
        const effects = [{ kind: "burn" as const, amount: 10 }];
        const { top, bottom } = applyDivide({ ...baseElement(), effects });
        expect(top.effects).toHaveLength(1);
        expect(bottom.effects).toHaveLength(0);
    });

    it("handles zero effects", () => {
        const { top, bottom } = applyDivide({ ...baseElement(), effects: [] });
        expect(top.effects).toEqual([]);
        expect(bottom.effects).toEqual([]);
    });

    it("sets the divided flag only on the top output", () => {
        const { top, bottom } = applyDivide(baseElement());
        expect(top.enhancements?.divided).toBe(true);
        expect((bottom as ElementStats).enhancements).toBeUndefined();
    });

    it("preserves existing enhancement flags in the top output", () => {
        const input = { ...baseElement(), enhancements: { refined: true } };
        const { top } = applyDivide(input);
        expect(top.enhancements).toEqual({ incubated: false, divided: true, mixed: false, refined: true });
    });

    it("preserves letter and descriptive fields on both outputs", () => {
        const input = { ...baseElement(), type2: "water", category: "element" };
        const { top, bottom } = applyDivide(input);
        for (const output of [top, bottom]) {
            expect(output.letter).toBe("F");
            expect(output.level).toBe(1);
            expect(output.type1).toBe("fire");
            expect(output.type2).toBe("water");
            expect(output.category).toBe("element");
        }
    });
});

// ─── applyMix ────────────────────────────────────────────────────────────────

describe("applyMix", () => {
    const primaryEl = (): ElementStats => ({
        ...baseElement(),
        effects: [{ kind: "burn" as const, amount: 10 }],
        category: "element",
    });

    const secondaryEl = (): ElementStats => ({
        letter: "W",
        damage: 50,
        energy: 5,
        level: 1,
        description: "Secondary element",
        type1: "water",
        effects: [{ kind: "poison" as const, amount: 5 }],
    });

    it("uses letter and damage from primary", () => {
        const result = applyMix(primaryEl(), secondaryEl());
        expect(result.letter).toBe("F");
        expect(result.damage).toBe(100);
    });

    it("uses energy and types from primary", () => {
        const result = applyMix(primaryEl(), secondaryEl());
        expect(result.energy).toBe(20);
        expect(result.type1).toBe("fire");
    });

    it("merges primary and secondary effects in order (primary first)", () => {
        const result = applyMix(primaryEl(), secondaryEl());
        expect(result.effects).toHaveLength(2);
        expect(result.effects?.[0].kind).toBe("burn");
        expect(result.effects?.[1].kind).toBe("poison");
    });

    it("sets the mixed enhancement flag", () => {
        const result = applyMix(primaryEl(), secondaryEl());
        expect(result.enhancements?.mixed).toBe(true);
    });

    it("preserves existing enhancement flags from primary", () => {
        const primary = { ...primaryEl(), enhancements: { incubated: true } };
        const result = applyMix(primary, secondaryEl());
        expect(result.enhancements).toEqual({ incubated: true, divided: false, mixed: true, refined: false });
    });

    it("works when either element has no effects", () => {
        const noEffectsPrimary = { ...primaryEl(), effects: [] };
        const result = applyMix(noEffectsPrimary, secondaryEl());
        expect(result.effects).toHaveLength(1);
        expect(result.effects?.[0].kind).toBe("poison");
    });

    it("works when both elements have no effects", () => {
        const result = applyMix({ ...primaryEl(), effects: [] }, { ...secondaryEl(), effects: [] });
        expect(result.effects).toEqual([]);
    });
});
