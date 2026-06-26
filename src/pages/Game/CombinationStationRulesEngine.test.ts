import { describe, expect, it } from "vitest";
import {
    CombinationStationRulesEngine,
    combinationStationRulesEngine,
} from "./CombinationStationRulesEngine";
import { COMBINATION_MODE_RULES, type ModePreviewContext } from "./combinationModeRules";
import type { DraggableItem } from "./combinationTypes";
import type { RewardElement } from "../../context/PlayerContext";

const makeItem = (overrides: Partial<DraggableItem> = {}): DraggableItem => ({
    id: 1,
    letter: "Ember",
    damage: 10,
    energy: 4,
    rank: 2,
    level: 3,
    description: "A test element",
    type1: "fire",
    effects: [{ kind: "flame", target: "enemy", amount: 6, growth: "+" }],
    initialPosition: { x: 0, y: 0 },
    ...overrides,
});

// Mode sentinel convention used by Game.tsx: negative ids identify sealed modes.
const isModeSentinelId = (id: number): boolean => id <= -100;

const makeContext = (
    occupantItems: Array<DraggableItem | undefined>,
    lookupCatalogElement: (letter: string) => RewardElement | undefined = () => undefined,
): ModePreviewContext => ({
    occupantItems,
    consumedIds: occupantItems
        .filter((item): item is DraggableItem => Boolean(item) && !isModeSentinelId(item.id))
        .map((item) => item.id),
    isModeSentinelId,
    lookupCatalogElement,
});

