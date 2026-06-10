import type { SpellEffectConfig } from "./spellEffects";
import { EFFECTS as SK } from "./spellEffects";

// ── Delta types ───────────────────────────────────────────────────────────────

export type PlayerAttackEffectDelta = {
    // Immediate per-hit results
    playerHealing: number;
    enemyBurnApplied: number;
    enemyBurnDuration: number;
    playerShieldGranted: number;
    enemySoakApplied: number;
    /** Turns the enemy soak stacks last (0 = no expiry). */
    enemySoakDuration: number;
    playerEnergizeApplied: number;
    /** % of enemy soak stacks to convert to freeze stacks (0–100+) */
    enemyFreezeSoakConvertPercent: number;
    /** Turns the converted freeze stacks last (0 = no expiry). */
    enemyFreezeSoakConvertDuration: number;
    enemyThornsApplied: number;
    /** Turns the enemy thorns stacks last (0 = no expiry). */
    enemyThornsDuration: number;
    // Post-cast self-effects
    /** % of player's remaining energy to drain after the cast */
    playerExhaustEnergyPercent: number;
    /** % of player's current shield to remove after the cast */
    playerSquishyShieldPercent: number;
    /** Flat max-HP reduction applied permanently each use */
    playerConsumeMaxHpReduce: number;
};

export type EnemyAttackEffectDelta = {
    enemyHealing: number;
    playerBurnApplied: number;
    playerBurnDuration: number;
    playerShieldGranted: number;
    playerSoakApplied: number;
    /** Turns the player soak stacks last (0 = no expiry). */
    playerSoakDuration: number;
    /** % of player soak stacks to convert to freeze stacks (0–100+) */
    playerFreezeSoakConvertPercent: number;
    /** Turns the converted freeze stacks last (0 = no expiry). */
    playerFreezeSoakConvertDuration: number;
    playerThornsApplied: number;
    /** Turns the player thorns stacks last (0 = no expiry). */
    playerThornsDuration: number;
};

// ── Pre-hit damage modifiers ──────────────────────────────────────────────────

export type PreHitContext = {
    spellEnergyCost: number;
    playerCurrentHp: number;
    playerMaxHp: number;
    playerShield: number;
};

export type PreHitDamageMod = {
    /** Multiply base damage by this (1 = no change). */
    multiplier: number;
    /** Add this flat bonus after multiplying (0 = no change). */
    flatBonus: number;
};

// ── Empty defaults ────────────────────────────────────────────────────────────

const EMPTY_PLAYER_ATTACK_DELTA: PlayerAttackEffectDelta = {
    playerHealing: 0,
    enemyBurnApplied: 0,
    enemyBurnDuration: 0,
    playerShieldGranted: 0,
    enemySoakApplied: 0,
    enemySoakDuration: 0,
    playerEnergizeApplied: 0,
    enemyFreezeSoakConvertPercent: 0,
    enemyFreezeSoakConvertDuration: 0,
    enemyThornsApplied: 0,
    enemyThornsDuration: 0,
    playerExhaustEnergyPercent: 0,
    playerSquishyShieldPercent: 0,
    playerConsumeMaxHpReduce: 0,
};

const EMPTY_ENEMY_ATTACK_DELTA: EnemyAttackEffectDelta = {
    enemyHealing: 0,
    playerBurnApplied: 0,
    playerBurnDuration: 0,
    playerShieldGranted: 0,
    playerSoakApplied: 0,
    playerSoakDuration: 0,
    playerFreezeSoakConvertPercent: 0,
    playerFreezeSoakConvertDuration: 0,
    playerThornsApplied: 0,
    playerThornsDuration: 0,
};

// ── Factory ───────────────────────────────────────────────────────────────────

export class EffectFactory {
    /**
     * Resolve pre-hit damage modifications driven by effects on the spell.
     * Call once per cast before the hit loop, then apply to base spell damage.
     *
     * - `rage`     – +X damage per 1 HP missing from the caster
     * - `charge`   – ×(1 + energyCost × X%) multiplier
     * - `hardened` – ×(1 + shield × X%) multiplier
     */
    resolvePreHitDamage(effects: SpellEffectConfig[], context: PreHitContext): PreHitDamageMod {
        let multiplier = 1;
        let flatBonus = 0;

        for (const effect of effects) {
            const amount = Math.max(0, effect.amount ?? 0);

            if (effect.kind === SK.RAGE) {
                // +X damage per 1 HP missing
                const missing = Math.max(0, context.playerMaxHp - context.playerCurrentHp);
                flatBonus += missing * amount;
            } else if (effect.kind === SK.CHARGE) {
                // ×(1 + energyCost × X%) — deals +X% more per energy in cost
                multiplier *= 1 + context.spellEnergyCost * (amount / 100);
            } else if (effect.kind === SK.HARDENED) {
                // ×(1 + shield × X%) — gets +X% attack power per shield
                if (context.playerShield > 0) {
                    multiplier *= 1 + context.playerShield * (amount / 100);
                }
            }
        }

        return { multiplier, flatBonus };
    }

