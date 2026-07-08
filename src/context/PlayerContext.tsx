import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as XLSX from "xlsx";
import type { SpellEffectConfig } from "../combat/spellEffects";
import type { ActiveBurnStatus, ActiveSoakStatus, ActiveFreezeStatus, ActiveEnergizeStatus, ActiveThornsStatus, ActiveFloatStatus } from "../combat/spellEffects";
import { mergeLevelUpEffect } from "../combat/effectMerging";

type LevelRow = {
    Level?: number | string;
    level?: number | string;
    HP?: number | string;
    hp?: number | string;
    Uses?: number | string;
    uses?: number | string;
};

export type LevelDefinition = {
    level: number;
    hp: number;
    usesRequired: number;
};

export type ElementEnhancements = {
    incubated?: boolean;
    divided?: boolean;
    mixed?: boolean;
    refined?: boolean;
};


export type PlayerElement = {
    id: number;
    letter: string;
    damage: number;
    shield?: number;
    energy?: number;
    enhancements?: ElementEnhancements;
    rank: number;
    level: number;
    uses?: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
    initialPosition?: { x: number; y: number };
};

export type PlayerProgress = {
    level: number;
    hp: number;
    souls: number;
    elements: PlayerElement[];
};

export type RewardElement = Omit<PlayerElement, "id">;

export type SelectedEnemy = {
    name: string;
    hp: number;
    power: number;
    souls: number;
    description: string;
    sprite: string;
    weaknesses: string[];
    elements: RewardElement[];
    resistances?: Partial<Record<string, number>>;
};

export type PlayerStatuses = {
    burn: ActiveBurnStatus | null;
    soak: ActiveSoakStatus | null;
    freeze: ActiveFreezeStatus | null;
    energize: ActiveEnergizeStatus | null;
    thorns: ActiveThornsStatus | null;
    float: ActiveFloatStatus | null;
    shield: number;
};

export type CombinationModeKey = "water" | "fire" | "earth" | "air" | "soul";

export type ElementalResistanceKey = "fire" | "water" | "earth" | "air";

export type ElementalResistances = Record<ElementalResistanceKey, number>;

const DEFAULT_PLAYER_STATUSES: PlayerStatuses = {
    burn: null,
    soak: null,
    freeze: null,
    energize: null,
    thorns: null,
    float: null,
    shield: 0,
};

const DEFAULT_ELEMENTAL_RESISTANCES: ElementalResistances = {
    fire: 0,
    water: 0,
    earth: 0,
    air: 0,
};

type PlayerContextValue = {
    player: PlayerProgress;
    playerName: string;
    levels: LevelDefinition[];
    setPlayerName: (name: string) => void;
    addSouls: (souls: number) => void;
    spendSouls: (amount: number) => void;
    initializeElements: (elements: PlayerElement[]) => void;
    combineElements: (consumedIds: number[], newElement: PlayerElement) => void;
    combineElementsMultiple: (consumedIds: number[], newElements: PlayerElement[]) => void;
    consumeElements: (consumedIds: number[]) => void;
    updateElementEffects: (elementId: number, effects?: SpellEffectConfig[]) => void;
    applyEnemyAttack: (power: number) => void;
    healPlayer: (amount: number) => void;
    resetGame: () => void;
    addElement: (element: RewardElement) => void;
    discoveredCraftedLetters: Set<string>;
    addDiscoveredCraftedLetter: (letter: string) => void;
    selectedEnemy: SelectedEnemy | null;
    setSelectedEnemy: (enemy: SelectedEnemy | null) => void;
    typeMultipliers: Record<string, number>;
    applyTypeMultiplier: (type: string, multiplier: number) => void;
    monsterSoulsFed: number;
    setMonsterSoulsFed: (amount: number) => void;
    playerStatuses: PlayerStatuses;
    setPlayerStatuses: (statuses: PlayerStatuses) => void;
    maxHpMultiplier: number;
    /** Permanently reduces the player's effective max HP by this flat amount (from consume effects). */
    permanentMaxHpReduction: number;
    decreaseMaxHp: (amount: number) => void;
    shieldMultiplier: number;
    applyShieldMultiplier: (multiplier: number) => void;
    soakMultiplier: number;
    applySoakMultiplier: (multiplier: number) => void;
    burnMultiplier: number;
    applyBurnMultiplier: (multiplier: number) => void;
    battleEnergyCarryover: number;
    setBattleEnergyCarryover: (amount: number) => void;
    sealedCombinationModes: Set<CombinationModeKey>;
    sealCombinationMode: (mode: CombinationModeKey) => void;
    unsealCombinationMode: (mode: CombinationModeKey) => void;
    recordElementUses: (counts: Record<number, number>) => void;
    upgradeElement: (elementId: number, newLevel: number, effect: SpellEffectConfig) => void;
    spellSlots: (number | null)[];
    setSpellSlotElement: (slotIndex: number, elementId: number | null) => void;
    addSpellSlot: () => void;
    elementalResistances: ElementalResistances;
    setElementalResistance: (element: ElementalResistanceKey, percent: number) => void;
};

