import type { SpellEffectConfig } from "./spellEffects";

export type MergeLevelUpEffectResult = {
    effects: SpellEffectConfig[];
    mergedIndex: number;
};

const normalizeNullable = (value: string | undefined): string | null => value ?? null;

const isMatchingLevelUpEffect = (a: SpellEffectConfig, b: SpellEffectConfig): boolean =>
    a.kind === b.kind
    && normalizeNullable(a.target) === normalizeNullable(b.target)
    && normalizeNullable(a.targetType) === normalizeNullable(b.targetType);

/**
 * Merges a newly chosen level-up effect into an element's effects.
 *
 * If the element already has an effect with the same kind/target/targetType,
 * we keep one entry and increase its amount by the chosen effect's amount.
 */
export const mergeLevelUpEffect = (
    existingEffects: SpellEffectConfig[] | undefined,
    selectedEffect: SpellEffectConfig,
): MergeLevelUpEffectResult => {
    const nextEffects = [...(existingEffects ?? [])].map((effect) => ({ ...effect }));
    const matchingIndex = nextEffects.findIndex((effect) => isMatchingLevelUpEffect(effect, selectedEffect));

    if (matchingIndex < 0) {
        nextEffects.push({ ...selectedEffect });
        return {
            effects: nextEffects,
            mergedIndex: nextEffects.length - 1,
        };
    }

    const existing = nextEffects[matchingIndex];
    const hasExistingAmount = typeof existing.amount === "number";
    const hasSelectedAmount = typeof selectedEffect.amount === "number";

    if (hasExistingAmount || hasSelectedAmount) {
        nextEffects[matchingIndex] = {
            ...existing,
            amount: (existing.amount ?? 0) + (selectedEffect.amount ?? 0),
        };
    }

    return {
        effects: nextEffects,
        mergedIndex: matchingIndex,
    };
};
