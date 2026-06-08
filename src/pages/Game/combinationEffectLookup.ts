import type { SpellEffectConfig } from "../../combat/spellEffects";
import type { SpellEffectGrowth } from "../../combat/spellEffects";
import { effectTypeFactory } from "../../combat/effectTypeFactory";

export type EffectWorkbookRow = {
    [key: string]: unknown;
    Effect?: string;
    "Short Description"?: string;
    Amount?: string | number;
    Duration?: string | number;
    Target?: string;
    Growth?: string;
};

export type EffectWorkbookValues = {
    shortDescription: string;
    amount: string | number;
    duration: string | number;
    target: string;
    growth: string;
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
    baseEnergyBeforeCreation?: number;
};

const asPercentMultiplier = (amount?: number): number => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    return normalizedAmount > 1
        ? 1 + normalizedAmount / 100
        : 1 + normalizedAmount;
};

const isCreationEffect = (effect: SpellEffectConfig): boolean =>
    effectTypeFactory.getEffectType(effect.kind) === "create";

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
            shortDescription: String(row["Short Description"] ?? "").trim(),
            amount: row.Amount ?? "",
            duration: row.Duration ?? "",
            target: String(row.Target ?? "").trim(),
            growth: String(row.Growth ?? "").trim(),
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
        "Effect 1 Short Description": effectValues?.shortDescription ?? "",
        "Effect 1 Amount": effectValues?.amount ?? "",
        "Effect 1 Duration": effectValues?.duration ?? "",
        "Effect 1 Target": effectValues?.target ?? "",
        "Effect 1 Growth": effectValues?.growth ?? "",
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
    const creationEffects = effectTypeFactory
        .getCreationTriggerEffects(creationTriggerEffects)
        .filter(isCreationEffect);
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
    const baseEnergyBeforeCreation = base.energy;
    let isEnergyChanged = false;

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
            const prevEnergy = resolvedEnergy ?? 0;
            resolvedEnergy = Math.max(0, prevEnergy - reduction);
            if (resolvedEnergy !== prevEnergy) {
                isEnergyChanged = true;
            }
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
        baseEnergyBeforeCreation: isEnergyChanged && typeof baseEnergyBeforeCreation === "number" ? baseEnergyBeforeCreation : undefined,
    };
};

/**
 * Applies one upgrade step to a single effect's `amount`.
 *
 * Growth rules (from effects.xlsx):
 *   `+`  — incrementing the amount benefits the player → amount increases by `step`
 *   `-`  — decrementing the amount benefits the player → amount decreases by `step`
 *   `=`  — the amount must remain static → no change
 *   (absent) — treated as static; no change applied
 *
 * The returned object is a new `SpellEffectConfig` with the updated amount.
 * All other fields are preserved unchanged.
 *
 * @param effect  The effect to upgrade.
 * @param step    The magnitude of change per upgrade level (must be > 0, default 1).
 */
export const upgradeElementEffect = (
    effect: SpellEffectConfig,
    step = 1,
): SpellEffectConfig => {
    const growth: SpellEffectGrowth | undefined = effect.growth;

    if (growth === "=" || growth === undefined) {
        return effect;
    }

    const currentAmount = effect.amount ?? 0;
    const delta = Math.max(0, step);
    const nextAmount = growth === "+" ? currentAmount + delta : currentAmount - delta;

    return { ...effect, amount: nextAmount };
};

/**
 * Applies one upgrade step to every upgradeable effect on a spell's effect list.
 * Effects with growth `=` or no growth value are returned unchanged.
 *
 * @param effects  The full effects array from a `PlayerElement`.
 * @param step     The magnitude of change per upgrade level (default 1).
 */
export const upgradeElementEffects = (
    effects: SpellEffectConfig[],
    step = 1,
): SpellEffectConfig[] => effects.map((effect) => upgradeElementEffect(effect, step));