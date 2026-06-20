/**
 * All canonical internal effect kind names — the single source of truth.
 * To rename an effect internally, change its value here. TypeScript will
 * surface every reference that needs updating across the entire codebase.
 */
export const EFFECTS = {
    HEAL:         "heal",
    MULTI_HIT:    "multi_hit",
    BURN:         "burn",
    SHIELD:       "shield",
    LIFESTEAL:    "lifesteal",
    SOAK:         "soak",
    ENERGIZE:     "energize",
    FREEZE:       "freeze",
    THORNS:       "thorns",
    FLOAT:        "float",
    COMBO:        "combo",
    EXPLODE:      "explode",
    POISON:       "poison",
    ENERGY_COMBO: "energy_combo",
    POWER_COMBO:  "power_combo",
    FOLLOW_UP:    "follow_up",
    CHARGE:       "charge",
    EXHAUST:      "exhaust",
    CONSUME:      "consume",
    HARDENED:     "hardened",
    RAGE:         "rage",
    SQUISHY:      "squishy",
    EXPONENTIAL:  "exponential",
    POWERFUL:     "powerful",
    ENERGETIC:    "energetic",
    EFFICIENT:    "efficient",
    BRITTLE:      "brittle",
} as const;


// Derived union — never edit this line; rename values in SPELL_EFFECT_KINDS instead.
export type SpellEffectKind = typeof EFFECTS[keyof typeof EFFECTS];

export type SpellEffectTarget = "self" | "enemy";

export type SpellEffectGrowth = "+" | "-" | "=";

export type SpellEffectConfig = {
    kind: SpellEffectKind;
    amount?: number;
    hits?: number;
    duration?: number;
    target?: SpellEffectTarget;
    targetType?: string;
    /** Growth direction from effects.xlsx: + = increase is beneficial, - = decrease is beneficial, = = static */
    growth?: SpellEffectGrowth;
    /** Spreadsheet-provided short tooltip copy for this effect, when available. */
    shortDescription?: string;
    /** Spreadsheet-provided long tooltip copy for this effect, when available. */
    longDescription?: string;
};

export type ActiveBurnStatus = {
    kind: typeof EFFECTS.BURN;
    stacks: number;
    remainingTurns: number;
};

export type ActiveSoakStatus = {
    kind: typeof EFFECTS.SOAK;
    stacks: number;
    remainingTurns?: number;
};

export type ActiveFreezeStatus = {
    kind: typeof EFFECTS.FREEZE;
    stacks: number;
    remainingTurns?: number;
};

export type ActiveEnergizeStatus = {
    kind: typeof EFFECTS.ENERGIZE;
    stacks: number;
};

export type ActiveThornsStatus = {
    kind: typeof EFFECTS.THORNS;
    stacks: number;
    remainingTurns?: number;
};

export type ActiveFloatStatus = {
    kind: typeof EFFECTS.FLOAT;
    stacks: number;
};

const EFFECT_COLUMN_CANDIDATES = (index: number, suffix: string) => [
    `SE${index} ${suffix}`,
    `Effect ${index} ${suffix}`,
    `Effect${index} ${suffix}`,
    `Effect${index}${suffix}`,
];

const normalizeGrowth = (value: string): SpellEffectGrowth | undefined => {
    const trimmed = value.trim();
    if (trimmed === "+" || trimmed === "-" || trimmed === "=") {
        return trimmed;
    }
    return undefined;
};

const readFirstString = (row: Record<string, unknown>, keys: string[]): string => {
    const value = keys
        .map((key) => row[key])
        .find((entry) => typeof entry === "string" || typeof entry === "number");

    return String(value ?? "").trim();
};

const SELF_TARGET_EFFECT_KINDS: ReadonlyArray<SpellEffectKind> = [
    EFFECTS.HEAL, EFFECTS.SHIELD, EFFECTS.LIFESTEAL, EFFECTS.ENERGIZE, EFFECTS.THORNS, EFFECTS.FLOAT,
    EFFECTS.COMBO, EFFECTS.ENERGY_COMBO, EFFECTS.POWER_COMBO, EFFECTS.FOLLOW_UP, EFFECTS.CHARGE,
    EFFECTS.CONSUME, EFFECTS.HARDENED, EFFECTS.RAGE, EFFECTS.POWERFUL, EFFECTS.ENERGETIC, EFFECTS.EFFICIENT, EFFECTS.BRITTLE,
];

