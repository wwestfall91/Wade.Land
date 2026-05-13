import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import { usePlayer } from "../../context/PlayerContext";
import "./Game.scss";

// TODO: Add enemy to Game Scene
// TODO: Give player HP
// TODO: Add enemy attacks

type Position = {
    x: number;
    y: number;
};

type DraggableItem = {
    id: number;
    letter: string;
    damage: number;
    level: number;
    description: string;
    initialPosition: Position;
};

type CombinationRecipe = {
    element1: string;
    element2: string;
    result: string;
    damage: number;
    level: number;
    description: string;
};

type ElementRow = {
    name?: string;
    Name?: string;
    ["Element 1"]?: string;
    ["Element 2"]?: string;
    damage?: number | string;
    Damage?: number | string;
    Level?: number | string;
    level?: number | string;
    Description?: string;
    description?: string;
};

type EnemyRow = {
    Name?: string;
    name?: string;
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

const SPREAD_X = 200;
const SPREAD_Y = 150;

function Game() {
    const navigate = useNavigate();
    const {
        player: playerProgress,
        levelFillPercent,
        initializeElements,
        combineElements,
    } = usePlayer();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const elementStartRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefs = [dropZoneRefA, dropZoneRefB];

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const nextId = useRef(1);

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
                    level:
                        Number(row.Level ?? row.level ?? 0) ||
                        ((row["Element 1"] ?? "").trim().length === 0 ? 1 : 2),
                    description: (row.Description ?? row.description ?? "").trim(),
                }))
                .filter((row) => row.name.length > 0);

            const combinationRecipes = parsedRows
                .filter((row) => row.element1.length > 0 && row.element2.length > 0)
                .map((row) => ({
                    element1: row.element1,
                    element2: row.element2,
                    result: row.name,
                    damage: row.damage,
                    level: row.level,
                    description: row.description,
                }));

            setRecipes(combinationRecipes);
            if (playerProgress.elements.length === 0) {
                const baseElements = parsedRows.filter(
                    (row) => row.element1.length === 0 && row.element2.length === 0,
                );
                const items = baseElements.map((row, index) => ({
                    id: nextId.current++,
                    letter: row.name,
                    damage: row.damage,
                    level: row.level,
                    description: row.description,
                }));
                initializeElements(items);
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

    }, [initializeElements, playerProgress.elements.length]);

    useEffect(() => {
        setDraggables((previous) => {
            const previousById = new Map(previous.map((item) => [item.id, item]));

            return playerProgress.elements.map((element, index) => {
                const existing = previousById.get(element.id);
                if (existing) {
                    return {
                        ...existing,
                        letter: element.letter,
                        damage: element.damage,
                        level: element.level,
                        description: element.description,
                    };
                }

                return {
                    ...element,
                    initialPosition: getSpawnPosition(index),
                };
            });
        });

        setZoneOccupants((previous) =>
            previous.map((occupantId) =>
                playerProgress.elements.some((element) => element.id === occupantId)
                    ? occupantId
                    : null,
            ),
        );

        const maxId = playerProgress.elements.reduce(
            (currentMax, element) => Math.max(currentMax, element.id),
            0,
        );
        nextId.current = maxId + 1;
    }, [playerProgress.elements]);

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
        const draggable = draggables.find((item) => item.id === draggableId);
        if (!draggable || draggable.level >= 2) {
            return false;
        }

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
        const combinedLevel = matchingRecipe ? matchingRecipe.level : 2;
        const combinedDescription = matchingRecipe
            ? matchingRecipe.description
            : "Unstable fusion of two primal forces.";

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

        const newDraggable = {
            id: nextId.current,
            letter: combinedLetter,
            damage: combinedDamage,
            level: combinedLevel,
            description: combinedDescription,
        };

        nextId.current += 1;

        combineElements(consumedIds, newDraggable);

        setDraggables((previous) => {
            const preserved = previous.filter((draggable) => !consumedIds.includes(draggable.id));
            return [
                ...preserved,
                {
                    ...newDraggable,
                    initialPosition: {
                        x: outputRect.left - containerRect.left + (outputRect.width - dragWidth) / 2,
                        y: outputRect.top - containerRect.top + (outputRect.height - dragHeight) / 2,
                    },
                },
            ];
        });
        setZoneOccupants([null, null]);
    };

    const handleFight = () => {
        const enemy = enemies.length > 0
            ? enemies[Math.floor(Math.random() * enemies.length)]
            : { name: "Unknown", hp: 0, experience: 0 };
        navigate("/fight", {
            state: {
                enemy,
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
                    description={draggable.description}
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
                <PlayerStats
                    level={playerProgress.level}
                    hp={playerProgress.hp}
                    experience={playerProgress.experience}
                    fillPercent={levelFillPercent}
                />
            </div>
        </div>
    );
}

export default Game;