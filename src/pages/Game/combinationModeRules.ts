import type { RewardElement } from "../../context/PlayerContext";
import type { CombinationStationActionStateKey } from "./CombinationStation";
import type { ModeTabElementKey } from "./CombinationModePanel";
import type { DraggableItem, PreviewCombination } from "./combinationTypes";
import {
    applyIncubate,
    applyRefine,
    mergeEnhancements,
    type ElementStats,
} from "./combinationCalculations";

/**
 * Action keys for every combination mode the station can run.
 *
 * To add a new mode you only need to:
 *   1. Add its key here.
 *   2. Add a single {@link CombinationModeRule} object to {@link COMBINATION_MODE_RULES}.
 * The engine ({@link ./CombinationStationRulesEngine}) and the UI consume the rule
 * automatically — no scattered `if (key === "...")` branches required.
 */
export type CombinationModeActionKey = "mix" | "incubate" | "divide" | "refine" | "duplicate";

/** Read-only snapshot of the station the moment a preview is requested. */
export type ModePreviewContext = {
    /** Items occupying each equation slot (sentinels resolve to synthetic items). */
    occupantItems: ReadonlyArray<DraggableItem | undefined>;
    /** Non-sentinel occupant ids (the elements that would actually be consumed). */
    consumedIds: number[];
    /** True when the id belongs to a sealed-mode sentinel rather than a real element. */
    isModeSentinelId: (id: number) => boolean;
    /** Looks up a catalog element by (case-insensitive) name. */
    lookupCatalogElement: (letter: string) => RewardElement | undefined;
};

/**
 * What a rule returns from {@link CombinationModeRule.buildPreview}. The engine
 * augments {@link baseConsumedIds} with brittle participants and stamps the final
 * `consumedIds` onto the preview, so rules never deal with brittle bookkeeping.
 */
export type ModePreviewBuild = {
    preview: Omit<PreviewCombination, "consumedIds">;
    baseConsumedIds: number[];
    /** Items whose brittle effect may force them to be consumed by using the formula. */
    brittleParticipants: Array<DraggableItem | undefined>;
};

/** Declarative definition of a single combination mode. */
export type CombinationModeRule = {
    /** Action identifier (matches CombinationStationState.key for this mode). */
    key: CombinationModeActionKey;
    /** Element tab that activates this mode. */
    triggerElement: ModeTabElementKey;
    /** Button label shown for the combine action (e.g. "Mix"). */
    actionLabel: string;
    /** Label describing the mode while active (e.g. "Mixing"). */
    activeLabel: string;
    /** Effects workbook backing this mode, if any. */
    workbookPath?: string;
    /** Enhancement flag stamped onto produced elements, if any. */
    enhancementFlag?: CombinationStationActionStateKey;
    /** Number of equation slots this mode renders (2 or 3). */
    equationSlotCount: 2 | 3;
    /** Indices of the equation slots that hold the consumable inputs. */
    inputSlotIndices: readonly number[];
    /** Shape of what the mode produces. */
    outputKind: "single" | "dual" | "deferred";
    /** For deferred modes: transforms the stored input into its delivered output. */
    applyDeferred?: (input: ElementStats, counter: number) => ElementStats;
    /** Builds the live preview for this mode, or null when it cannot run. */
    buildPreview: (context: ModePreviewContext) => ModePreviewBuild | null;
};

// ── Mix (water): primary + secondary → output of primary type + combined effects ──
const mixRule: CombinationModeRule = {
    key: "mix",
    triggerElement: "water",
    actionLabel: "Mix",
    activeLabel: "Mixing",
    workbookPath: "/mix.xlsx",
    enhancementFlag: "mix",
    equationSlotCount: 3,
    inputSlotIndices: [1, 2],
    outputKind: "single",
    buildPreview: ({ occupantItems, consumedIds }) => {
        const primaryItem = occupantItems[1];
        const secondaryItem = occupantItems[2];
        if (!primaryItem || !secondaryItem) {
            return null;
        }

        return {
            // Mix preserves the original behaviour of consuming exactly the two
            // inputs with no brittle augmentation.
            baseConsumedIds: consumedIds,
            brittleParticipants: [],
            preview: {
                letter: primaryItem.letter,
                damage: primaryItem.damage,
                shield: primaryItem.shield,
                energy: primaryItem.energy,
                enhancements: mergeEnhancements(primaryItem.enhancements, "mix"),
                level: primaryItem.level,
                description: primaryItem.description,
                type1: primaryItem.type1,
                type2: primaryItem.type2,
                effects: [...(primaryItem.effects ?? []), ...(secondaryItem.effects ?? [])],
                category: primaryItem.category,
            },
        };
    },
};

// ── Incubate (fire): element consumed now, output delivered after N battles ──
const incubateRule: CombinationModeRule = {
    key: "incubate",
    triggerElement: "fire",
    actionLabel: "Incubate",
    activeLabel: "Incubating",
    workbookPath: "/incubate.xlsx",
    enhancementFlag: "incubate",
    equationSlotCount: 2,
    inputSlotIndices: [0, 1],
    outputKind: "deferred",
    applyDeferred: applyIncubate,
    buildPreview: ({ occupantItems }) => {
        const leftItem = occupantItems[0];
        const rightItem = occupantItems[1];
        if (!leftItem || !rightItem) {
            return null;
        }

        return {
            baseConsumedIds: [rightItem.id],
            brittleParticipants: [leftItem, rightItem],
            preview: {
                letter: "?",
                damage: 0,
                level: rightItem.level,
                description: "Time has mysterious effects on all things",
                isDeferred: true,
            },
        };
    },
};