/**
 * Maps every spreadsheet-facing name to its internal SpellEffectKind.
 *
 * This is the SINGLE place to update when an effect is renamed in the
 * spreadsheet. Add an alias entry here; nothing else in the codebase needs
 * to change. Keys must be lowercase with spaces/dashes already replaced by
 * underscores (the normalization step below handles that before lookup).
 */
export const EFFECT_KIND_ALIASES: Readonly<Record<string, SpellEffectKind>> = {
    // ── canonical internal names ──────────────────────────────────────────
    heal:         EFFECTS.HEAL,
    multi_hit:    EFFECTS.MULTI_HIT,
    burn:         EFFECTS.BURN,
    shield:       EFFECTS.SHIELD,
    lifesteal:    EFFECTS.LIFESTEAL,
    soak:         EFFECTS.SOAK,
    energize:     EFFECTS.ENERGIZE,
    freeze:       EFFECTS.FREEZE,
    thorns:       EFFECTS.THORNS,
    float:        EFFECTS.FLOAT,
    combo:        EFFECTS.COMBO,
    explode:      EFFECTS.EXPLODE,
    poison:       EFFECTS.POISON,
    energy_combo: EFFECTS.ENERGY_COMBO,
    power_combo:  EFFECTS.POWER_COMBO,
    follow_up:    EFFECTS.FOLLOW_UP,
    charge:       EFFECTS.CHARGE,
    exhaust:      EFFECTS.EXHAUST,
    consume:      EFFECTS.CONSUME,
    hardened:     EFFECTS.HARDENED,
    rage:         EFFECTS.RAGE,
    squishy:      EFFECTS.SQUISHY,
    exponential:  EFFECTS.EXPONENTIAL,
    powerful:     EFFECTS.POWERFUL,
    energetic:    EFFECTS.ENERGETIC,
    efficient:    EFFECTS.EFFICIENT,
    brittle:      EFFECTS.BRITTLE,
    // ── spreadsheet aliases ───────────────────────────────────────────────
    multihit:     EFFECTS.MULTI_HIT,    // "multi hit" / "multihit" in sheet
    combust:      EFFECTS.EXPLODE,      // "combust" in sheet
    energycombo:  EFFECTS.ENERGY_COMBO,
    powercombo:   EFFECTS.POWER_COMBO,
    followup:     EFFECTS.FOLLOW_UP,
    soaker:       EFFECTS.SOAK,         // renamed in sheet
};

const normalizeEffectKind = (value: string): SpellEffectKind | null => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return EFFECT_KIND_ALIASES[normalized] ?? null;
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
        const growth = normalizeGrowth(readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Growth")));
        const shortDescription = readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Short Description"));
        const longDescription = readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Long Description"));
        const defaultTarget: SpellEffectTarget = SELF_TARGET_EFFECT_KINDS.includes(kind) ? "self" : "enemy";
        const rawTarget = readFirstString(row, EFFECT_COLUMN_CANDIDATES(index, "Target"));
        const target = normalizeTarget(rawTarget, defaultTarget);

        const effect: SpellEffectConfig = { kind, target };

        if ((kind === EFFECTS.COMBO || kind === EFFECTS.ENERGY_COMBO || kind === EFFECTS.POWER_COMBO) && rawTarget.length > 0 && target === defaultTarget) {
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
        if (growth !== undefined) {
            effect.growth = growth;
        }
        if (shortDescription.length > 0) {
            effect.shortDescription = shortDescription;
        }
        if (longDescription.length > 0) {
            effect.longDescription = longDescription;
        }

        effects.push(effect);
    }

    return effects;
};

export const getSpellHitCount = (effects?: SpellEffectConfig[]): number => {
    const multiHit = effects?.find((effect) => effect.kind === EFFECTS.MULTI_HIT);
    return Math.max(1, Math.floor(multiHit?.hits ?? 1));
};

export const getPerHitSpellEffects = (effects?: SpellEffectConfig[]): SpellEffectConfig[] =>
    (effects ?? []).filter((effect) => effect.kind !== EFFECTS.MULTI_HIT);