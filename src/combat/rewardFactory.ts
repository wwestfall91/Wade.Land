export type RewardApplyContext = {
    applyTypeMultiplier: (type: string, multiplier: number) => void;
    applyShieldMultiplier: (multiplier: number) => void;
    applySoakMultiplier: (multiplier: number) => void;
    applyBurnMultiplier: (multiplier: number) => void;
};

export type MonsterReward = {
    name: string;
    description: string;
    apply: (context: RewardApplyContext) => void;
};

const MASTERY_REWARDS: readonly MonsterReward[] = [
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
    {
        name: "Steel Mastery",
        description: "Steel damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("steel", 1.5),
    },
    {
        name: "Leaf Mastery",
        description: "Leaf damage +50%",
        apply: ({ applyTypeMultiplier }) => applyTypeMultiplier("leaf", 1.5),
    },
];

const STACK_REWARDS: readonly MonsterReward[] = [
    {
        name: "Iron Will",
        description: "Shield gain ×2",
        apply: ({ applyShieldMultiplier }) => applyShieldMultiplier(2),
    },
    {
        name: "Flood Surge",
        description: "Soak stacks ×2",
        apply: ({ applySoakMultiplier }) => applySoakMultiplier(2),
    },
    {
        name: "Wildfire",
        description: "Burn stacks ×2",
        apply: ({ applyBurnMultiplier }) => applyBurnMultiplier(2),
    },
];

const REWARDS: readonly MonsterReward[] = [...MASTERY_REWARDS, ...STACK_REWARDS];

function shuffled<T>(arr: readonly T[]): T[] {
    const pool = [...arr];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

export class RewardFactory {
    /**
     * Returns a reward by exact name, or undefined if not found.
     */
    static getByName(name: string): MonsterReward | undefined {
        return REWARDS.find((r) => r.name === name);
    }

    /**
     * Returns between 1 and 3 random rewards (clamped).
     * Always includes at least one stack-modifier reward (Iron Will / Flood Surge / Wildfire)
     * alongside mastery rewards, so the player always sees the new upgrade types.
     */
    static getRandom(count: number): MonsterReward[] {
        const clamped = Math.max(1, Math.min(3, count));

        // Pick 1 guaranteed stack reward
        const stackPick = shuffled(STACK_REWARDS).slice(0, 1);

        // Fill remaining slots from mastery rewards
        const masteryPicks = shuffled(MASTERY_REWARDS).slice(0, clamped - stackPick.length);

        // Shuffle the final set so the stack reward isn't always last
        return shuffled([...stackPick, ...masteryPicks]);
    }
}
