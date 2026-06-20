export type ModeKey = "mix" | "incubate" | "divide" | "refine" | "duplicate";

/**
 * How the Logic Panel renders for this mode.
 * - single-slot: one element drop zone
 * - dual-slot: two drop zones (Primary + Secondary) for Mix
 * - single-slot-counter: one drop zone + battle counter (Incubate, Refine)
 */
export type ModeLogicType = "single-slot" | "dual-slot" | "single-slot-counter";

/**
 * How the Result Panel renders for this mode.
 * - single-output: one output zone
 * - dual-output: two output zones stacked vertically (Divide, Duplicate)
 */
export type ModeResultType = "single-output" | "dual-output";

export type ModeDefinition = {
    key: ModeKey;
    displayName: string;
    actionLabel: string;
    logicType: ModeLogicType;
    resultType: ModeResultType;
};

export const MODE_DEFINITIONS: Record<ModeKey, ModeDefinition> = {
    mix: {
        key: "mix",
        displayName: "Mix",
        actionLabel: "Mix",
        logicType: "dual-slot",
        resultType: "single-output",
    },
    incubate: {
        key: "incubate",
        displayName: "Incubate",
        actionLabel: "Incubate",
        logicType: "single-slot-counter",
        resultType: "single-output",
    },
    divide: {
        key: "divide",
        displayName: "Divide",
        actionLabel: "Divide",
        logicType: "single-slot",
        resultType: "dual-output",
    },
    refine: {
        key: "refine",
        displayName: "Refine",
        actionLabel: "Refine",
        logicType: "single-slot-counter",
        resultType: "single-output",
    },
    duplicate: {
        key: "duplicate",
        displayName: "Duplicate",
        actionLabel: "Duplicate",
        logicType: "single-slot",
        resultType: "dual-output",
    },
};

export const getModeDefinition = (key: string): ModeDefinition | undefined =>
    MODE_DEFINITIONS[key as ModeKey];

export const getModeResultType = (key: string): ModeResultType =>
    getModeDefinition(key)?.resultType ?? "single-output";

export const getModeLogicType = (key: string): ModeLogicType =>
    getModeDefinition(key)?.logicType ?? "single-slot";
