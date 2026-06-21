import type { SpellEffectConfig, SpellEffectKind } from "./spellEffects";
import { EFFECTS } from "./spellEffects";
import { BURN_FIRE_BONUS_PERCENT_PER_STACK } from "./statusMath";

type SupportedStatusEffectKind = Exclude<SpellEffectKind, typeof EFFECTS.MULTI_HIT>;

type StatusEffectDescriptor = {
    kind: SupportedStatusEffectKind;
    label: string;
    chipClass: string;
    formatLine: (effect: SpellEffectConfig) => string | null;
    formatDetail: (effect: SpellEffectConfig) => string;
};

const formatComboType = (value?: string): string => {
    const normalized = value?.trim() ?? "";
    if (normalized.length === 0) {
        return "next attack";
    }

    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return `next ${label} attack`;
};

const formatAmountLine = (label: string, effect: SpellEffectConfig): string | null => {
    const amount = Math.max(0, effect.amount ?? 0);
    return amount > 0 ? `${label}: +${amount}` : null;
};

const formatChipAmount = (effect: SpellEffectConfig): string | null => {
    if (effect.kind === EFFECTS.MULTI_HIT) {
        const hits = Math.max(1, Math.floor(effect.hits ?? 1));
        return hits > 1 ? `${hits}x` : null;
    }

    if (effect.kind === EFFECTS.LIFESTEAL) {
        const amount = Math.max(0, effect.amount ?? 0);
        if (amount <= 0) {
            return null;
        }

        const percent = amount > 1 ? amount : Math.round(amount * 100);
        return `${percent}%`;
    }

    if (
        effect.kind === EFFECTS.SOAK
        || effect.kind === EFFECTS.ENERGIZE
        || effect.kind === EFFECTS.FREEZE
        || effect.kind === EFFECTS.THORNS
        || effect.kind === EFFECTS.FLOAT
    ) {
        return String(Math.max(1, effect.amount ?? 1));
    }

    const amount = Math.max(0, effect.amount ?? 0);
    return amount > 0 ? `+${amount}` : null;
};

const interpolateEffectAmount = (description: string, effect: SpellEffectConfig): string => {
    if (typeof effect.amount !== "number" || !Number.isFinite(effect.amount)) {
        return description;
    }

    const amountText = Number.isInteger(effect.amount)
        ? String(effect.amount)
        : String(effect.amount);

    return description.replace(/\bX\b/gi, amountText);
};

