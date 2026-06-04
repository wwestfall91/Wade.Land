import type { SpellEffectConfig, SpellEffectKind } from "./spellEffects";

type SupportedStatusEffectKind = Exclude<SpellEffectKind, "multi_hit">;

type StatusEffectDescriptor = {
    kind: SupportedStatusEffectKind;
    label: string;
    chipClass: string;
    formatLine: (effect: SpellEffectConfig) => string | null;
};

const formatComboType = (value?: string): string => {
    const normalized = value?.trim() ?? "";
    if (normalized.length === 0) {
        return "next attack";
    }

    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return `next ${label} attack`;
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
    },
    {
        kind: "burn",
        label: "Burn",
        chipClass: "effect-burn",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Burn: +${amount}` : null;
        },
    },
    {
        kind: "shield",
        label: "Shield",
        chipClass: "effect-shield",
        formatLine: (effect) => {
            const amount = Math.max(0, effect.amount ?? 0);
            return amount > 0 ? `Shield: +${amount}` : null;
        },
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
    },
    {
        kind: "soak",
        label: "Soak",
        chipClass: "effect-soak",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Soak: +${amount}`;
        },
    },
    {
        kind: "energize",
        label: "Energize",
        chipClass: "effect-energize",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Energize: +${amount}`;
        },
    },
    {
        kind: "freeze",
        label: "Freeze",
        chipClass: "effect-freeze",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Freeze: +${amount}`;
        },
    },
    {
        kind: "thorns",
        label: "Thorns",
        chipClass: "effect-thorns",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Thorns: +${amount}`;
        },
    },
    {
        kind: "float",
        label: "Float",
        chipClass: "effect-float",
        formatLine: (effect) => {
            const amount = Math.max(1, effect.amount ?? 1);
            return `Float: +${amount}`;
        },
    },
    {
        kind: "combo",
        label: "Combo",
        chipClass: "effect-combo",
        formatLine: (effect) => `Combo: ${formatComboType(effect.targetType)} costs -1 energy`,
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
