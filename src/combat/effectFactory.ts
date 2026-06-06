import type { SpellEffectConfig } from "./spellEffects";

export type PlayerAttackEffectDelta = {
    playerHealing: number;
    enemyBurnApplied: number;
    enemyBurnDuration: number;
    playerShieldGranted: number;
    enemySoakApplied: number;
    playerEnergizeApplied: number;
    enemyFreezeApplied: number;
    enemyThornsApplied: number;
    enemyFloatApplied: number;
};

export type EnemyAttackEffectDelta = {
    enemyHealing: number;
    playerBurnApplied: number;
    playerBurnDuration: number;
    playerShieldGranted: number;
    playerSoakApplied: number;
    playerFreezeApplied: number;
    playerThornsApplied: number;
    playerFloatApplied: number;
};

const EMPTY_PLAYER_ATTACK_DELTA: PlayerAttackEffectDelta = {
    playerHealing: 0,
    enemyBurnApplied: 0,
    enemyBurnDuration: 0,
    playerShieldGranted: 0,
    enemySoakApplied: 0,
    playerEnergizeApplied: 0,
    enemyFreezeApplied: 0,
    enemyThornsApplied: 0,
    enemyFloatApplied: 0,
};

const EMPTY_ENEMY_ATTACK_DELTA: EnemyAttackEffectDelta = {
    enemyHealing: 0,
    playerBurnApplied: 0,
    playerBurnDuration: 0,
    playerShieldGranted: 0,
    playerSoakApplied: 0,
    playerFreezeApplied: 0,
    playerThornsApplied: 0,
    playerFloatApplied: 0,
};

export class EffectFactory {
    resolvePlayerAttackEffect(effect: SpellEffectConfig, hitDamage: number): PlayerAttackEffectDelta {
        switch (effect.kind) {
            case "heal": {
                if (effect.target === "enemy") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerHealing: amount }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case "burn": {
                if (effect.target === "self") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                const duration = Math.max(1, effect.duration ?? 1);
                return amount > 0
                    ? {
                        ...EMPTY_PLAYER_ATTACK_DELTA,
                        enemyBurnApplied: amount,
                        enemyBurnDuration: duration,
                    }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case "shield": {
                if (effect.target === "enemy") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerShieldGranted: amount }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case "lifesteal": {
                if (effect.target === "enemy") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                const multiplier = amount > 1 ? amount / 100 : amount;
                const healing = Math.max(0, Math.round(hitDamage * multiplier));
                return healing > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerHealing: healing }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case "soak": {
                if (effect.target === "self") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                return { ...EMPTY_PLAYER_ATTACK_DELTA, enemySoakApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "energize": {
                if (effect.target === "enemy") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                return { ...EMPTY_PLAYER_ATTACK_DELTA, playerEnergizeApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "freeze": {
                if (effect.target === "self") {
                    return EMPTY_PLAYER_ATTACK_DELTA;
                }

                return { ...EMPTY_PLAYER_ATTACK_DELTA, enemyFreezeApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "thorns": {
                if (effect.target === "enemy") {
                    return { ...EMPTY_PLAYER_ATTACK_DELTA, enemyThornsApplied: Math.max(1, effect.amount ?? 1) };
                }

                return EMPTY_PLAYER_ATTACK_DELTA;
            }
            case "float": {
                if (effect.target === "enemy") {
                    return { ...EMPTY_PLAYER_ATTACK_DELTA, enemyFloatApplied: Math.max(1, effect.amount ?? 1) };
                }

                return EMPTY_PLAYER_ATTACK_DELTA;
            }
            default:
                return EMPTY_PLAYER_ATTACK_DELTA;
        }
    }

    resolveEnemyAttackEffect(effect: SpellEffectConfig, remainingDamage: number): EnemyAttackEffectDelta {
        switch (effect.kind) {
            case "heal": {
                return EMPTY_ENEMY_ATTACK_DELTA;
            }
            case "burn": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                const duration = Math.max(1, effect.duration ?? 1);
                return amount > 0
                    ? {
                        ...EMPTY_ENEMY_ATTACK_DELTA,
                        playerBurnApplied: amount,
                        playerBurnDuration: duration,
                    }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case "shield": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_ENEMY_ATTACK_DELTA, playerShieldGranted: amount }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case "lifesteal": {
                if (effect.target !== "self") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                const amount = Math.max(0, effect.amount ?? 0);
                const multiplier = amount > 1 ? amount / 100 : amount;
                const healing = Math.max(0, Math.round(remainingDamage * multiplier));
                return healing > 0
                    ? { ...EMPTY_ENEMY_ATTACK_DELTA, enemyHealing: healing }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case "soak": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                return { ...EMPTY_ENEMY_ATTACK_DELTA, playerSoakApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "freeze": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                return { ...EMPTY_ENEMY_ATTACK_DELTA, playerFreezeApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "thorns": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                return { ...EMPTY_ENEMY_ATTACK_DELTA, playerThornsApplied: Math.max(1, effect.amount ?? 1) };
            }
            case "float": {
                if (effect.target !== "enemy") {
                    return EMPTY_ENEMY_ATTACK_DELTA;
                }

                return { ...EMPTY_ENEMY_ATTACK_DELTA, playerFloatApplied: Math.max(1, effect.amount ?? 1) };
            }
            default:
                return EMPTY_ENEMY_ATTACK_DELTA;
        }
    }
}

export const effectFactory = new EffectFactory();
