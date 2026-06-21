/**
 * Pure calculation functions for combination modes.
 * Extracted from Game.tsx so they can be unit-tested independently of React.
 */
import type { CombinationStationActionStateKey } from "./CombinationStation";
import type { ElementEnhancements, PlayerElement } from "../../context/PlayerContext";

/** Element stat fields shared by inputs and outputs (excludes id and initialPosition). */
export type ElementStats = Omit<PlayerElement, "id" | "initialPosition">;

/**
 * Merge inherited enhancement flags with a new flag from the given combination state.
 * Returns undefined when no flags are set (element has no enhancements).
 */
export const mergeEnhancements = (
    inherited?: ElementEnhancements,
    stateKey?: CombinationStationActionStateKey,
): ElementEnhancements | undefined => {
    const merged: ElementEnhancements = {
        incubated: inherited?.incubated ?? false,
        divided: inherited?.divided ?? false,
        mixed: inherited?.mixed ?? false,
        refined: inherited?.refined ?? false,
    };

    if (stateKey === "incubate") merged.incubated = true;
    if (stateKey === "divide") merged.divided = true;
    if (stateKey === "mix") merged.mixed = true;
    if (stateKey === "refine") merged.refined = true;

    if (!merged.incubated && !merged.divided && !merged.mixed && !merged.refined) {
        return undefined;
    }

    return merged;
};

/**
 * Incubate: damage and energy are unchanged.
 * Effect amounts are scaled by battles × 1.75 (rounded).
 * Sets the `incubated` enhancement flag.
 */
export const applyIncubate = (input: ElementStats, battles: number): ElementStats => {
    const multiplier = battles * 1.75;
    return {
        ...input,
        enhancements: mergeEnhancements(input.enhancements, "incubate"),
        effects: (input.effects ?? []).map((effect) => ({
            ...effect,
            amount: effect.amount !== undefined ? Math.round(effect.amount * multiplier) : undefined,
        })),
    };
};

/**
 * Refine: damage scaled by battles × 2 (rounded).
 * Effects pass through unchanged.
 * Sets the `refined` enhancement flag.
 */
export const applyRefine = (input: ElementStats, battles: number): ElementStats => {
    const multiplier = battles * 2;
    return {
        ...input,
        damage: Math.round(input.damage * multiplier),
        enhancements: mergeEnhancements(input.enhancements, "refine"),
    };
};

export type DivideOutput = {
    /** First (top) output — carries the divided enhancement flag. */
    top: ElementStats;
    /** Second (bottom) output — no enhancement flag on this half. */
    bottom: Omit<ElementStats, "enhancements">;
};

/**
 * Divide: damage and energy are split (top gets ceil, bottom gets floor).
 * Effects are split evenly with a ceil-bias toward the top output.
 * Only the top output carries the `divided` enhancement flag.
 */
export const applyDivide = (input: ElementStats): DivideOutput => {
    const halfPower = Math.ceil(input.damage / 2);
    const effects = input.effects ?? [];
    const topCount = Math.ceil(effects.length / 2);

    const base = {
        letter: input.letter,
        damage: halfPower,
        rank: input.rank,
        level: input.level,
        description: input.description,
        type1: input.type1,
        type2: input.type2,
        category: input.category,
    };

    return {
        top: {
            ...base,
            energy: input.energy !== undefined ? Math.ceil(input.energy / 2) : undefined,
            enhancements: mergeEnhancements(input.enhancements, "divide"),
            effects: effects.slice(0, topCount),
        },
        bottom: {
            ...base,
            energy: input.energy !== undefined ? Math.floor(input.energy / 2) : undefined,
            effects: effects.slice(topCount),
        },
    };
};

/**
 * Mix: letter, damage, energy, level, types, and category come from primary.
 * Effects are the union of primary + secondary effects.
 * Sets the `mixed` enhancement flag on primary's existing enhancements.
 */
export const applyMix = (primary: ElementStats, secondary: ElementStats): ElementStats => {
    return {
        ...primary,
        enhancements: mergeEnhancements(primary.enhancements, "mix"),
        effects: [...(primary.effects ?? []), ...(secondary.effects ?? [])],
    };
};
