import type { SpellEffectConfig } from "./spellEffects";
import { statusEffectsRegistry } from "./statusEffectsRegistry";

type EffectTarget = "self" | "enemy";

export const getEffectSummaryLines = (effects?: SpellEffectConfig[] | null): string[] => {
    const lines: string[] = [];
    const normalizedEffects = effects ?? [];

    const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
    if (multiHit?.hits && multiHit.hits > 1) {
        lines.push(`Hits: ${multiHit.hits}x`);
    }

    normalizedEffects.forEach((effect) => {
        const line = statusEffectsRegistry.getSummaryLine(effect);
        if (line) {
            lines.push(line);
        }
    });

    return lines;
};

export const getEffectSummaryLinesForTarget = (
    effects?: SpellEffectConfig[] | null,
    target: EffectTarget = "enemy",
): string[] => {
    const lines: string[] = [];
    const normalizedEffects = effects ?? [];

    const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
    if (multiHit?.hits && multiHit.hits > 1) {
        lines.push(`Hits: ${multiHit.hits}x`);
    }

    normalizedEffects.forEach((effect) => {
        if (effect.kind !== "multi_hit" && effect.target !== target) {
            return;
        }

        const line = statusEffectsRegistry.getSummaryLine(effect);
        if (line) {
            lines.push(line);
        }
    });

    return lines;
};

export const getEffectChipClass = (line: string): string => {
    return statusEffectsRegistry.getChipClass(line);
};