    resolvePlayerAttackEffect(effect: SpellEffectConfig, hitDamage: number): PlayerAttackEffectDelta {
        switch (effect.kind) {
            case SK.HEAL: {
                // Restores X HP
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerHealing: amount }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case SK.BURN: {
                // Applies X BURN stacks on hit
                if (effect.target === "self") return EMPTY_PLAYER_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                const duration = Math.max(1, effect.duration ?? 1);
                return amount > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, enemyBurnApplied: amount, enemyBurnDuration: duration }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case SK.SHIELD: {
                // Absorbs X damage per 1 shield granted
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerShieldGranted: amount }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case SK.LIFESTEAL: {
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                const multiplier = amount > 1 ? amount / 100 : amount;
                const healing = Math.max(0, Math.round(hitDamage * multiplier));
                return healing > 0
                    ? { ...EMPTY_PLAYER_ATTACK_DELTA, playerHealing: healing }
                    : EMPTY_PLAYER_ATTACK_DELTA;
            }
            case SK.SOAK: {
                // Applies X SOAK stacks on hit
                if (effect.target === "self") return EMPTY_PLAYER_ATTACK_DELTA;
                return {
                    ...EMPTY_PLAYER_ATTACK_DELTA,
                    enemySoakApplied: Math.max(1, effect.amount ?? 1),
                    enemySoakDuration: effect.duration ?? 0,
                };
            }
            case SK.ENERGIZE: {
                // Each stack provides +X energy next turn
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                return { ...EMPTY_PLAYER_ATTACK_DELTA, playerEnergizeApplied: Math.max(1, effect.amount ?? 1) };
            }
            case SK.FREEZE: {
                // Transforms X% of target SOAK stacks into ICE (freeze) stacks
                if (effect.target === "self") return EMPTY_PLAYER_ATTACK_DELTA;
                const convertPercent = Math.max(0, effect.amount ?? 100);
                return {
                    ...EMPTY_PLAYER_ATTACK_DELTA,
                    enemyFreezeSoakConvertPercent: convertPercent,
                    enemyFreezeSoakConvertDuration: effect.duration ?? 0,
                };
            }
            case SK.THORNS: {
                // Applies X THORNS stacks on self when used
                if (effect.target !== "self") return EMPTY_PLAYER_ATTACK_DELTA;
                return {
                    ...EMPTY_PLAYER_ATTACK_DELTA,
                    enemyThornsApplied: Math.max(1, effect.amount ?? 1),
                    enemyThornsDuration: effect.duration ?? 0,
                };
            }
            case SK.EXHAUST: {
                // Removes X% of caster's remaining energy when used
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const pct = Math.max(0, effect.amount ?? 0);
                return { ...EMPTY_PLAYER_ATTACK_DELTA, playerExhaustEnergyPercent: pct };
            }
            case SK.SQUISHY: {
                // Removes X% of caster's shield when used
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const pct = Math.max(0, effect.amount ?? 0);
                return { ...EMPTY_PLAYER_ATTACK_DELTA, playerSquishyShieldPercent: pct };
            }
            case SK.CONSUME: {
                // Each use permanently reduces caster's max HP by X
                if (effect.target === "enemy") return EMPTY_PLAYER_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                return { ...EMPTY_PLAYER_ATTACK_DELTA, playerConsumeMaxHpReduce: amount };
            }
            default:
                return EMPTY_PLAYER_ATTACK_DELTA;
        }
    }

    resolveEnemyAttackEffect(effect: SpellEffectConfig, remainingDamage: number): EnemyAttackEffectDelta {
        switch (effect.kind) {
            case SK.HEAL:
                return EMPTY_ENEMY_ATTACK_DELTA;
            case SK.BURN: {
                if (effect.target !== "enemy") return EMPTY_ENEMY_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                const duration = Math.max(1, effect.duration ?? 1);
                return amount > 0
                    ? { ...EMPTY_ENEMY_ATTACK_DELTA, playerBurnApplied: amount, playerBurnDuration: duration }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case SK.SHIELD: {
                if (effect.target !== "enemy") return EMPTY_ENEMY_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                return amount > 0
                    ? { ...EMPTY_ENEMY_ATTACK_DELTA, playerShieldGranted: amount }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case SK.LIFESTEAL: {
                if (effect.target !== "self") return EMPTY_ENEMY_ATTACK_DELTA;
                const amount = Math.max(0, effect.amount ?? 0);
                const multiplier = amount > 1 ? amount / 100 : amount;
                const healing = Math.max(0, Math.round(remainingDamage * multiplier));
                return healing > 0
                    ? { ...EMPTY_ENEMY_ATTACK_DELTA, enemyHealing: healing }
                    : EMPTY_ENEMY_ATTACK_DELTA;
            }
            case SK.SOAK: {
                if (effect.target !== "enemy") return EMPTY_ENEMY_ATTACK_DELTA;
                return {
                    ...EMPTY_ENEMY_ATTACK_DELTA,
                    playerSoakApplied: Math.max(1, effect.amount ?? 1),
                    playerSoakDuration: effect.duration ?? 0,
                };
            }
            case SK.FREEZE: {
                // Transforms X% of target SOAK stacks into ICE (freeze) stacks
                if (effect.target !== "enemy") return EMPTY_ENEMY_ATTACK_DELTA;
                const convertPercent = Math.max(0, effect.amount ?? 100);
                return {
                    ...EMPTY_ENEMY_ATTACK_DELTA,
                    playerFreezeSoakConvertPercent: convertPercent,
                    playerFreezeSoakConvertDuration: effect.duration ?? 0,
                };
            }
            case SK.THORNS: {
                if (effect.target !== "enemy") return EMPTY_ENEMY_ATTACK_DELTA;
                return {
                    ...EMPTY_ENEMY_ATTACK_DELTA,
                    playerThornsApplied: Math.max(1, effect.amount ?? 1),
                    playerThornsDuration: effect.duration ?? 0,
                };
            }
            default:
                return EMPTY_ENEMY_ATTACK_DELTA;
        }
    }
}

export const effectFactory = new EffectFactory();
