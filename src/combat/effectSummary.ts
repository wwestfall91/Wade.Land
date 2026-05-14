import type { SpellEffectConfig } from "./spellEffects";

export const getEffectSummaryLines = (effects?: SpellEffectConfig[] | null): string[] => {
    const lines: string[] = [];
    const normalizedEffects = effects ?? [];

    const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
    if (multiHit?.hits && multiHit.hits > 1) {
        lines.push(`Hits: ${multiHit.hits}x`);
    }

    normalizedEffects.forEach((effect) => {
        switch (effect.kind) {
            case "heal": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    lines.push(`Heal: +${amount}`);
                }
                break;
            }
            case "burn": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    lines.push(`Burn: +${amount}`);
                }
                break;
            }
            case "shield": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    lines.push(`Shield: +${amount}`);
                }
                break;
            }
            case "lifesteal": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    const percent = amount > 1 ? amount : Math.round(amount * 100);
                    lines.push(`Lifesteal: ${percent}%`);
                }
                break;
            }
            case "soak": {
                const amount = Math.max(1, effect.amount ?? 1);
                lines.push(`Soak: +${amount}`);
                break;
            }
            default:
                break;
        }
    });

    return lines;
};

export const getEffectChipClass = (line: string): string => {
    if (line.startsWith("Heal:")) {
        return "effect-heal";
    }
    if (line.startsWith("Burn:")) {
        return "effect-burn";
    }
    if (line.startsWith("Shield:")) {
        return "effect-shield";
    }
    if (line.startsWith("Lifesteal:")) {
        return "effect-lifesteal";
    }
    if (line.startsWith("Soak:")) {
        return "effect-soak";
    }
    if (line.startsWith("Hits:")) {
        return "effect-multi-hit";
    }

    return "effect-default";
};
