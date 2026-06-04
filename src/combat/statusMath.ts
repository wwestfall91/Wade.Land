export const ENERGY_PER_TURN = 3;
export const MAX_TURN_ENERGY = 9;

export const BURN_DAMAGE_PER_STACK = 5;
export const SOAK_LIGHTNING_BONUS_PER_STACK = 3;
export const SOAK_FIRE_PENALTY_PER_STACK = 3;
export const FREEZE_FIRE_BONUS_PER_STACK = 10;
export const THORNS_REFLECT_PERCENT_PER_STACK = 5;
export const FLOAT_EARTH_REDUCTION_PERCENT_PER_STACK = 5;
export const FLOAT_LIGHTNING_BONUS_PERCENT_PER_STACK = 5;

export const getBurnTickDamage = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * BURN_DAMAGE_PER_STACK;

export const getSoakLightningBonus = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * SOAK_LIGHTNING_BONUS_PER_STACK;

export const getSoakFirePenalty = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * SOAK_FIRE_PENALTY_PER_STACK;

export const getFreezeFireBonus = (stacks: number): number =>
    Math.max(0, Math.floor(stacks)) * FREEZE_FIRE_BONUS_PER_STACK;

export const getThornsReflect = (stacks: number, incomingDamage: number): number =>
    Math.max(0, Math.round(incomingDamage * (Math.max(0, Math.floor(stacks)) * THORNS_REFLECT_PERCENT_PER_STACK) / 100));

export const getFloatEarthReduction = (stacks: number, baseDamage: number): number =>
    Math.max(0, Math.round(baseDamage * (Math.max(0, Math.floor(stacks)) * FLOAT_EARTH_REDUCTION_PERCENT_PER_STACK) / 100));

export const getFloatLightningBonus = (stacks: number, baseDamage: number): number =>
    Math.max(0, Math.round(baseDamage * (Math.max(0, Math.floor(stacks)) * FLOAT_LIGHTNING_BONUS_PERCENT_PER_STACK) / 100));