describe("CombinationStationRulesEngine", () => {
    it("exposes a rule for every declared mode", () => {
        for (const rule of COMBINATION_MODE_RULES) {
            expect(combinationStationRulesEngine.getRule(rule.key)).toBe(rule);
            expect(combinationStationRulesEngine.getRuleByElement(rule.triggerElement)).toBe(rule);
        }
    });

    it("returns no rule for non-mode keys", () => {
        expect(combinationStationRulesEngine.getRule("idle")).toBeUndefined();
    });

    describe("slot layout", () => {
        it("marks Mix as a three-slot mode and others as two-slot", () => {
            expect(combinationStationRulesEngine.usesThirdSlot("mix")).toBe(true);
            expect(combinationStationRulesEngine.getEquationSlotCount("mix")).toBe(3);
            expect(combinationStationRulesEngine.usesThirdSlot("incubate")).toBe(false);
            expect(combinationStationRulesEngine.getEquationSlotCount("incubate")).toBe(2);
        });

        it("defaults unknown keys to a two-slot layout", () => {
            expect(combinationStationRulesEngine.getEquationSlotCount("idle")).toBe(2);
            expect(combinationStationRulesEngine.getInputSlotIndices("idle")).toEqual([0, 1]);
        });

        it("reads input slots from the rule", () => {
            expect(combinationStationRulesEngine.getInputSlotIndices("mix")).toEqual([1, 2]);
            expect(combinationStationRulesEngine.getInputSlotIndices("incubate")).toEqual([0, 1]);
        });
    });

    describe("areInputSlotsFilled", () => {
        it("checks slots 1 and 2 for Mix", () => {
            expect(combinationStationRulesEngine.areInputSlotsFilled("mix", [-101, 5, 6])).toBe(true);
            expect(combinationStationRulesEngine.areInputSlotsFilled("mix", [-101, 5, null])).toBe(false);
            // Slot 0 being empty does not matter for Mix.
            expect(combinationStationRulesEngine.areInputSlotsFilled("mix", [null, 5, 6])).toBe(true);
        });

        it("checks slots 0 and 1 for two-slot modes", () => {
            expect(combinationStationRulesEngine.areInputSlotsFilled("incubate", [4, 5])).toBe(true);
            expect(combinationStationRulesEngine.areInputSlotsFilled("incubate", [4, null])).toBe(false);
        });
    });

    describe("output kind", () => {
        it("identifies deferred and dual-output modes", () => {
            expect(combinationStationRulesEngine.isDeferred("incubate")).toBe(true);
            expect(combinationStationRulesEngine.isDeferred("refine")).toBe(true);
            expect(combinationStationRulesEngine.isDeferred("mix")).toBe(false);
            expect(combinationStationRulesEngine.isDualOutput("divide")).toBe(true);
            expect(combinationStationRulesEngine.isDualOutput("duplicate")).toBe(true);
            expect(combinationStationRulesEngine.isDualOutput("incubate")).toBe(false);
        });
    });

    describe("applyDeferred", () => {
        it("incubate scales effect amounts and flags the element", () => {
            const result = combinationStationRulesEngine.applyDeferred("incubate", makeItem(), 2);
            expect(result?.enhancements?.incubated).toBe(true);
            // amount 6 × (2 × 1.75) = 21
            expect(result?.effects?.[0]?.amount).toBe(21);
        });

        it("refine scales damage and flags the element", () => {
            const result = combinationStationRulesEngine.applyDeferred("refine", makeItem({ damage: 10 }), 3);
            expect(result?.enhancements?.refined).toBe(true);
            // 10 × (3 × 2) = 60
            expect(result?.damage).toBe(60);
        });

        it("returns null for non-deferred modes", () => {
            expect(combinationStationRulesEngine.applyDeferred("mix", makeItem(), 1)).toBeNull();
        });
    });

    describe("buildPreview", () => {
        const sentinel = makeItem({ id: -101, letter: "fire" });

        it("incubate produces a deferred placeholder consuming only the input", () => {
            const input = makeItem({ id: 7 });
            const preview = combinationStationRulesEngine.buildPreview("incubate", makeContext([sentinel, input]));
            expect(preview).not.toBeNull();
            expect(preview?.isDeferred).toBe(true);
            expect(preview?.letter).toBe("?");
            expect(preview?.damage).toBe(0);
            expect(preview?.consumedIds).toEqual([7]);
        });

        it("divide splits power and effects into two outputs", () => {
            const input = makeItem({
                id: 9,
                damage: 11,
                energy: 5,
                effects: [
                    { kind: "flame", target: "enemy", amount: 6, growth: "+" },
                    { kind: "gust", target: "self", amount: 3, growth: "+" },
                    { kind: "root", target: "self", amount: 2, growth: "+" },
                ],
            });
            const preview = combinationStationRulesEngine.buildPreview("divide", makeContext([sentinel, input]));
            expect(preview?.damage).toBe(6); // ceil(11 / 2)
            expect(preview?.energy).toBe(3); // ceil(5 / 2)
            expect(preview?.effects).toHaveLength(2); // ceil(3 / 2)
            expect(preview?.enhancements?.divided).toBe(true);
            expect(preview?.secondOutput?.damage).toBe(6);
            expect(preview?.secondOutput?.energy).toBe(2); // floor(5 / 2)
            expect(preview?.secondOutput?.effects).toHaveLength(1);
            expect(preview?.consumedIds).toEqual([9]);
        });

        it("duplicate copies the input and spawns a fresh catalog element", () => {
            const input = makeItem({ id: 12, letter: "Ember" });
            const catalog: RewardElement = {
                letter: "Ember",
                damage: 99,
                energy: 1,
                rank: 2,
                level: 1,
                description: "fresh",
                category: "element",
                effects: [],
            };
            const preview = combinationStationRulesEngine.buildPreview(
                "duplicate",
                makeContext([sentinel, input], (letter) => (letter === "Ember" ? catalog : undefined)),
            );
            // Primary is an exact copy of the input.
            expect(preview?.damage).toBe(input.damage);
            // Second output comes from the catalog.
            expect(preview?.secondOutput?.damage).toBe(99);
            // Sentinel in slot 0 is not consumed.
            expect(preview?.consumedIds).toEqual([12]);
        });

        it("mix merges effects of the two inputs without brittle augmentation", () => {
            const primary = makeItem({ id: 20, letter: "Water", effects: [{ kind: "drizzle", target: "self", amount: 1, growth: "+" }] });
            const secondary = makeItem({ id: 21, letter: "Steam", effects: [{ kind: "flame", target: "enemy", amount: 2, growth: "+" }] });
            const preview = combinationStationRulesEngine.buildPreview("mix", makeContext([sentinel, primary, secondary]));
            expect(preview?.letter).toBe("Water");
            expect(preview?.effects).toHaveLength(2);
            expect(preview?.enhancements?.mixed).toBe(true);
            expect(preview?.consumedIds).toEqual([20, 21]);
        });

        it("returns null when a required input is missing", () => {
            expect(combinationStationRulesEngine.buildPreview("incubate", makeContext([sentinel, undefined]))).toBeNull();
            expect(combinationStationRulesEngine.buildPreview("idle", makeContext([]))).toBeNull();
        });
    });

    describe("labels", () => {
        it("provides action and active labels per mode", () => {
            expect(combinationStationRulesEngine.getActionLabel("mix")).toBe("Mix");
            expect(combinationStationRulesEngine.getActiveLabel("mix")).toBe("Mixing");
            expect(combinationStationRulesEngine.getActiveLabel("incubate")).toBe("Incubating");
            expect(combinationStationRulesEngine.getActiveLabel("idle")).toBeNull();
        });
    });

    it("can be constructed from a custom rule set (extension pattern)", () => {
        const engine = new CombinationStationRulesEngine([]);
        expect(engine.getRule("mix")).toBeUndefined();
        expect(engine.getEquationSlotCount("mix")).toBe(2);
    });
});
