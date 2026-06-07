import { describe, expect, it } from "vitest";
import { effectTypeFactory } from "./effectTypeFactory";
import type { SpellEffectConfig } from "./spellEffects";

describe("effect type factory", () => {
    it("routes active and stack effects to battle trigger", () => {
        const effects: SpellEffectConfig[] = [
            { kind: "heal", amount: 5, target: "self" },
            { kind: "burn", amount: 2, duration: 3, target: "enemy" },
            { kind: "powerful", amount: 150, target: "self" },
            { kind: "float", amount: 1, target: "enemy" },
        ];

        const battle = effectTypeFactory.getBattleTriggerEffects(effects);
        expect(battle).toEqual([
            { kind: "heal", amount: 5, target: "self" },
            { kind: "burn", amount: 2, duration: 3, target: "enemy" },
        ]);
    });

    it("routes create and passive effects to creation trigger", () => {
        const effects: SpellEffectConfig[] = [
            { kind: "powerful", amount: 150, target: "self" },
            { kind: "energetic", amount: 1, target: "self" },
            { kind: "float", amount: 1, target: "enemy" },
            { kind: "burn", amount: 1, duration: 3, target: "enemy" },
        ];

        const creation = effectTypeFactory.getCreationTriggerEffects(effects);
        expect(creation).toEqual([
            { kind: "powerful", amount: 150, target: "self" },
            { kind: "energetic", amount: 1, target: "self" },
            { kind: "float", amount: 1, target: "enemy" },
        ]);
    });

    it("keeps passive effects in persistent bucket", () => {
        const effects: SpellEffectConfig[] = [
            { kind: "float", amount: 1, target: "enemy" },
            { kind: "burn", amount: 1, duration: 3, target: "enemy" },
        ];

        const buckets = effectTypeFactory.bucketByLifecycle(effects);
        expect(buckets.persistent).toEqual([{ kind: "float", amount: 1, target: "enemy" }]);
        expect(buckets.battle).toEqual([{ kind: "burn", amount: 1, duration: 3, target: "enemy" }]);
    });
});
