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

type LevelRow = {
    Level?: number | string;
    level?: number | string;
    HP?: number | string;
    hp?: number | string;
};

export type LevelDefinition = {
    level: number;
    hp: number;
};

export type ElementEnhancements = {
    purified?: boolean;
    polished?: boolean;
    cleansed?: boolean;
    refined?: boolean;
};


export type PlayerElement = {
    id: number;
    letter: string;
    damage: number;
    energy?: number;
    enhancements?: ElementEnhancements;
    level: number;
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

const DEFAULT_PLAYER_STATUSES: PlayerStatuses = {
    burn: null,
    soak: null,
    freeze: null,
    energize: null,
    thorns: null,
    float: null,
    shield: 0,
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
};

const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
    level: 1,
    hp: 0,
    souls: 0,
    elements: [],
};

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

    if (!matchedLevel) {
        return {
            ...DEFAULT_PLAYER_PROGRESS,
            souls,
            elements,
        };
    }

    const effectiveMaxHp = Math.max(1, Math.round(matchedLevel.hp * maxHpMultiplier) - permanentMaxHpReduction);
    const resolvedHp = Math.max(0, Math.min(currentHp ?? effectiveMaxHp, effectiveMaxHp));

    return {
        level: matchedLevel.level,
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
            const matchedLevel = resolveLevelForPlayer(playerLevel, levels);
            const effectiveMaxHp = Math.max(1, Math.round((matchedLevel?.hp ?? 0) * maxHpMultiplier) - permanentMaxHpReduction);
            const startingHp = previousHp ?? effectiveMaxHp;
            return Math.max(0, startingHp - normalizedPower);
        });
    }, [levels, maxHpMultiplier, permanentMaxHpReduction, playerLevel]);

    const healPlayer = useCallback((amount: number) => {
        const normalizedAmount = Math.max(0, amount);
        setCurrentHp((previousHp) => {
            const matchedLevel = resolveLevelForPlayer(playerLevel, levels);
            const effectiveMaxHp = Math.max(1, Math.round((matchedLevel?.hp ?? 0) * maxHpMultiplier) - permanentMaxHpReduction);
            const startingHp = previousHp ?? effectiveMaxHp;
            return Math.min(effectiveMaxHp, startingHp + normalizedAmount);
        });
    }, [levels, maxHpMultiplier, permanentMaxHpReduction, playerLevel]);

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
            discoveredCraftedLetters,
            addDiscoveredCraftedLetter,
        }),
        [
            addSouls,
            spendSouls,
            applyEnemyAttack,
            combineElements,
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
            discoveredCraftedLetters,
            addDiscoveredCraftedLetter,
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
