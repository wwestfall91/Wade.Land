import type { SpellEffectConfig } from "../../combat/spellEffects";
import type { ModeTabElementKey } from "./CombinationModePanel";
import type { DraggableItem, PreviewCombination } from "./combinationTypes";
import type { ElementStats } from "./combinationCalculations";
import {
    COMBINATION_MODE_RULES,
    type CombinationModeActionKey,
    type CombinationModeRule,
    type ModePreviewContext,
} from "./combinationModeRules";

// ── Brittle helpers ────────────────────────────────────────────────────────────
// A "brittle" effect with 1 use is consumed the moment its element is used in a
// formula. These pure helpers are shared by the engine (per-mode rules) and by the
// global element-interaction rules that still live in Game.tsx.

export const getBrittleUses = (effect: SpellEffectConfig): number =>
    Math.max(1, Math.floor(effect.amount ?? 1));

export const isBrittleConsumedOnFormulaUse = (item?: DraggableItem): boolean =>
    Boolean(item?.effects?.some((effect) => effect.kind === "brittle" && getBrittleUses(effect) <= 1));

export const withBrittleFormulaConsumedIds = (
    baseConsumedIds: number[],
    items: Array<DraggableItem | undefined>,
): number[] => {
    const brittleConsumedIds = items
        .filter((item): item is DraggableItem => Boolean(item) && isBrittleConsumedOnFormulaUse(item))
        .map((item) => item.id);

    return Array.from(new Set([...baseConsumedIds, ...brittleConsumedIds]));
};

/**
 * Consumes the declarative {@link COMBINATION_MODE_RULES} and exposes every
 * per-mode behaviour the station needs (slot layout, readiness, preview building,
 * deferred resolution, labels). All mode-specific knowledge lives in the rules, so
 * the rest of the app interacts with modes exclusively through this engine.
 */
export class CombinationStationRulesEngine {
    private readonly rulesByKey = new Map<CombinationModeActionKey, CombinationModeRule>();
    private readonly rulesByElement = new Map<ModeTabElementKey, CombinationModeRule>();

    constructor(rules: readonly CombinationModeRule[]) {
        for (const rule of rules) {
            this.rulesByKey.set(rule.key, rule);
            this.rulesByElement.set(rule.triggerElement, rule);
        }
    }

    /** Returns the rule for an action key, or undefined for non-mode keys (e.g. "idle"). */
    getRule(key: string): CombinationModeRule | undefined {
        return this.rulesByKey.get(key as CombinationModeActionKey);
    }

    /** Returns the rule activated by a given element tab. */
    getRuleByElement(elementKey: ModeTabElementKey): CombinationModeRule | undefined {
        return this.rulesByElement.get(elementKey);
    }

    /** Number of equation slots the mode renders (defaults to 2 for non-mode keys). */
    getEquationSlotCount(key: string): 2 | 3 {
        return this.getRule(key)?.equationSlotCount ?? 2;
    }

    /** True when the mode renders a third equation slot. */
    usesThirdSlot(key: string): boolean {
        return this.getEquationSlotCount(key) === 3;
    }

    /** Equation slot indices that hold the consumable inputs (defaults to [0, 1]). */
    getInputSlotIndices(key: string): readonly number[] {
        return this.getRule(key)?.inputSlotIndices ?? [0, 1];
    }

    /** True when every input slot for the mode is occupied. */
    areInputSlotsFilled(key: string, zoneOccupants: ReadonlyArray<number | null>): boolean {
        return this.getInputSlotIndices(key).every((index) => (zoneOccupants[index] ?? null) !== null);
    }

    /** True when the mode delivers its output after a delay (Incubate / Refine). */
    isDeferred(key: string): boolean {
        return this.getRule(key)?.outputKind === "deferred";
    }

    /** True when the mode spawns a second element alongside the primary (Divide / Duplicate). */
    isDualOutput(key: string): boolean {
        return this.getRule(key)?.outputKind === "dual";
    }

    /** Resolves a deferred mode's stored input into its delivered output. */
    applyDeferred(key: string, input: ElementStats, counter: number): ElementStats | null {
        const apply = this.getRule(key)?.applyDeferred;
        return apply ? apply(input, counter) : null;
    }

    /** Combine action label for the mode (e.g. "Mix"), or null when unknown. */
    getActionLabel(key: string): string | null {
        return this.getRule(key)?.actionLabel ?? null;
    }

    /** Active-state label for the mode (e.g. "Mixing"), or null when unknown. */
    getActiveLabel(key: string): string | null {
        return this.getRule(key)?.activeLabel ?? null;
    }

    /**
     * Builds the live preview for a mode, returning the full {@link PreviewCombination}
     * with brittle-augmented `consumedIds` stamped on. Returns null when the mode
     * cannot currently produce an output.
     */
    buildPreview(key: string, context: ModePreviewContext): PreviewCombination | null {
        const rule = this.getRule(key);
        if (!rule) {
            return null;
        }

        const build = rule.buildPreview(context);
        if (!build) {
            return null;
        }

        return {
            ...build.preview,
            consumedIds: withBrittleFormulaConsumedIds(build.baseConsumedIds, build.brittleParticipants),
        };
    }
}

/** Default engine instance wired to the project's combination mode rules. */
export const combinationStationRulesEngine = new CombinationStationRulesEngine(COMBINATION_MODE_RULES);
