import { describe, expect, it } from "vitest";
import { mergeLevelUpEffect } from "./effectMerging";

describe("mergeLevelUpEffect", () => {
    it("appends the effect when no matching effect exists", () => {
        const result = mergeLevelUpEffect(
            [{ kind: "burn", amount: 2, target: "enemy" }],
            { kind: "poison", amount: 3, target: "enemy" },
        );

        expect(result.effects).toEqual([
            { kind: "burn", amount: 2, target: "enemy" },
            { kind: "poison", amount: 3, target: "enemy" },
        ]);
        expect(result.mergedIndex).toBe(1);
    });

    it("merges with an existing matching effect and increases amount", () => {
        const result = mergeLevelUpEffect(
            [{ kind: "burn", amount: 2, target: "enemy" }],
            { kind: "burn", amount: 3, target: "enemy" },
        );

        expect(result.effects).toEqual([{ kind: "burn", amount: 5, target: "enemy" }]);
        expect(result.mergedIndex).toBe(0);
    });

    it("does not merge effects with same kind but different target", () => {
        const result = mergeLevelUpEffect(
            [{ kind: "shield", amount: 2, target: "self" }],
            { kind: "shield", amount: 3, target: "enemy" },
        );

        expect(result.effects).toEqual([
            { kind: "shield", amount: 2, target: "self" },
            { kind: "shield", amount: 3, target: "enemy" },
        ]);
        expect(result.mergedIndex).toBe(1);
    });
});
