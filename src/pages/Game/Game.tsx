import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { useNavigate, useLocation } from "react-router";
import "./Game.scss";

// TODO: Add enemy to Game Scene
// TODO: Give player HP
// TODO: Add enemy attacks

type RestoredSpell = {
    id: number;
    letter: string;
    damage: number;
};

type GameLocationState = {
    restoredSpells?: RestoredSpell[];
    playerExperience?: number;
};

type Position = {
    x: number;
    y: number;
};

type DraggableItem = {
    id: number;
    letter: string;
    damage: number;
    initialPosition: Position;
};

type CombinationRecipe = {
    element1: string;
    element2: string;
    result: string;
    damage: number;
};

type ElementRow = {
    name?: string;
    Name?: string;
    ["Element 1"]?: string;
    ["Element 2"]?: string;
    damage?: number | string;
    Damage?: number | string;
};

type EnemyRow = {
    Name?: string;
    name?: string;
    HP?: number | string;
    hp?: number | string;
    Experience?: number | string;
    experience?: number | string;
};

type LevelRow = {
    Level?: number | string;
    level?: number | string;
    HP?: number | string;
    hp?: number | string;
    Experience?: number | string;
    experience?: number | string;
};

type Enemy = {
    name: string;
    hp: number;
    experience: number;
};

type LevelDefinition = {
    level: number;
    hp: number;
    experience: number;
};

type PlayerProgress = {
    level: number;
    hp: number;
    experience: number;
};

const SPREAD_X = 200;
const SPREAD_Y = 150;
const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
    level: 1,
    hp: 0,
    experience: 0,
};

