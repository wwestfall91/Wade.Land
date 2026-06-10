import type { SpellEffectConfig, SpellEffectKind } from "./spellEffects";
import { EFFECTS } from "./spellEffects";

export type RuntimeEffectType = "active" | "passive" | "stack" | "create" | "element";

export type EffectTriggerLifecycle = "creation" | "battle" | "persistent";

export type EffectLifecycleBuckets = {
    creation: SpellEffectConfig[];
    battle: SpellEffectConfig[];
    persistent: SpellEffectConfig[];
};

const EFFECT_TYPE_BY_KIND: Record<SpellEffectKind, RuntimeEffectType> = {
    [EFFECTS.HEAL]:         "active",
    [EFFECTS.MULTI_HIT]:    "active",
    [EFFECTS.BURN]:         "stack",
    [EFFECTS.SHIELD]:       "active",
    [EFFECTS.LIFESTEAL]:    "active",
    [EFFECTS.SOAK]:         "stack",
    [EFFECTS.ENERGIZE]:     "stack",
    [EFFECTS.FREEZE]:       "stack",
    [EFFECTS.THORNS]:       "stack",
    [EFFECTS.FLOAT]:        "passive",
    [EFFECTS.COMBO]:        "active",
    [EFFECTS.EXPLODE]:      "active",
    [EFFECTS.POISON]:       "stack",
    [EFFECTS.ENERGY_COMBO]: "active",
    [EFFECTS.POWER_COMBO]:  "active",
    [EFFECTS.FOLLOW_UP]:    "active",
    [EFFECTS.CHARGE]:       "active",
    [EFFECTS.EXHAUST]:      "active",
    [EFFECTS.CONSUME]:      "active",
    [EFFECTS.HARDENED]:     "active",
    [EFFECTS.RAGE]:         "active",
    [EFFECTS.SQUISHY]:      "active",
    [EFFECTS.EXPONENTIAL]:  "active",
    [EFFECTS.POWERFUL]:     "create",
    [EFFECTS.ENERGETIC]:    "create",
    [EFFECTS.EFFICIENT]:    "create",
    [EFFECTS.BRITTLE]:      "element",
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
            return effectType === "passive" || effectType === "create" || effectType === "element";
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