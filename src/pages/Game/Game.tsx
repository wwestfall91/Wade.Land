import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import EnemyInfo from "../../components/EnemyInfo";
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
    Description?: string;
    description?: string;
};

type Enemy = {
    name: string;
    hp: number;
    experience: number;
    description: string;
};

type PreviewCombination = {
    consumedIds: number[];
    letter: string;
    damage: number;
    level: number;
    description: string;
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
    const previewRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefs = [dropZoneRefA, dropZoneRefB];

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [nextEnemy, setNextEnemy] = useState<Enemy | null>(null);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const [isPreviewDragging, setIsPreviewDragging] = useState(false);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [previewPopupOffsetX, setPreviewPopupOffsetX] = useState(0);
    const [previewPopupBelow, setPreviewPopupBelow] = useState(false);
    const [previewHomePosition, setPreviewHomePosition] = useState<Position | null>(null);
    const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
    const [previewPointerOffset, setPreviewPointerOffset] = useState<Position>({ x: 0, y: 0 });
    const previewPositionRef = useRef<Position | null>(null);
    const previewPointerClientRef = useRef<Position>({ x: 0, y: 0 });
    const previewPopupRef = useRef<HTMLDivElement | null>(null);
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
                        description: ((row.Description ?? row.description ?? "") as string).trim(),
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

    useEffect(() => {
        if (enemies.length === 0) {
            setNextEnemy(null);
            return;
        }

        setNextEnemy(enemies[Math.floor(Math.random() * enemies.length)]);
    }, [enemies]);

    const canCombine = zoneOccupants.every((occupantId) => occupantId !== null);

    const previewCombination = useMemo<PreviewCombination | null>(() => {
        if (!canCombine) {
            return null;
        }

        const consumedIds = zoneOccupants.filter(
            (occupantId): occupantId is number => occupantId !== null,
        );
        const occupantItems = zoneOccupants.map((occupantId) =>
            draggables.find((draggable) => draggable.id === occupantId),
        );

        if (occupantItems.some((item) => !item)) {
            return null;
        }

        const occupantLetters = occupantItems.map((item) => item?.letter ?? "");
        const occupantDamage = occupantItems.reduce((total, item) => total + (item?.damage ?? 0), 0);
        const [leftElement, rightElement] = occupantLetters;

        const matchingRecipe = recipes.find(
            (recipe) =>
                (recipe.element1 === leftElement && recipe.element2 === rightElement) ||
                (recipe.element1 === rightElement && recipe.element2 === leftElement),
        );

        const combinedLetter = matchingRecipe ? matchingRecipe.result : occupantLetters.join("");
        if (consumedIds.length !== dropZoneRefs.length || combinedLetter.length === 0) {
            return null;
        }

        return {
            consumedIds,
            letter: combinedLetter,
            damage: matchingRecipe ? matchingRecipe.damage : occupantDamage,
            level: matchingRecipe ? matchingRecipe.level : 2,
            description: matchingRecipe
                ? matchingRecipe.description
                : "Unstable fusion of two primal forces.",
        };
    }, [canCombine, draggables, dropZoneRefs.length, recipes, zoneOccupants]);

    const getOutputCenterPosition = useCallback((): Position | null => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const outputRect = outputRef.current?.getBoundingClientRect();
        if (!containerRect || !outputRect) {
            return null;
        }

        const previewRect = previewRef.current?.getBoundingClientRect();
        const dragWidth = previewRect?.width ?? 32;
        const dragHeight = previewRect?.height ?? 32;

        return {
            x: outputRect.left - containerRect.left + (outputRect.width - dragWidth) / 2,
            y: outputRect.top - containerRect.top + (outputRect.height - dragHeight) / 2,
        };
    }, []);

    const finalizeCombination = useCallback((spawnPosition?: Position) => {
        if (!previewCombination) {
            return;
        }

        const outputPosition = getOutputCenterPosition();
        const targetPosition = spawnPosition ?? outputPosition;
        if (!targetPosition) {
            return;
        }

        const newDraggable = {
            id: nextId.current,
            letter: previewCombination.letter,
            damage: previewCombination.damage,
            level: previewCombination.level,
            description: previewCombination.description,
        };

        nextId.current += 1;

        combineElements(previewCombination.consumedIds, newDraggable);

        setDraggables((previous) => {
            const preserved = previous.filter(
                (draggable) => !previewCombination.consumedIds.includes(draggable.id),
            );

            return [
                ...preserved,
                {
                    ...newDraggable,
                    initialPosition: targetPosition,
                },
            ];
        });

        setZoneOccupants([null, null]);
        setIsPreviewDragging(false);
        setPreviewPosition(null);
        previewPositionRef.current = null;
    }, [combineElements, getOutputCenterPosition, previewCombination]);

    useEffect(() => {
        if (previewCombination) {
            return;
        }

        setIsPreviewDragging(false);
        setIsPreviewHovered(false);
        setPreviewPopupOffsetX(0);
        setPreviewPopupBelow(false);
        setPreviewHomePosition(null);
        setPreviewPosition(null);
        previewPositionRef.current = null;
    }, [previewCombination]);

    useLayoutEffect(() => {
        if (!previewCombination || isPreviewDragging) {
            return;
        }

        const centered = getOutputCenterPosition();
        if (centered) {
            setPreviewHomePosition(centered);
        }
    }, [getOutputCenterPosition, isPreviewDragging, previewCombination]);

    useEffect(() => {
        if (!previewCombination || !isPreviewHovered || isPreviewDragging) {
            setPreviewPopupOffsetX(0);
            setPreviewPopupBelow(false);
            return;
        }

        const updatePopupPosition = () => {
            const dragRect = previewRef.current?.getBoundingClientRect();
            const popupRect = previewPopupRef.current?.getBoundingClientRect();
            if (!dragRect || !popupRect) {
                return;
            }

            const screenPadding = 8;
            const popupLeft = dragRect.left + dragRect.width / 2 - popupRect.width / 2;
            const popupRight = popupLeft + popupRect.width;

            if (popupLeft < screenPadding) {
                setPreviewPopupOffsetX(screenPadding - popupLeft);
            } else if (popupRight > window.innerWidth - screenPadding) {
                setPreviewPopupOffsetX(window.innerWidth - screenPadding - popupRight);
            } else {
                setPreviewPopupOffsetX(0);
            }

            const topIfAbove = dragRect.top - 8 - popupRect.height;
            setPreviewPopupBelow(topIfAbove < screenPadding);
        };

        const rafId = window.requestAnimationFrame(updatePopupPosition);
        window.addEventListener("resize", updatePopupPosition);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", updatePopupPosition);
        };
    }, [isPreviewDragging, isPreviewHovered, previewCombination, previewPosition?.x, previewPosition?.y]);

    useEffect(() => {
        if (!isPreviewDragging) {
            return;
        }

        const handleMove = (event: PointerEvent) => {
            const containerRect = gameRef.current?.getBoundingClientRect();
            if (!containerRect) {
                return;
            }

            const nextPosition = {
                x: event.clientX - containerRect.left - previewPointerOffset.x,
                y: event.clientY - containerRect.top - previewPointerOffset.y,
            };

            previewPointerClientRef.current = { x: event.clientX, y: event.clientY };
            previewPositionRef.current = nextPosition;
            setPreviewPosition(nextPosition);
        };

        const handleUp = () => {
            const outputRect = outputRef.current?.getBoundingClientRect();
            const pointer = previewPointerClientRef.current;

            const isPointerInsideOutput =
                !!outputRect &&
                pointer.x >= outputRect.left &&
                pointer.x <= outputRect.right &&
                pointer.y >= outputRect.top &&
                pointer.y <= outputRect.bottom;

            setIsPreviewDragging(false);

            if (!isPointerInsideOutput && previewPositionRef.current) {
                finalizeCombination(previewPositionRef.current);
            } else {
                setIsPreviewHovered(false);
                setPreviewPosition(null);
                setPreviewHomePosition(getOutputCenterPosition());
                previewPositionRef.current = null;
            }
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);

        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };
    }, [finalizeCombination, isPreviewDragging, previewPointerOffset.x, previewPointerOffset.y]);

    const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();

        const previewRect = previewRef.current?.getBoundingClientRect();
        const containerRect = gameRef.current?.getBoundingClientRect();
        if (!previewRect || !containerRect) {
            return;
        }

        const initial = {
            x: previewRect.left - containerRect.left,
            y: previewRect.top - containerRect.top,
        };

        const offset = {
            x: event.clientX - previewRect.left,
            y: event.clientY - previewRect.top,
        };

        previewPointerClientRef.current = { x: event.clientX, y: event.clientY };
        setPreviewPointerOffset(offset);
        setPreviewPosition(initial);
        setIsPreviewHovered(false);
        setPreviewPopupOffsetX(0);
        setPreviewPopupBelow(false);
        previewPositionRef.current = initial;
        setIsPreviewDragging(true);
    };

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
        if (!previewCombination) {
            return;
        }

        finalizeCombination();
    };

    const handleFight = () => {
        const enemy = nextEnemy
            ? nextEnemy
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

            {previewCombination ? (
                <div
                    ref={previewRef}
                    className="drag drag-preview"
                    onPointerDown={handlePreviewPointerDown}
                    onMouseEnter={() => setIsPreviewHovered(true)}
                    onMouseLeave={() => setIsPreviewHovered(false)}
                    style={{
                        top: (isPreviewDragging ? previewPosition : previewHomePosition)?.y ?? 0,
                        left: (isPreviewDragging ? previewPosition : previewHomePosition)?.x ?? 0,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        cursor: isPreviewDragging ? "grabbing" : "grab",
                        userSelect: "none",
                        color: "black",
                        textAlign: "center",
                        borderRadius: "1rem",
                        border: "1px dashed black",
                    }}
                >
                    {isPreviewHovered && !isPreviewDragging && previewCombination.description.length > 0 ? (
                        <div
                            ref={previewPopupRef}
                            className={`drag-description-popup ${previewPopupBelow ? "is-below" : ""}`}
                            style={{
                                ["--popup-offset-x" as string]: `${previewPopupOffsetX}px`,
                            }}
                        >
                            {previewCombination.description}
                        </div>
                    ) : null}
                    {previewCombination.letter}
                </div>
            ) : null}

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
            <EnemyInfo 
                enemyName={nextEnemy?.name ?? "Unknown Enemy"} 
                enemyHealth={nextEnemy?.hp ?? 0}
                enemyDescription={nextEnemy?.description ?? ""} 
            />
        </div>
    );
}

export default Game;