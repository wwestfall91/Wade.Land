import type { RewardElement } from "../../context/PlayerContext";

const normalizeType = (value?: string): string => value?.trim().toLowerCase() ?? "";

const toTitleCase = (value: string): string =>
    value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

/**
 * Builds the special consume reward when a homunculus was created with exactly
 * three fragments of the drained stat's element type.
 */
export const buildCombinedTripleFragmentElement = (
    elementType: string,
    fragments: RewardElement[],
    catalog: RewardElement[],
): RewardElement | null => {
    const normalizedType = normalizeType(elementType);
    if (!normalizedType) {
        return null;
    }

    const matchingFragments = fragments.filter((fragment) => {
        if (normalizeType(fragment.category) !== "fragment") {
            return false;
        }

        return normalizeType(fragment.type1 || fragment.letter) === normalizedType;
    });

    if (matchingFragments.length !== 3) {
        return null;
    }

    const totalDamage = matchingFragments.reduce((sum, fragment) => sum + (fragment.damage ?? 0), 0);
    const totalShield = matchingFragments.reduce((sum, fragment) => sum + (fragment.shield ?? 0), 0);
    const totalEnergy = matchingFragments.reduce((sum, fragment) => sum + (fragment.energy ?? 0), 0);

    const catalogBase = catalog.find((entry) => {
        if (normalizeType(entry.category) === "fragment") {
            return false;
        }

        return normalizeType(entry.type1 || entry.letter) === normalizedType;
    });

    const titledType = toTitleCase(normalizedType);

    return {
        ...catalogBase,
        letter: catalogBase?.letter ?? `${titledType} Core`,
        damage: totalDamage,
        shield: totalShield,
        energy: Math.round(totalEnergy / 3),
        rank: catalogBase?.rank ?? 1,
        level: catalogBase?.level ?? 1,
        description: catalogBase?.description ?? `Fused from three ${titledType} Fragments.`,
        type1: catalogBase?.type1 ?? normalizedType,
        category: "element",
    };
};