const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
    level: 1,
    hp: 0,
    souls: 0,
    elements: [],
};

const PLAYER_BASE_HP = 100;

const PLAYER_NAME_COOKIE = "wade_player_name";

const readCookie = (cookieName: string): string => {
    if (typeof document === "undefined") {
        return "";
    }

    const cookie = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${cookieName}=`));

    if (!cookie) {
        return "";
    }

    const rawValue = cookie.slice(cookieName.length + 1);
    return decodeURIComponent(rawValue);
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const resolveLevelForPlayer = (
    playerLevel: number,
    levels: LevelDefinition[],
): LevelDefinition | null => {
    if (levels.length === 0) {
        return null;
    }

    return levels.find((level) => level.level === playerLevel) ?? levels[0];
};

const resolvePlayerProgress = (
    souls: number,
    playerLevel: number,
    levels: LevelDefinition[],
    elements: PlayerElement[],
    currentHp: number | null,
    maxHpMultiplier: number,
    permanentMaxHpReduction: number,
): PlayerProgress => {
    const matchedLevel = resolveLevelForPlayer(playerLevel, levels);

    const effectiveMaxHp = Math.max(1, Math.round(PLAYER_BASE_HP * maxHpMultiplier) - permanentMaxHpReduction);
    const resolvedHp = Math.max(0, Math.min(currentHp ?? effectiveMaxHp, effectiveMaxHp));

    return {
        level: matchedLevel?.level ?? playerLevel,
        hp: resolvedHp,
        souls,
        elements,
    };
};

type PlayerProviderProps = {
    children: ReactNode;
};

export function PlayerProvider({ children }: PlayerProviderProps) {
    const [souls, setSouls] = useState(0);
    const [playerLevel] = useState(1);
    const [levels, setLevels] = useState<LevelDefinition[]>([]);
    const [elements, setElements] = useState<PlayerElement[]>([]);
    const [currentHp, setCurrentHp] = useState<number | null>(null);
    const [playerName, setPlayerNameState] = useState(() => readCookie(PLAYER_NAME_COOKIE));
    const [selectedEnemy, setSelectedEnemy] = useState<SelectedEnemy | null>(null);
    const [typeMultipliers, setTypeMultipliers] = useState<Record<string, number>>({});
    const [monsterSoulsFed, setMonsterSoulsFed] = useState(0);
    const [playerStatuses, setPlayerStatuses] = useState<PlayerStatuses>(DEFAULT_PLAYER_STATUSES);
    const [maxHpMultiplier, setMaxHpMultiplier] = useState(1);
    const [shieldMultiplier, setShieldMultiplier] = useState(1);
    const [discoveredCraftedLetters, setDiscoveredCraftedLetters] = useState<Set<string>>(new Set());
    const [soakMultiplier, setSoakMultiplier] = useState(1);
    const [burnMultiplier, setBurnMultiplier] = useState(1);
    const [battleEnergyCarryover, setBattleEnergyCarryoverState] = useState(0);
    const [permanentMaxHpReduction, setPermanentMaxHpReduction] = useState(0);
    const [sealedCombinationModes, setSealedCombinationModes] = useState<Set<CombinationModeKey>>(new Set());
    const [spellSlots, setSpellSlots] = useState<(number | null)[]>([null, null, null]);
    const [elementalResistances, setElementalResistances] = useState<ElementalResistances>(DEFAULT_ELEMENTAL_RESISTANCES);

    useEffect(() => {
        fetch("/levels.xlsx")
            .then((res) => res.arrayBuffer())
            .then((buffer) => {
                const wb = XLSX.read(buffer, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<LevelRow>(ws);
                const parsed: LevelDefinition[] = rows
                    .map((row) => ({
                        level: Number(row.Level ?? row.level ?? 0) || 0,
                        hp: Number(row.HP ?? row.hp ?? 0) || 0,
                        usesRequired: Number(row.Uses ?? row.uses ?? 0) || 0,
                    }))
                    .filter((level) => level.level > 0)
                    .sort((left, right) => left.level - right.level);
                setLevels(parsed);
            });
    }, []);

    const player = useMemo(
        () => resolvePlayerProgress(souls, playerLevel, levels, elements, currentHp, maxHpMultiplier, permanentMaxHpReduction),
        [currentHp, elements, levels, maxHpMultiplier, permanentMaxHpReduction, playerLevel, souls],
    );

    const addSouls = useCallback((amount: number) => {
        const normalizedAmount = Math.max(0, amount);
        setSouls((previous) => previous + normalizedAmount);
    }, []);

    const spendSouls = useCallback((amount: number) => {
        setSouls((previous) => Math.max(0, previous - amount));
    }, []);

    const setPlayerName = useCallback((name: string) => {
        const trimmedName = name.trim().slice(0, 28);
        setPlayerNameState(trimmedName);

        if (typeof document === "undefined") {
            return;
        }

        if (trimmedName.length === 0) {
            document.cookie = `${PLAYER_NAME_COOKIE}=; path=/; max-age=0`;
            return;
        }

        document.cookie = `${PLAYER_NAME_COOKIE}=${encodeURIComponent(trimmedName)}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const initializeElements = useCallback((nextElements: PlayerElement[]) => {
        setElements((previous) => (previous.length > 0 ? previous : nextElements));
    }, []);

    const combineElements = useCallback((consumedIds: number[], newElement: PlayerElement) => {
        setElements((previous) => [
            ...previous.filter((element) => !consumedIds.includes(element.id)),
            newElement,
        ]);
    }, []);

    const combineElementsMultiple = useCallback((consumedIds: number[], newElements: PlayerElement[]) => {
        setElements((previous) => [
            ...previous.filter((element) => !consumedIds.includes(element.id)),
            ...newElements,
        ]);
    }, []);

    const consumeElements = useCallback((consumedIds: number[]) => {
        if (consumedIds.length === 0) {
            return;
        }

        setElements((previous) => previous.filter((element) => !consumedIds.includes(element.id)));
    }, []);

    const updateElementEffects = useCallback((elementId: number, effects?: SpellEffectConfig[]) => {
        setElements((previous) =>
            previous.map((element) =>
                element.id === elementId
                    ? {
                        ...element,
                        effects,
                    }
                    : element,
            ),
        );
    }, []);

    const applyEnemyAttack = useCallback((power: number) => {
        const normalizedPower = Math.max(0, power);
        setCurrentHp((previousHp) => {
            const effectiveMaxHp = Math.max(1, Math.round(PLAYER_BASE_HP * maxHpMultiplier) - permanentMaxHpReduction);
            const startingHp = previousHp ?? effectiveMaxHp;
            return Math.max(0, startingHp - normalizedPower);
        });
    }, [maxHpMultiplier, permanentMaxHpReduction]);

    const healPlayer = useCallback((amount: number) => {
        const normalizedAmount = Math.max(0, amount);
        setCurrentHp((previousHp) => {
            const effectiveMaxHp = Math.max(1, Math.round(PLAYER_BASE_HP * maxHpMultiplier) - permanentMaxHpReduction);
            const startingHp = previousHp ?? effectiveMaxHp;
            return Math.min(effectiveMaxHp, startingHp + normalizedAmount);
        });
    }, [maxHpMultiplier, permanentMaxHpReduction]);

    const decreaseMaxHp = useCallback((amount: number) => {
        setPermanentMaxHpReduction((previous) => previous + Math.max(0, amount));
    }, []);

    const applyTypeMultiplier = useCallback((type: string, multiplier: number) => {
        const normalized = type.trim().toLowerCase();
        setTypeMultipliers((previous) => ({
            ...previous,
            [normalized]: (previous[normalized] ?? 1) + (multiplier - 1),
        }));
    }, []);

    const applyShieldMultiplier = useCallback((multiplier: number) => {
        setShieldMultiplier((previous) => previous + (multiplier - 1));
    }, []);

    const applySoakMultiplier = useCallback((multiplier: number) => {
        setSoakMultiplier((previous) => previous + (multiplier - 1));
    }, []);

    const applyBurnMultiplier = useCallback((multiplier: number) => {
        setBurnMultiplier((previous) => previous + (multiplier - 1));
    }, []);

    const setBattleEnergyCarryover = useCallback((amount: number) => {
        setBattleEnergyCarryoverState(Math.max(0, Math.floor(amount)));
    }, []);

    const sealCombinationMode = useCallback((mode: CombinationModeKey) => {
        setSealedCombinationModes((previous) => {
            if (previous.has(mode)) {
                return previous;
            }

            const next = new Set(previous);
            next.add(mode);
            return next;
        });
    }, []);

    const unsealCombinationMode = useCallback((mode: CombinationModeKey) => {
        setSealedCombinationModes((previous) => {
            if (!previous.has(mode)) {
                return previous;
            }

            const next = new Set(previous);
            next.delete(mode);
            return next;
        });
    }, []);

    const resetGame = useCallback(() => {
        setSouls(0);
        setElements([]);
        setCurrentHp(null);
        setSelectedEnemy(null);
        setTypeMultipliers({});
        setMonsterSoulsFed(0);
        setPlayerStatuses(DEFAULT_PLAYER_STATUSES);
        setMaxHpMultiplier(1);
        setShieldMultiplier(1);
        setSoakMultiplier(1);
        setBurnMultiplier(1);
        setBattleEnergyCarryoverState(0);
        setPermanentMaxHpReduction(0);
        setDiscoveredCraftedLetters(new Set());
        setSealedCombinationModes(new Set());
        setElementalResistances(DEFAULT_ELEMENTAL_RESISTANCES);
    }, []);

    const addDiscoveredCraftedLetter = useCallback((letter: string) => {
        setDiscoveredCraftedLetters((previous) => {
            if (previous.has(letter)) return previous;
            const next = new Set(previous);
            next.add(letter);
            return next;
        });
    }, []);

    const addElement = useCallback((element: RewardElement) => {
        setElements((previous) => {
            const maxId = previous.reduce((max, e) => Math.max(max, e.id), 0);
            return [...previous, { ...element, id: maxId + 1 }];
        });
    }, []);

    const recordElementUses = useCallback((counts: Record<number, number>) => {
        setElements((previous) =>
            previous.map((element) => {
                const gained = counts[element.id] ?? 0;
                if (gained <= 0) return element;
                return { ...element, uses: (element.uses ?? 0) + gained };
            }),
        );
    }, []);

    const upgradeElement = useCallback((elementId: number, newLevel: number, effect: SpellEffectConfig) => {
        setElements((previous) =>
            previous.map((element) =>
                element.id === elementId
                    ? {
                        ...element,
                        level: newLevel,
                        effects: mergeLevelUpEffect(element.effects, effect).effects,
                    }
                    : element,
            ),
        );
    }, []);

    const setSpellSlotElement = useCallback((slotIndex: number, elementId: number | null) => {
        setSpellSlots((previous) => {
            const updated = [...previous];
            updated[slotIndex] = elementId;
            return updated;
        });
    }, []);

    const addSpellSlot = useCallback(() => {
        setSpellSlots((previous) => [...previous, null]);
    }, []);

    const setElementalResistance = useCallback((element: ElementalResistanceKey, percent: number) => {
        setElementalResistances((previous) => {
            const nextValue = Number.isFinite(percent) ? percent : previous[element];
            if (previous[element] === nextValue) {
                return previous;
            }

            return {
                ...previous,
                [element]: nextValue,
            };
        });
    }, []);

    const contextValue = useMemo(
        () => ({
            player,
            playerName,
            levels,
            setPlayerName,
            addSouls,
            spendSouls,
            initializeElements,
            combineElements,
            combineElementsMultiple,
            consumeElements,
            updateElementEffects,
            applyEnemyAttack,
            healPlayer,
            resetGame,
            addElement,
            selectedEnemy,
            setSelectedEnemy,
            typeMultipliers,
            applyTypeMultiplier,
            monsterSoulsFed,
            setMonsterSoulsFed,
            playerStatuses,
            setPlayerStatuses,
            maxHpMultiplier,
            permanentMaxHpReduction,
            decreaseMaxHp,
            shieldMultiplier,
            applyShieldMultiplier,
            soakMultiplier,
            applySoakMultiplier,
            burnMultiplier,
            applyBurnMultiplier,
            battleEnergyCarryover,
            setBattleEnergyCarryover,
            sealedCombinationModes,
            sealCombinationMode,
            unsealCombinationMode,
            discoveredCraftedLetters,
            addDiscoveredCraftedLetter,
            recordElementUses,
            upgradeElement,
            spellSlots,
            setSpellSlotElement,
            addSpellSlot,
            elementalResistances,
            setElementalResistance,
        }),
        [
            addSouls,
            spendSouls,
            applyEnemyAttack,
            combineElements,
            combineElementsMultiple,
            consumeElements,
            updateElementEffects,
            initializeElements,
            levels,
            playerName,
            player,
            healPlayer,
            resetGame,
            addElement,
            selectedEnemy,
            setPlayerName,
            typeMultipliers,
            applyTypeMultiplier,
            monsterSoulsFed,
            setMonsterSoulsFed,
            playerStatuses,
            setPlayerStatuses,
            maxHpMultiplier,
            permanentMaxHpReduction,
            decreaseMaxHp,
            shieldMultiplier,
            applyShieldMultiplier,
            soakMultiplier,
            applySoakMultiplier,
            burnMultiplier,
            applyBurnMultiplier,
            battleEnergyCarryover,
            setBattleEnergyCarryover,
            sealedCombinationModes,
            sealCombinationMode,
            unsealCombinationMode,
            discoveredCraftedLetters,
            addDiscoveredCraftedLetter,
            recordElementUses,
            upgradeElement,
            spellSlots,
            setSpellSlotElement,
            addSpellSlot,
            elementalResistances,
            setElementalResistance,
        ],
    );

    return <PlayerContext.Provider value={contextValue}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
    const context = useContext(PlayerContext);

    if (!context) {
        throw new Error("usePlayer must be used within a PlayerProvider.");
    }

    return context;
}
