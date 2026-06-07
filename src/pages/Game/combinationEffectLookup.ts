import type { SpellEffectConfig } from "../../combat/spellEffects";

export type EffectWorkbookRow = {
    [key: string]: unknown;
    Effect?: string;
    Amount?: string | number;
    Duration?: string | number;
    Target?: string;
};

export type EffectWorkbookValues = {
    amount: string | number;
    duration: string | number;
    target: string;
};

type CombinationPreviewBase = {
    damage: number;
    energy?: number;
    effects?: SpellEffectConfig[];
};

export type CombinationPreviewResolution = {
    damage: number;
    energy?: number;
    effects?: SpellEffectConfig[];
    isDamageEnhanced?: boolean;
    baseDamageBeforeEnhance?: number;
};

const CREATION_EFFECT_KINDS = new Set(["powerful", "energetic", "efficient"]);

const asPercentMultiplier = (amount?: number): number => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    return normalizedAmount > 1
        ? 1 + normalizedAmount / 100
        : 1 + normalizedAmount;
};

const isCreationEffect = (effect: SpellEffectConfig): boolean => CREATION_EFFECT_KINDS.has(effect.kind);

const scaleEffectValue = (value: number | undefined, multiplier: number): number | undefined => {
    if (value === undefined) {
        return undefined;
    }

    return Math.max(1, Math.round(value * multiplier));
};

const applyEfficientToEffects = (effects: SpellEffectConfig[], multiplier: number): SpellEffectConfig[] =>
    effects.map((effect) => ({
        ...effect,
        amount: effect.amount === undefined ? undefined : Math.round(effect.amount * multiplier),
        hits: scaleEffectValue(effect.hits, multiplier),
        duration: scaleEffectValue(effect.duration, multiplier),
    }));

export const normalizeEffectLookupKey = (value?: string): string =>
    value
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        ?? "";

export const buildEffectValuesByKey = (rows: EffectWorkbookRow[]): Map<string, EffectWorkbookValues> => {
    const effectValuesByKey = new Map<string, EffectWorkbookValues>();

    rows.forEach((row) => {
        const effectName = String(row.Effect ?? "").trim();
        if (effectName.length === 0) {
            return;
        }

        const effectKey = normalizeEffectLookupKey(effectName);
        if (effectKey.length === 0) {
            return;
        }

        effectValuesByKey.set(effectKey, {
            amount: row.Amount ?? "",
            duration: row.Duration ?? "",
            target: String(row.Target ?? "").trim(),
        });
    });

    return effectValuesByKey;
};

export const buildMappedEffectRow = (
    effectName: string,
    effectValuesByKey: Map<string, EffectWorkbookValues>,
): Record<string, unknown> => {
    const effectValues = effectValuesByKey.get(normalizeEffectLookupKey(effectName));

    const mappedEffectRow: Record<string, unknown> = {
        "Effect 1 Kind": effectName,
        "Effect 1 Amount": effectValues?.amount ?? "",
        "Effect 1 Duration": effectValues?.duration ?? "",
        "Effect 1 Target": effectValues?.target ?? "",
    };

    if (normalizeEffectLookupKey(effectName) === "multihit" && effectValues?.amount !== undefined) {
        mappedEffectRow["Effect 1 Hits"] = effectValues.amount;
    }

    return mappedEffectRow;
};

export const resolveCombinationPreviewFromEffects = (
    base: CombinationPreviewBase,
    creationTriggerEffects: SpellEffectConfig[],
): CombinationPreviewResolution => {
    const creationEffects = creationTriggerEffects.filter(isCreationEffect);
    if (creationEffects.length === 0) {
        return {
            damage: base.damage,
            energy: base.energy,
            effects: base.effects,
        };
    }

    let resolvedDamage = base.damage;
    let resolvedEnergy = base.energy;
    let resolvedEffects = [...(base.effects ?? [])];
    let isDamageEnhanced = false;
    const baseDamageBeforeEnhance = base.damage;

    creationEffects.forEach((effect) => {
        const amount = Math.max(0, effect.amount ?? 0);

        if (effect.kind === "powerful") {
            const multiplier = asPercentMultiplier(amount);
            const nextDamage = Math.max(0, Math.round(resolvedDamage * multiplier));
            if (nextDamage !== resolvedDamage) {
                isDamageEnhanced = true;
                resolvedDamage = nextDamage;
            }
            return;
        }

        if (effect.kind === "energetic") {
            const reduction = Math.floor(amount);
            resolvedEnergy = Math.max(0, (resolvedEnergy ?? 0) - reduction);
            return;
        }

        if (effect.kind === "efficient") {
            const multiplier = asPercentMultiplier(amount);
            resolvedEffects = applyEfficientToEffects(resolvedEffects, multiplier);
        }
    });

    return {
        damage: resolvedDamage,
        energy: resolvedEnergy,
        effects: resolvedEffects,
        isDamageEnhanced: isDamageEnhanced || undefined,
        baseDamageBeforeEnhance: isDamageEnhanced ? baseDamageBeforeEnhance : undefined,
    };
};