const STATUS_EFFECT_DESCRIPTORS: StatusEffectDescriptor[] = [
    {
        kind: EFFECTS.HEAL,
        label: "Heal",
        chipClass: "effect-heal",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Heal: +${amount}` : null;
        },
        formatDetail: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0
                ? `Restore ${amount} HP when this effect triggers.`
                : "Restores HP when this effect triggers.";
        },
    },
    {
        kind: EFFECTS.BURN,
        label: "Burn",
        chipClass: "effect-burn",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Burn: +${amount}` : null;
        },
        formatDetail: (effect) => `Each stack increases fire attack damage by ${Math.max(0, Math.floor(effect.amount ?? 0)) * BURN_FIRE_BONUS_PERCENT_PER_STACK}% while it lasts.`,
    },
    {
        kind: EFFECTS.SHIELD,
        label: "Shield",
        chipClass: "effect-shield",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Shield: +${amount}` : null;
        },
        formatDetail: () => "Absorbs incoming damage.",
    },
    {
        kind: EFFECTS.LIFESTEAL,
        label: "Lifesteal",
        chipClass: "effect-lifesteal",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            if (amount <= 0) {
                return null;
            }

            const percent = amount > 1 ? amount : Math.round(amount * 100);
            return `Lifesteal: ${percent}%`;
        },
        formatDetail: () => "Heal yourself based on damage dealt by the hit.",
    },
    {
        kind: EFFECTS.SOAK,
        label: "Soak",
        chipClass: "effect-soak",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Soak: +${amount}`;
        },
        formatDetail: () => "Each stack increases LIGHTNING damage; Reduces FIRE damage.",
    },
    {
        kind: EFFECTS.ENERGIZE,
        label: "Energize",
        chipClass: "effect-energize",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Energize: +${amount}`;
        },
        formatDetail: () => "Gain +1 energy at the start of your next turn",
    },
    {
        kind: EFFECTS.FREEZE,
        label: "Freeze",
        chipClass: "effect-freeze",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Freeze: +${amount}`;
        },
        formatDetail: () => "Each stack significantly increases damage from FIRE attacks.",
    },
    {
        kind: EFFECTS.THORNS,
        label: "Thorns",
        chipClass: "effect-thorns",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Thorns: +${amount}`;
        },
        formatDetail: () => "Reflect a portion of incoming damage to the attacker.",
    },
    {
        kind: EFFECTS.FLOAT,
        label: "Float",
        chipClass: "effect-float",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Float: +${amount}`;
        },
        formatDetail: () => "Reduce EARTH damage taken; Increase LIGHTNING damage taken.",
    },
    {
        kind: EFFECTS.COMBO,
        label: "Combo",
        chipClass: "effect-combo",
        formatLine: (effect) => `Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase();
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: EFFECTS.EXPLODE,
        label: "Combust",
        chipClass: "effect-explode",
        formatLine: () => "Combust: +150% power",
        formatDetail: () => "Increases attack power by 150%, but the caster takes recoil damage equal to 10% of that boosted attack power.",
    },
    {
        kind: EFFECTS.POISON,
        label: "Poison",
        chipClass: "effect-poison",
        formatLine: (effect) => formatAmountLine("Poison", effect),
        formatDetail: () => "Deals damage over time at the end of each turn.",
    },
    {
        kind: EFFECTS.ENERGY_COMBO,
        label: "Energy Combo",
        chipClass: "effect-energy-combo",
        formatLine: (effect) => `Energy Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase() || "MATCHING";
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: EFFECTS.POWER_COMBO,
        label: "Power Combo",
        chipClass: "effect-power-combo",
        formatLine: (effect) => `Power Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase() || "MATCHING";
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: EFFECTS.FOLLOW_UP,
        label: "Follow Up",
        chipClass: "effect-follow-up",
        formatLine: (effect) => formatAmountLine("Follow Up", effect),
        formatDetail: () => "Sets up a follow-up attack or bonus effect.",
    },
    {
        kind: EFFECTS.CHARGE,
        label: "Charge",
        chipClass: "effect-charge",
        formatLine: (effect) => formatAmountLine("Charge", effect),
        formatDetail: () => "Builds momentum for a later action.",
    },
    {
        kind: EFFECTS.EXHAUST,
        label: "Exhaust",
        chipClass: "effect-exhaust",
        formatLine: (effect) => formatAmountLine("Exhaust", effect),
        formatDetail: () => "Saps stamina and makes the target less effective.",
    },
    {
        kind: EFFECTS.CONSUME,
        label: "Consume",
        chipClass: "effect-consume",
        formatLine: (effect) => formatAmountLine("Consume", effect),
        formatDetail: () => "Consumes this effect to trigger its payoff.",
    },
    {
        kind: EFFECTS.HARDENED,
        label: "Hardened",
        chipClass: "effect-hardened",
        formatLine: (effect) => formatAmountLine("Hardened", effect),
        formatDetail: () => "Consumes all energy to increase attack power.",
    },
    {
        kind: EFFECTS.RAGE,
        label: "Rage",
        chipClass: "effect-rage",
        formatLine: (effect) => formatAmountLine("Rage", effect),
        formatDetail: () => "Increases damage while it is active.",
    },
    {
        kind: EFFECTS.BRITTLE,
        label: "Brittle",
        chipClass: "effect-brittle",
        formatLine: (effect) => {
            const uses = Math.max(1, Math.floor(effect.amount ?? 1));
            return `Brittle: consumed after ${uses} uses in a FORMULA`;
        },
        formatDetail: (effect) => {
            const uses = Math.max(1, Math.floor(effect.amount ?? 1));
            return `Consumed after ${uses} uses in a FORMULA.`;
        },
    },
    {
        kind: EFFECTS.GUST,
        label: "Gust",
        chipClass: "effect-gust",
        formatLine: (effect) => `Gust: next FIRE attack +${effect.amount ?? 50}%`,
        formatDetail: (effect) => `Increases FIRE damage by ${effect.amount ?? 50}% on the next attack.`,
    },
    {
        kind: EFFECTS.ROOT,
        label: "Root",
        chipClass: "effect-root",
        formatLine: (effect) => `Root: next WATER attack +${effect.amount ?? 50}%`,
        formatDetail: (effect) => `Increases WATER damage by ${effect.amount ?? 50}% on the next attack.`,
    },
    {
        kind: EFFECTS.STATIC,
        label: "Static",
        chipClass: "effect-static",
        formatLine: (effect) => `Static: next EARTH attack +${effect.amount ?? 50}%`,
        formatDetail: (effect) => `Increases EARTH damage by ${effect.amount ?? 50}% on the next attack.`,
    },
    {
        kind: EFFECTS.FLAME,
        label: "Flame",
        chipClass: "effect-flame",
        formatLine: (effect) => `Flame: next AIR attack +${effect.amount ?? 50}%`,
        formatDetail: (effect) => `Increases AIR damage by ${effect.amount ?? 50}% on the next attack.`,
    },
    {
        kind: EFFECTS.DRIZZLE,
        label: "Drizzle",
        chipClass: "effect-drizzle",
        formatLine: (effect) => `Drizzle: next LIGHTNING attack +${effect.amount ?? 50}%`,
        formatDetail: (effect) => `Increases LIGHTNING damage by ${effect.amount ?? 50}% on the next attack.`,
    },
];

export class StatusEffectsRegistry {
    private readonly descriptorsByKind = new Map<SupportedStatusEffectKind, StatusEffectDescriptor>();

    constructor(descriptors: StatusEffectDescriptor[]) {
        descriptors.forEach((descriptor) => {
            this.descriptorsByKind.set(descriptor.kind, descriptor);
        });
    }

    getAll(): StatusEffectDescriptor[] {
        return STATUS_EFFECT_DESCRIPTORS;
    }

    get(kind: SupportedStatusEffectKind): StatusEffectDescriptor | undefined {
        return this.descriptorsByKind.get(kind);
    }

    getSummaryLine(effect: SpellEffectConfig): string | null {
        if (effect.kind === EFFECTS.MULTI_HIT) {
            return null;
        }

        const descriptor = this.descriptorsByKind.get(effect.kind);
        if (!descriptor) {
            return null;
        }

        return descriptor.formatLine(effect);
    }

    getEffectDetail(effect: SpellEffectConfig): string | null {
        const longDescription = effect.longDescription?.trim();
        if (longDescription && longDescription.length > 0) {
            return interpolateEffectAmount(longDescription, effect);
        }

        const shortDescription = effect.shortDescription?.trim();
        if (shortDescription && shortDescription.length > 0) {
            return interpolateEffectAmount(shortDescription, effect);
        }

        if (effect.kind === EFFECTS.MULTI_HIT) {
            const hits = Math.max(1, Math.floor(effect.hits ?? 1));
            return hits > 1
                ? `This cast strikes ${hits} times.`
                : "This cast can strike multiple times.";
        }

        const descriptor = this.descriptorsByKind.get(effect.kind);
        if (!descriptor) {
            return null;
        }

        return descriptor.formatDetail(effect);
    }

    getChipLabel(effect: SpellEffectConfig): string {
        if (effect.kind === EFFECTS.MULTI_HIT) {
            const amountText = formatChipAmount(effect);
            return amountText ? `Hits ${amountText}` : "Hits";
        }

        const descriptor = this.descriptorsByKind.get(effect.kind);
        const label = descriptor?.label ?? effect.kind;
        const amountText = formatChipAmount(effect);

        return amountText ? `${label} ${amountText}` : label;
    }

    getChipClass(line: string): string {
        if (line.startsWith("Hits:")) {
            return "effect-multi-hit";
        }

        const descriptor = STATUS_EFFECT_DESCRIPTORS.find((entry) => line.startsWith(`${entry.label}:`));
        return descriptor?.chipClass ?? "effect-default";
    }
}

export const statusEffectsRegistry = new StatusEffectsRegistry(STATUS_EFFECT_DESCRIPTORS);

export const statusEffectDescriptors = STATUS_EFFECT_DESCRIPTORS;