// ── Divide (air): split power + split effects across two outputs ──
const divideRule: CombinationModeRule = {
    key: "divide",
    triggerElement: "air",
    actionLabel: "Divide",
    activeLabel: "Dividing",
    workbookPath: "/divide.xlsx",
    enhancementFlag: "divide",
    equationSlotCount: 2,
    inputSlotIndices: [0, 1],
    outputKind: "dual",
    buildPreview: ({ occupantItems }) => {
        const leftItem = occupantItems[0];
        const rightItem = occupantItems[1];
        if (!leftItem || !rightItem) {
            return null;
        }

        const halfPower = Math.ceil(rightItem.damage / 2);
        const topShield = rightItem.shield !== undefined ? Math.ceil(rightItem.shield / 2) : undefined;
        const bottomShield = rightItem.shield !== undefined ? Math.floor(rightItem.shield / 2) : undefined;
        const effects = rightItem.effects ?? [];
        const topCount = Math.ceil(effects.length / 2);
        const topEffects = effects.slice(0, topCount);
        const bottomEffects = effects.slice(topCount);
        const topEnergy = rightItem.energy !== undefined ? Math.ceil(rightItem.energy / 2) : undefined;
        const bottomEnergy = rightItem.energy !== undefined ? Math.floor(rightItem.energy / 2) : undefined;

        return {
            baseConsumedIds: [rightItem.id],
            brittleParticipants: [leftItem, rightItem],
            preview: {
                letter: rightItem.letter,
                damage: halfPower,
                shield: topShield,
                energy: topEnergy,
                enhancements: mergeEnhancements(rightItem.enhancements, "divide"),
                level: rightItem.level,
                description: rightItem.description,
                type1: rightItem.type1,
                type2: rightItem.type2,
                effects: topEffects,
                category: rightItem.category,
                secondOutput: {
                    letter: rightItem.letter,
                    damage: halfPower,
                    shield: bottomShield,
                    energy: bottomEnergy,
                    level: rightItem.level,
                    description: rightItem.description,
                    type1: rightItem.type1,
                    type2: rightItem.type2,
                    effects: bottomEffects,
                    category: rightItem.category,
                },
            },
        };
    },
};

// ── Refine (earth): element consumed now, output delivered with boosted power ──
const refineRule: CombinationModeRule = {
    key: "refine",
    triggerElement: "earth",
    actionLabel: "Refine",
    activeLabel: "Refining",
    workbookPath: "/refine.xlsx",
    enhancementFlag: "refine",
    equationSlotCount: 2,
    inputSlotIndices: [0, 1],
    outputKind: "deferred",
    applyDeferred: applyRefine,
    buildPreview: ({ occupantItems }) => {
        const leftItem = occupantItems[0];
        const rightItem = occupantItems[1];
        if (!leftItem || !rightItem) {
            return null;
        }

        return {
            baseConsumedIds: [rightItem.id],
            brittleParticipants: [leftItem, rightItem],
            preview: {
                letter: rightItem.letter,
                damage: 0,
                level: rightItem.level,
                description: "Time has mysterious effects on all things",
                isDeferred: true,
            },
        };
    },
};

// ── Duplicate (soul): exact copy + fresh catalog spawn ──
const duplicateRule: CombinationModeRule = {
    key: "duplicate",
    triggerElement: "soul",
    actionLabel: "Duplicate",
    activeLabel: "Duplicating",
    equationSlotCount: 2,
    inputSlotIndices: [0, 1],
    outputKind: "dual",
    buildPreview: ({ occupantItems, isModeSentinelId, lookupCatalogElement }) => {
        const leftItem = occupantItems[0];
        const rightItem = occupantItems[1];
        if (!leftItem || !rightItem) {
            return null;
        }

        const catalogEntry = lookupCatalogElement(rightItem.letter);
        const freshElement: RewardElement = catalogEntry ?? {
            letter: "Soul",
            damage: 0,
            energy: 0,
            rank: 0,
            level: 0,
            description: "A soul element",
            category: "element",
            effects: undefined,
        };
        const duplicateConsumedIds = isModeSentinelId(leftItem.id) ? [] : [leftItem.id];

        return {
            baseConsumedIds: [...duplicateConsumedIds, rightItem.id],
            brittleParticipants: [leftItem, rightItem],
            preview: {
                letter: rightItem.letter,
                damage: rightItem.damage,
                energy: rightItem.energy,
                enhancements: rightItem.enhancements,
                level: rightItem.level,
                description: rightItem.description,
                type1: rightItem.type1,
                type2: rightItem.type2,
                effects: rightItem.effects,
                category: rightItem.category,
                secondOutput: {
                    letter: freshElement.letter,
                    damage: freshElement.damage,
                    energy: freshElement.energy,
                    level: freshElement.level,
                    description: freshElement.description,
                    type1: freshElement.type1,
                    type2: freshElement.type2,
                    effects: freshElement.effects,
                    category: freshElement.category,
                },
            },
        };
    },
};

/**
 * Every combination mode, in the order the station evaluates per-mode previews.
 * Add a new mode by appending one object here.
 */
export const COMBINATION_MODE_RULES: readonly CombinationModeRule[] = [
    mixRule,
    incubateRule,
    divideRule,
    refineRule,
    duplicateRule,
];
