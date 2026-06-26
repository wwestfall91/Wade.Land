import type { SpellEffectConfig } from "../../combat/spellEffects";
import type { ElementEnhancements } from "../../context/PlayerContext";

export type Position = {
    x: number;
    y: number;
};

export type DraggableItem = {
    id: number;
    letter: string;
    damage: number;
    energy?: number;
    enhancements?: ElementEnhancements;
    rank: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
    initialPosition: Position;
};

/** A second element spawned alongside the primary output (Divide / Duplicate). */
export type PreviewSecondOutput = {
    letter: string;
    damage: number;
    energy?: number;
    rank?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
};

export type PreviewCombination = {
    consumedIds: number[];
    letter: string;
    damage: number;
    isDamageEnhanced?: boolean;
    baseDamageBeforeEnhance?: number;
    isCombusted?: boolean;
    baseDamageBeforeCombust?: number;
    isSoulChoiceOutput?: boolean;
    energy?: number;
    baseEnergyBeforeCreation?: number;
    enhancements?: ElementEnhancements;
    rank?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
    /** Set for Incubate/Refine: element consumed now, output delivered after battles. */
    isDeferred?: boolean;
    /** Set for Divide/Duplicate: a second element spawns alongside the primary output. */
    secondOutput?: PreviewSecondOutput;
};