const resolvePlayerProgress = (
    experience: number,
    levels: LevelDefinition[],
): PlayerProgress => {
    if (levels.length === 0) {
        return {
            ...DEFAULT_PLAYER_PROGRESS,
            experience,
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
    };
};

function Game() {
    const navigate = useNavigate();
    const location = useLocation();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const elementStartRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefs = [dropZoneRefA, dropZoneRefB];

    const routeState = location.state as GameLocationState | null;
    const restoredSpells = routeState?.restoredSpells;

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [levels, setLevels] = useState<LevelDefinition[]>([]);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const nextId = useRef(
        restoredSpells && restoredSpells.length > 0
            ? Math.max(...restoredSpells.map((s) => s.id)) + 1
            : 1
    );

    const playerProgress = useMemo(
        () => resolvePlayerProgress(routeState?.playerExperience ?? 0, levels),
        [levels, routeState?.playerExperience],
    );

    const levelFillPercent = useMemo(() => {
        if (levels.length === 0) {
            return 0;
        }

        const currentLevel =
            levels.find((level) => level.level === playerProgress.level) ?? levels[0];
        const nextLevel = levels.find((level) => level.level > playerProgress.level);

        if (!nextLevel) {
            return 100;
        }

        const requiredExperience = nextLevel.experience - currentLevel.experience;
        if (requiredExperience <= 0) {
            return 100;
        }

        const gainedExperience = playerProgress.experience - currentLevel.experience;
        const normalizedProgress = Math.max(0, Math.min(1, gainedExperience / requiredExperience));

        return Math.round(normalizedProgress * 100);
    }, [levels, playerProgress.experience, playerProgress.level]);

    const playerStatsStyle = useMemo(
        () => ({ "--xp-fill": `${levelFillPercent}%` }) as CSSProperties,
        [levelFillPercent],
    );

    const getSpawnPosition = (index: number): Position => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const startRect = elementStartRef.current?.getBoundingClientRect();

        if (!containerRect || !startRect) {
            return {
                x: (index % 3) * SPREAD_X,
                y: Math.floor(index / 3) * SPREAD_Y,
            };
        }

        const step = 44;
        const padding = 10;
        const columns = Math.max(1, Math.floor((startRect.width - padding * 2) / step));

        return {
            x: startRect.left - containerRect.left + padding + (index % columns) * step,
            y: startRect.top - containerRect.top + padding + Math.floor(index / columns) * step,
        };
    };

    useEffect(() => {
        const loadRecipesAndEnemies = (buffer: ArrayBuffer) => {
            const wb = XLSX.read(buffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<ElementRow>(ws);

            const parsedRows = rows
                .map((row) => ({
                    name: (row.name ?? row.Name ?? "").trim(),
                    element1: (row["Element 1"] ?? "").trim(),
                    element2: (row["Element 2"] ?? "").trim(),
                    damage: Number(row.damage ?? row.Damage ?? 0) || 0,
                }))
                .filter((row) => row.name.length > 0);

            const combinationRecipes = parsedRows
                .filter((row) => row.element1.length > 0 && row.element2.length > 0)
                .map((row) => ({
                    element1: row.element1,
                    element2: row.element2,
                    result: row.name,
                    damage: row.damage,
                }));

            setRecipes(combinationRecipes);

            if (restoredSpells && restoredSpells.length > 0) {
                const restoredItems: DraggableItem[] = restoredSpells.map((spell, index) => ({
                    ...spell,
                    initialPosition: getSpawnPosition(index),
                }));
                setDraggables(restoredItems);
                return;
            }

            if (!restoredSpells || restoredSpells.length === 0) {
                const baseElements = parsedRows.filter(
                    (row) => row.element1.length === 0 && row.element2.length === 0,
                );
                const items: DraggableItem[] = baseElements.map((row, index) => ({
                    id: nextId.current++,
                    letter: row.name,
                    damage: row.damage,
                    initialPosition: getSpawnPosition(index),
                }));
                setDraggables(items);
            }
        };

        fetch("/elements.xlsx")
            .then((res) => res.arrayBuffer())
            .then(loadRecipesAndEnemies);

        fetch("/enemies.xlsx")
            .then((res) => res.arrayBuffer())
            .then((buffer) => {
                const wb = XLSX.read(buffer, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<EnemyRow>(ws);
                const parsed: Enemy[] = rows
                    .map((row) => ({
                        name: ((row.Name ?? row.name ?? "") as string).trim(),
                        hp: Number(row.HP ?? row.hp ?? 0) || 0,
                        experience: Number(row.Experience ?? row.experience ?? 0) || 0,
                    }))
                    .filter((e) => e.name.length > 0);
                setEnemies(parsed);
            });

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

    const canCombine = zoneOccupants.every((occupantId) => occupantId !== null);

    const handleSnapChange = (draggableId: number, zoneIndex: number | null) => {
        setZoneOccupants((previous) => {
            const next = previous.map((occupantId) =>
                occupantId === draggableId ? null : occupantId,
            );

            if (zoneIndex !== null) {
                next[zoneIndex] = draggableId;
            }

            return next;
        });
    };

    const canSnapToZone = (draggableId: number, zoneIndex: number) => {
        const occupantId = zoneOccupants[zoneIndex];
        return occupantId === null || occupantId === draggableId;
    };

    const handleCombine = () => {
        if (!canCombine) {
            return;
        }

        const consumedIds = zoneOccupants.filter((occupantId): occupantId is number => occupantId !== null);
        const occupantItems = zoneOccupants.map((occupantId) =>
            draggables.find((draggable) => draggable.id === occupantId),
        );
        const occupantLetters = occupantItems.map((item) => item?.letter ?? "");
        const occupantDamage = occupantItems.reduce((total, item) => total + (item?.damage ?? 0), 0);
        const [leftElement, rightElement] = occupantLetters;

        const matchingRecipe = recipes.find(
            (recipe) =>
                (recipe.element1 === leftElement && recipe.element2 === rightElement) ||
                (recipe.element1 === rightElement && recipe.element2 === leftElement),
        );

        const combinedLetter = matchingRecipe ? matchingRecipe.result : occupantLetters.join("");
        const combinedDamage = matchingRecipe ? matchingRecipe.damage : occupantDamage;

        if (consumedIds.length !== dropZoneRefs.length || combinedLetter.length === 0) {
            return;
        }

        const containerRect = gameRef.current?.getBoundingClientRect();
        const outputRect = outputRef.current?.getBoundingClientRect();
        if (!containerRect || !outputRect) {
            return;
        }

        const sampleDragRect = gameRef.current?.querySelector(".draggable")?.getBoundingClientRect();
        const dragWidth = sampleDragRect?.width ?? 32;
        const dragHeight = sampleDragRect?.height ?? 32;

        const newDraggable: DraggableItem = {
            id: nextId.current,
            letter: combinedLetter,
            damage: combinedDamage,
            initialPosition: {
                x: outputRect.left - containerRect.left + (outputRect.width - dragWidth) / 2,
                y: outputRect.top - containerRect.top + (outputRect.height - dragHeight) / 2,
            },
        };

        nextId.current += 1;

        setDraggables((previous) => [
            ...previous.filter((draggable) => !consumedIds.includes(draggable.id)),
            newDraggable,
        ]);
        setZoneOccupants([null, null]);
    };

    const handleFight = () => {
        const enemy = enemies.length > 0
            ? enemies[Math.floor(Math.random() * enemies.length)]
            : { name: "Unknown", hp: 0 };
        navigate("/fight", {
            state: {
                enemy,
                player: playerProgress,
                spells: draggables.map((draggable) => ({
                    id: draggable.id,
                    letter: draggable.letter,
                    damage: draggable.damage,
                })),
            },
        });
    };

    return (
        <div id="Game" ref={gameRef} style={{ position: "relative", width: "100%", height: "100%" }} >
            {draggables.map((draggable) => (
                <Draggable
                    key={draggable.id}
                    id={draggable.id}
                    letter={draggable.letter}
                    containerRef={gameRef}
                    dropZoneRefs={dropZoneRefs}
                    initialPosition={draggable.initialPosition}
                    onSnapChange={handleSnapChange}
                    canSnapToZone={canSnapToZone}
                />
            ))}

            <div className="element-start" ref={elementStartRef}></div>
            <div className="combination-station">
                <div className="combination-equation">
                    <div className="drop-zone-area">
                        <div className="drop-zone" ref={dropZoneRefA} />
                        <div>+</div>
                        <div className="drop-zone" ref={dropZoneRefB} />
                        <div>=</div>
                    </div>
                    <div className="output" ref={outputRef} />
                </div>

                <button className="combine-button" disabled={!canCombine} onClick={handleCombine}>
                    COMBINE!
                </button>
                <button className="fight-button" onClick={handleFight}>
                    FIGHT!
                </button>
                <div className="player-stats" style={playerStatsStyle}>
                    <div>Level {playerProgress.level}</div>
                    <div>{playerProgress.hp} HP</div>
                    <div>{playerProgress.experience} XP</div>
                </div>
            </div>
        </div>
    );
}

export default Game;