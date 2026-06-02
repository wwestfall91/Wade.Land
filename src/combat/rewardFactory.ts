export type RewardApplyContext = {
    applyTypeMultiplier: (type: string, multiplier: number) => void;
};

export type MonsterReward = {
    name: string;
    description: string;
    apply: (context: RewardApplyContext) => void;
};

const REWARDS: readonly MonsterReward[] = [
    {
        name: "Water Mastery",
        description: "Water damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("water", 1.5),
    },
    {
        name: "Lightning Mastery",
        description: "Lightning damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("lightning", 1.5),
    },
    {
        name: "Earth Mastery",
        description: "Earth damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("earth", 1.5),
    },
    {
        name: "Air Mastery",
        description: "Air damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("air", 1.5),
    },
    {
        name: "Fire Mastery",
        description: "Fire damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("fire", 1.5),
    },
];

export class RewardFactory {
    /**
     * Returns a reward by exact name, or undefined if not found.
     */
    static getByName(name: string): MonsterReward | undefined {
        return REWARDS.find((r) => r.name === name);
    }

    /**
     * Returns between 1 and 3 random rewards (clamped).
     */
    static getRandom(count: number): MonsterReward[] {
        const clamped = Math.max(1, Math.min(3, count));
        return [...REWARDS]
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(clamped, REWARDS.length));
    }
}
