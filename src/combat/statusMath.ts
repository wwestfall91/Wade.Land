export const ENERGY_PER_TURN = 3;
export const MAX_TURN_ENERGY = 9;

export const BURN_FIRE_BONUS_PERCENT_PER_STACK = 5;
export const SOAK_LIGHTNING_BONUS_PER_STACK = 3;
export const SOAK_FIRE_PENALTY_PER_STACK = 3;
export const FREEZE_FIRE_BONUS_PER_STACK = 10;
export const THORNS_REFLECT_PERCENT_PER_STACK = 5;
/** @deprecated Float is now passive — percent is taken directly from effect.amount, not per-stack. */
export const FLOAT_EARTH_REDUCTION_PERCENT_PER_STACK = 5;
/** @deprecated Float is now passive — percent is taken directly from effect.amount, not per-stack. */
export const FLOAT_LIGHTNING_BONUS_PERCENT_PER_STACK = 5;

export const getBurnFireBonusPercent = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * BURN_FIRE_BONUS_PERCENT_PER_STACK;

export const getBurnFireBonus = (stacks: number, baseDamage: number): number =>
    Math.max(0, Math.round(baseDamage * getBurnFireBonusPercent(stacks) / 100));

export const getSoakLightningBonus = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * SOAK_LIGHTNING_BONUS_PER_STACK;

export const getSoakFirePenalty = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * SOAK_FIRE_PENALTY_PER_STACK;

export const getFreezeFireBonus = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * FREEZE_FIRE_BONUS_PER_STACK;

export const getThornsReflect = (stacks: number, incomingDamage: number): number =>
    Math.max(0, Math.round(incomingDamage * (Math.max(0, Math.floor(stacks)) * THORNS_REFLECT_PERCENT_PER_STACK) / 100));

/**
 * @param floatPercent  Total float percentage (sum of float effect amounts from owned elements).
 *                      Capped at 100 so earth damage cannot go below 0.
 */
export const getFloatEarthReduction = (floatPercent: number, baseDamage: number): number =>
    Math.max(0, Math.round(baseDamage * Math.min(100, Math.max(0, floatPercent)) / 100));

/**
 * @param floatPercent  Total float percentage (sum of float effect amounts from owned elements).
 */
export const getFloatLightningBonus = (floatPercent: number, baseDamage: number): number =>
    Math.max(0, Math.round(baseDamage * Math.max(0, floatPercent) / 100));
