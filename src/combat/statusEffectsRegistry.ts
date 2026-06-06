import type { SpellEffectConfig, SpellEffectKind } from "./spellEffects";

type SupportedStatusEffectKind = Exclude<SpellEffectKind, "multi_hit">;

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

const STATUS_EFFECT_DESCRIPTORS: StatusEffectDescriptor[] = [
    {
        kind: "heal",
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
        kind: "burn",
        label: "Burn",
        chipClass: "effect-burn",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Burn: +${amount}` : null;
        },
        formatDetail: () => "Each stack deals damage at the end of turn",
    },
    {
        kind: "shield",
        label: "Shield",
        chipClass: "effect-shield",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Shield: +${amount}` : null;
        },
        formatDetail: () => "Absorbs incoming damage.",
    },
    {
        kind: "lifesteal",
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
        kind: "soak",
        label: "Soak",
        chipClass: "effect-soak",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Soak: +${amount}`;
        },
        formatDetail: () => "Each stack increases LIGHTNING damage; Reduces FIRE damage.",
    },
    {
        kind: "energize",
        label: "Energize",
        chipClass: "effect-energize",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Energize: +${amount}`;
        },
        formatDetail: () => "Gain +1 energy at the start of your next turn",
    },
    {
        kind: "freeze",
        label: "Freeze",
        chipClass: "effect-freeze",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Freeze: +${amount}`;
        },
        formatDetail: () => "Each stack significantly increases damage from FIRE attacks.",
    },
    {
        kind: "thorns",
        label: "Thorns",
        chipClass: "effect-thorns",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Thorns: +${amount}`;
        },
        formatDetail: () => "Reflect a portion of incoming damage to the attacker.",
    },
    {
        kind: "float",
        label: "Float",
        chipClass: "effect-float",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Float: +${amount}`;
        },
        formatDetail: () => "Reduce EARTH damage taken; Increase LIGHTNING damage taken.",
    },
    {
        kind: "combo",
        label: "Combo",
        chipClass: "effect-combo",
        formatLine: (effect) => `Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase();
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: "explode",
        label: "Explode",
        chipClass: "effect-explode",
        formatLine: (effect) => formatAmountLine("Explode", effect),
        formatDetail: () => "Deals a burst of damage when it resolves.",
    },
    {
        kind: "poison",
        label: "Poison",
        chipClass: "effect-poison",
        formatLine: (effect) => formatAmountLine("Poison", effect),
        formatDetail: () => "Deals damage over time at the end of each turn.",
    },
    {
        kind: "energy_combo",
        label: "Energy Combo",
        chipClass: "effect-energy-combo",
        formatLine: (effect) => `Energy Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase() || "MATCHING";
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: "power_combo",
        label: "Power Combo",
        chipClass: "effect-power-combo",
        formatLine: (effect) => `Power Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
        formatDetail: (effect) => {
            const typeText = effect.targetType?.trim().toUpperCase() || "MATCHING";
            return `If your next attack is a ${typeText} attack, it costs 1 less energy.`;
        },
    },
    {
        kind: "follow_up",
        label: "Follow Up",
        chipClass: "effect-follow-up",
        formatLine: (effect) => formatAmountLine("Follow Up", effect),
        formatDetail: () => "Sets up a follow-up attack or bonus effect.",
    },
    {
        kind: "charge",
        label: "Charge",
        chipClass: "effect-charge",
        formatLine: (effect) => formatAmountLine("Charge", effect),
        formatDetail: () => "Builds momentum for a later action.",
    },
    {
        kind: "exhaust",
        label: "Exhaust",
        chipClass: "effect-exhaust",
        formatLine: (effect) => formatAmountLine("Exhaust", effect),
        formatDetail: () => "Saps stamina and makes the target less effective.",
    },
    {
        kind: "consume",
        label: "Consume",
        chipClass: "effect-consume",
        formatLine: (effect) => formatAmountLine("Consume", effect),
        formatDetail: () => "Consumes this effect to trigger its payoff.",
    },
    {
        kind: "hardened",
        label: "Hardened",
        chipClass: "effect-hardened",
        formatLine: (effect) => formatAmountLine("Hardened", effect),
        formatDetail: () => "Consumes all energy to increase attack power.",
    },
    {
        kind: "rage",
        label: "Rage",
        chipClass: "effect-rage",
        formatLine: (effect) => formatAmountLine("Rage", effect),
        formatDetail: () => "Increases damage while it is active.",
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
        if (effect.kind === "multi_hit") {
            return null;
        }

        const descriptor = this.descriptorsByKind.get(effect.kind);
        if (!descriptor) {
            return null;
        }

        return descriptor.formatLine(effect);
    }

    getEffectDetail(effect: SpellEffectConfig): string | null {
        if (effect.kind === "multi_hit") {
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
