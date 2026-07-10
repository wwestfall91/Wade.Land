import { describe, expect, it } from "vitest";
import type { RewardElement } from "../../context/PlayerContext";
import { buildCombinedTripleFragmentElement } from "./consumeRewards";

const makeFragment = (type: string, damage: number, shield: number, energy: number): RewardElement => ({
    letter: `${type} fragment`,
    damage,
    shield,
    energy,
    rank: 1,
    level: 1,
    description: `${type} fragment`,
    type1: type,
    category: "fragment",
});

describe("buildCombinedTripleFragmentElement", () => {
    it("returns null when there are fewer than three matching fragments", () => {
        const result = buildCombinedTripleFragmentElement(
            "fire",
            [
                makeFragment("fire", 3, 1, 2),
                makeFragment("fire", 4, 2, 3),
            ],
            [],
        );

        expect(result).toBeNull();
    });

    it("combines damage and shield, and averages energy across three matching fragments", () => {
        const catalog: RewardElement[] = [
            {
                letter: "Fire",
                damage: 6,
                shield: 1,
                energy: 2,
                rank: 1,
                level: 1,
                description: "Base fire element",
                type1: "fire",
                category: "element",
            },
        ];

        const result = buildCombinedTripleFragmentElement(
            "fire",
            [
                makeFragment("fire", 3, 1, 3),
                makeFragment("fire", 4, 2, 4),
                makeFragment("fire", 5, 3, 5),
                makeFragment("water", 99, 99, 99),
            ],
            catalog,
        );

        expect(result).toEqual({
            letter: "Fire",
            damage: 12,
            shield: 6,
            energy: 4,
            rank: 1,
            level: 1,
            description: "Base fire element",
            type1: "fire",
            category: "element",
        });
    });
});
