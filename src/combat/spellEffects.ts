export type SpellEffectKind = "heal" | "multi_hit" | "burn" | "shield" | "lifesteal" | "soak" | "energize" | "freeze" | "thorns" | "float" | "combo";

export type SpellEffectTarget = "self" | "enemy";

export type SpellEffectConfig = {
    kind: SpellEffectKind;
    amount?: number;
    hits?: number;
    duration?: number;
    target?: SpellEffectTarget;
    targetType?: string;
};

export type ActiveBurnStatus = {
    kind: "burn";
    stacks: number;
    remainingTurns: number;
};

export type ActiveSoakStatus = {
    kind: "soak";
    stacks: number;
};

export type ActiveFreezeStatus = {
    kind: "freeze";
    stacks: number;
};

export type ActiveEnergizeStatus = {
    kind: "energize";
    stacks: number;
};

export type ActiveThornsStatus = {
    kind: "thorns";
    stacks: number;
};

export type ActiveFloatStatus = {
    kind: "float";
    stacks: number;
};

const EFFECT_COLUMN_CANDIDATES = (index: number, suffix: string) => [
    `SE${index} ${suffix}`,
    `Effect ${index} ${suffix}`,
    `Effect${index} ${suffix}`,
    `Effect${index}${suffix}`,
];

const readFirstString = (row: Record<string, unknown>, keys: string[]): string => {
    const value = keys
        .map((key) => row[key])
        .find((entry) => typeof entry === "string" || typeof entry === "number");

    return String(value ?? "").trim();
};

const normalizeEffectKind = (value: string): SpellEffectKind | null => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

    switch (normalized) {
        case "heal":
            return "heal";
        case "multihit":
            return "multi_hit";
        case "burn":
            return "burn";
        case "shield":
            return "shield";
        case "lifesteal":
            return "lifesteal";
        case "soak":
            return "soak";
        case "energize":
            return "energize";
        case "freeze":
            return "freeze";
        case "thorns":
            return "thorns";
        case "float":
            return "float";
        case "combo":
            return "combo";
        default:
            return null;
    }
};

const normalizeBattleType = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const normalizeTarget = (value: string, fallback: SpellEffectTarget): SpellEffectTarget => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "enemy") {
        return "enemy";
    }
    if (normalized === "self") {
        return "self";
    }

    return fallback;
};

const safeNumber = (value: string): number | undefined => {
    if (value.length === 0) {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    return parsed;
};

export const parseSpellEffectsFromRow = (
    row: Record<string, unknown>,
    maxEffects = 3,
): SpellEffectConfig[] => {
    const effects: SpellEffectConfig[] = [];

    for (let index = 1; index <= maxEffects; index += 1) {
        const kindValue = readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Kind"));
        const kind = normalizeEffectKind(kindValue);

        if (!kind) {
            continue;
        }

            const amount = safeNumber(readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Amount")));
            const hits = safeNumber(readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Hits")));
            const duration = safeNumber(readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Duration")));
            const defaultTarget: SpellEffectTarget = ["heal", "shield", "lifesteal", "energize", "thorns", "float", "combo"].includes(kind)
            ? "self"
            : "enemy";
            const rawTarget = readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Target"));
            const target = normalizeTarget(rawTarget, defaultTarget);

        const effect: SpellEffectConfig = { kind, target };

            if (kind === "combo" && rawTarget.length > 0 && target === defaultTarget) {
                effect.targetType = normalizeBattleType(rawTarget);
            }

        if (amount !== undefined) {
            effect.amount = amount;
        }
        if (hits !== undefined) {
            effect.hits = Math.max(1, Math.floor(hits));
        }
        if (duration !== undefined) {
            effect.duration = Math.max(1, Math.floor(duration));
        }

        effects.push(effect);
    }

    return effects;
};

export const getSpellHitCount = (effects?: SpellEffectConfig[]): number => {
    const multiHit = effects?.find((effect) => effect.kind === "multi_hit");
    return Math.max(1, Math.floor(multiHit?.hits ?? 1));
};

export const getPerHitSpellEffects = (effects?: SpellEffectConfig[]): SpellEffectConfig[] =>
    (effects ?? []).filter((effect) => effect.kind !== "multi_hit");