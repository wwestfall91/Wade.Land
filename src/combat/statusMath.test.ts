import { describe, expect, it } from "vitest";
import {
    BURN_FIRE_BONUS_PERCENT_PER_STACK,
    FREEZE_FIRE_BONUS_PER_STACK,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
    getBurnFireBonus,
    getBurnFireBonusPercent,
    getFreezeFireBonus,
    getSoakFirePenalty,
    getSoakLightningBonus,
} from "./statusMath";

describe("statusMath", () => {
    it("burn increases fire damage by stack percent", () => {
        expect(getBurnFireBonusPercent(0)).toBe(0);
        expect(getBurnFireBonusPercent(1)).toBe(BURN_FIRE_BONUS_PERCENT_PER_STACK);
        expect(getBurnFireBonusPercent(3)).toBe(3 * BURN_FIRE_BONUS_PERCENT_PER_STACK);
        expect(getBurnFireBonusPercent(-2)).toBe(0);
        expect(getBurnFireBonus(10, 10)).toBe(5);
        expect(getBurnFireBonus(10, 100)).toBe(50);
        expect(getBurnFireBonus(-2, 100)).toBe(0);
    });

    it("soak modifies lightning and fire damage", () => {
        expect(getSoakLightningBonus(2)).toBe(2 * SOAK_LIGHTNING_BONUS_PER_STACK);
        expect(getSoakFirePenalty(2)).toBe(2 * SOAK_FIRE_PENALTY_PER_STACK);
        expect(getSoakLightningBonus(0)).toBe(0);
        expect(getSoakFirePenalty(0)).toBe(0);
    });

    it("freeze grants fire bonus damage", () => {
        expect(getFreezeFireBonus(1)).toBe(FREEZE_FIRE_BONUS_PER_STACK);
        expect(getFreezeFireBonus(4)).toBe(4 * FREEZE_FIRE_BONUS_PER_STACK);
        expect(getFreezeFireBonus(-1)).toBe(0);
    });
});
