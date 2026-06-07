import type { SpellEffectConfig, SpellEffectKind } from "./spellEffects";

export type RuntimeEffectType = "active" | "passive" | "stack" | "create";

export type EffectTriggerLifecycle = "creation" | "battle" | "persistent";

export type EffectLifecycleBuckets = {
    creation: SpellEffectConfig[];
    battle: SpellEffectConfig[];
    persistent: SpellEffectConfig[];
};

const EFFECT_TYPE_BY_KIND: Record<SpellEffectKind, RuntimeEffectType> = {
    heal: "active",
    multi_hit: "active",
    burn: "stack",
    shield: "active",
    lifesteal: "active",
    soak: "stack",
    energize: "stack",
    freeze: "stack",
    thorns: "stack",
    float: "passive",
    combo: "active",
    explode: "active",
    poison: "stack",
    energy_combo: "active",
    power_combo: "active",
    follow_up: "active",
    charge: "active",
    exhaust: "active",
    consume: "active",
    hardened: "active",
    rage: "active",
    squishy: "active",
    exponential: "active",
    powerful: "create",
    energetic: "create",
    efficient: "create",
};

export class EffectTypeFactory {
    private readonly typeByKind: Record<SpellEffectKind, RuntimeEffectType>;

    constructor(typeByKind: Record<SpellEffectKind, RuntimeEffectType>) {
        this.typeByKind = typeByKind;
    }

    getEffectType(kind: SpellEffectKind): RuntimeEffectType {
        return this.typeByKind[kind] ?? "active";
    }

    shouldTriggerForLifecycle(effect: SpellEffectConfig, lifecycle: EffectTriggerLifecycle): boolean {
        const effectType = this.getEffectType(effect.kind);

        if (lifecycle === "battle") {
            return effectType === "active" || effectType === "stack";
        }

        if (lifecycle === "creation") {
            return effectType === "passive" || effectType === "create";
        }

        return effectType === "passive";
    }

    getBattleTriggerEffects(effects?: SpellEffectConfig[] | null): SpellEffectConfig[] {
        return (effects ?? []).filter((effect) => this.shouldTriggerForLifecycle(effect, "battle"));
    }

    getCreationTriggerEffects(effects?: SpellEffectConfig[] | null): SpellEffectConfig[] {
        return (effects ?? []).filter((effect) => this.shouldTriggerForLifecycle(effect, "creation"));
    }

    getPersistentEffects(effects?: SpellEffectConfig[] | null): SpellEffectConfig[] {
        return (effects ?? []).filter((effect) => this.shouldTriggerForLifecycle(effect, "persistent"));
    }

    bucketByLifecycle(effects?: SpellEffectConfig[] | null): EffectLifecycleBuckets {
        const normalized = effects ?? [];
        return {
            creation: this.getCreationTriggerEffects(normalized),
            battle: this.getBattleTriggerEffects(normalized),
            persistent: this.getPersistentEffects(normalized),
        };
    }
}

export const effectTypeFactory = new EffectTypeFactory(EFFECT_TYPE_BY_KIND);