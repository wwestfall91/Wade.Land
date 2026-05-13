import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as XLSX from "xlsx";

type LevelRow = {
    Level?: number | string;
    level?: number | string;
    HP?: number | string;
    hp?: number | string;
    Experience?: number | string;
    experience?: number | string;
};

export type LevelDefinition = {
    level: number;
    hp: number;
    experience: number;
};

export type PlayerElement = {
    id: number;
    letter: string;
    damage: number;
    level: number;
    description: string;
};

export type PlayerProgress = {
    level: number;
    hp: number;
    experience: number;
    elements: PlayerElement[];
};

export type SelectedEnemy = {
    name: string;
    hp: number;
    experience: number;
    description: string;
};

type PlayerContextValue = {
    player: PlayerProgress;
    levelFillPercent: number;
    levels: LevelDefinition[];
    setExperience: (experience: number) => void;
    addExperience: (experience: number) => void;
    initializeElements: (elements: PlayerElement[]) => void;
    combineElements: (consumedIds: number[], newElement: PlayerElement) => void;
    selectedEnemy: SelectedEnemy | null;
    setSelectedEnemy: (enemy: SelectedEnemy | null) => void;
};

const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
    level: 1,
    hp: 0,
    experience: 0,
    elements: [],
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const resolvePlayerProgress = (
    experience: number,
    levels: LevelDefinition[],
    elements: PlayerElement[],
): PlayerProgress => {
    if (levels.length === 0) {
        return {
            ...DEFAULT_PLAYER_PROGRESS,
            experience,
            elements,
        };
    }

    const matchedLevel = levels.reduce(
        (current, level) => (experience >= level.experience ? level : current),
        levels[0],
    );

    return {
        level: matchedLevel.level,
        hp: matchedLevel.hp,
        experience,
        elements,
    };
};

const resolveLevelFillPercent = (
    player: PlayerProgress,
    levels: LevelDefinition[],
): number => {
    if (levels.length === 0) {
        return 0;
    }

    const currentLevel = levels.find((level) => level.level === player.level) ?? levels[0];
    const nextLevel = levels.find((level) => level.level > player.level);

    if (!nextLevel) {
        return 100;
    }

    const requiredExperience = nextLevel.experience - currentLevel.experience;
    if (requiredExperience <= 0) {
        return 100;
    }

    const gainedExperience = player.experience - currentLevel.experience;
    const normalizedProgress = Math.max(0, Math.min(1, gainedExperience / requiredExperience));

    return Math.round(normalizedProgress * 100);
};

type PlayerProviderProps = {
    children: ReactNode;
};

export function PlayerProvider({ children }: PlayerProviderProps) {
    const [experience, setExperience] = useState(0);
    const [levels, setLevels] = useState<LevelDefinition[]>([]);
    const [elements, setElements] = useState<PlayerElement[]>([]);
    const [selectedEnemy, setSelectedEnemy] = useState<SelectedEnemy | null>(null);

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
                        experience: Number(row.Experience ?? row.experience ?? 0) || 0,
                    }))
                    .filter((level) => level.level > 0)
                    .sort((left, right) => left.level - right.level);
                setLevels(parsed);
            });
    }, []);

    const player = useMemo(
        () => resolvePlayerProgress(experience, levels, elements),
        [elements, experience, levels],
    );

    const levelFillPercent = useMemo(
        () => resolveLevelFillPercent(player, levels),
        [levels, player],
    );

    const addExperience = useCallback((amount: number) => {
        setExperience((previous) => previous + amount);
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

    const contextValue = useMemo(
        () => ({
            player,
            levelFillPercent,
            levels,
            setExperience,
            addExperience,
            initializeElements,
            combineElements,
            selectedEnemy,
            setSelectedEnemy,
        }),
        [addExperience, combineElements, initializeElements, levelFillPercent, levels, player, selectedEnemy],
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
