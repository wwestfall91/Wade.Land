import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import StartMenuModal from "./StartMenuModal.tsx";
import { useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import EnemyInfo from "../../components/EnemyInfo";
import { parseSpellEffectsFromRow, type SpellEffectConfig } from "../../combat/spellEffects";
import { type RewardElement, usePlayer } from "../../context/PlayerContext";
import FloatingTooltip from "./FloatingTooltip";
import "./Game.scss";

// TODO: Add special effects (Healing, burn, multi-hit)
// TODO: Balance the current state to be fun
// TODO: Add combos to battles

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
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    initialPosition: Position;
};

type CombinationRecipe = {
    element1: string;
    element2: string;
    result: string;
    damage: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
};

type ElementRow = {
    [key: string]: unknown;
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
    ["Type 1"]?: string;
    ["Type 2"]?: string;
    Type1?: string;
    Type2?: string;
};

type EnemyRow = {
    Name?: string;
    name?: string;
    HP?: number | string;
    hp?: number | string;
    Power?: number | string;
    power?: number | string;
    Experience?: number | string;
    experience?: number | string;
    Description?: string;
    description?: string;
    Sprite?: string;
    sprite?: string;
    Weak1?: string;
    Weak2?: string;
    ["Weak 1"]?: string;
    ["Weak 2"]?: string;
};

type Enemy = {
    name: string;
    hp: number;
    power: number;
    experience: number;
    description: string;
    sprite: string;
    weaknesses: string[];
};

type PreviewCombination = {
    consumedIds: number[];
    letter: string;
    damage: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
};

const SPREAD_X = 200;
const SPREAD_Y = 150;

const normalizeType = (value?: string): string => value?.trim().toLowerCase() ?? "";

const getRandomUniqueElements = (elements: RewardElement[], count: number): RewardElement[] => {
    const shuffled = [...elements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
};

const getEffectSummaryLines = (effects?: SpellEffectConfig[]): string[] => {
    const lines: string[] = [];
    const normalizedEffects = effects ?? [];

    const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
    if (multiHit?.hits && multiHit.hits > 1) {
        lines.push(`Hits: ${multiHit.hits}x`);
    }

    normalizedEffects.forEach((effect) => {
        switch (effect.kind) {
            case "heal": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    lines.push(`Heal: +${amount}`);
                }
                break;
            }
            case "burn": {
                const amount = Math.max(0, effect.amount ?? 0);
                const duration = Math.max(1, effect.duration ?? 1);
                if (amount > 0) {
                    lines.push(`Burn: +${amount} for ${duration} turns`);
                }
                break;
            }
            case "shield": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    lines.push(`Shield: +${amount}`);
                }
                break;
            }
            case "lifesteal": {
                const amount = Math.max(0, effect.amount ?? 0);
                if (amount > 0) {
                    const percent = amount > 1 ? amount : Math.round(amount * 100);
                    lines.push(`Lifesteal: ${percent}%`);
                }
                break;
            }
            case "soak": {
                const amount = Math.max(1, effect.amount ?? 1);
                lines.push(`Soak: +${amount}`);
                break;
            }
            default:
                break;
        }
    });

    return lines;
};

const getEffectChipClass = (line: string): string => {
    if (line.startsWith("Heal:")) {
        return "effect-heal";
    }
    if (line.startsWith("Burn:")) {
        return "effect-burn";
    }
    if (line.startsWith("Shield:")) {
        return "effect-shield";
    }
    if (line.startsWith("Lifesteal:")) {
        return "effect-lifesteal";
    }
    if (line.startsWith("Soak:")) {
        return "effect-soak";
    }
    if (line.startsWith("Hits:")) {
        return "effect-multi-hit";
    }

    return "effect-default";
};

function Game() {
    const navigate = useNavigate();
    const {
        player: playerProgress,
        levelFillPercent,
        initializeElements,
        combineElements,
        selectedEnemy: nextEnemy,
        setSelectedEnemy: setNextEnemy,
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
    const [baseElements, setBaseElements] = useState<RewardElement[]>([]);
    const [starterChoices, setStarterChoices] = useState<RewardElement[]>([]);
    const [selectedStarter, setSelectedStarter] = useState<RewardElement | null>(null);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const [isPreviewDragging, setIsPreviewDragging] = useState(false);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [previewHomePosition, setPreviewHomePosition] = useState<Position | null>(null);
    const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
    const [previewPointerOffset, setPreviewPointerOffset] = useState<Position>({ x: 0, y: 0 });
    const previewPositionRef = useRef<Position | null>(null);
    const previewPointerClientRef = useRef<Position>({ x: 0, y: 0 });
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
                    type1: normalizeType((row["Type 1"] ?? row.Type1 ?? "") as string),
                    type2: normalizeType((row["Type 2"] ?? row.Type2 ?? "") as string),
                    effects: parseSpellEffectsFromRow(row),
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
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                }));

            setRecipes(combinationRecipes);
            const baseElementRows = parsedRows.filter(
                (row) => row.element1.length === 0 && row.element2.length === 0,
            );
            setBaseElements(
                baseElementRows.map((row) => ({
                    letter: row.name,
                    damage: row.damage,
                    level: row.level,
                    description: row.description,
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                })),
            );
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
                        power: Number(row.Power ?? row.power ?? 0) || 0,
                        experience: Number(row.Experience ?? row.experience ?? 0) || 0,
                        description: ((row.Description ?? row.description ?? "") as string).trim(),
                        sprite: ((row.Sprite ?? row.sprite ?? "") as string).trim(),
                        weaknesses: [row.Weak1, row["Weak 1"], row.Weak2, row["Weak 2"]]
                            .flatMap((value) => String(value ?? "").split(/[;,/]/g))
                            .map((value) => normalizeType(value))
                            .filter(Boolean),
                    }))
                    .filter((e) => e.name.length > 0);
                setEnemies(parsed);
            });

    }, []);

    useEffect(() => {
        if (playerProgress.elements.length > 0 || baseElements.length === 0 || starterChoices.length > 0) {
            return;
        }

        const choices = getRandomUniqueElements(baseElements, 3);
        setStarterChoices(choices);
        setSelectedStarter(null);
    }, [baseElements, playerProgress.elements.length, starterChoices.length]);

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
                        type1: element.type1,
                        type2: element.type2,
                        effects: element.effects,
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
        if (enemies.length === 0 || nextEnemy) return;
        // Start with the first enemy row from the sheet.
        setNextEnemy(enemies[0]);
    }, [enemies, nextEnemy, setNextEnemy]);

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
            type1: matchingRecipe?.type1,
            type2: matchingRecipe?.type2,
            effects: matchingRecipe?.effects,
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
            type1: previewCombination.type1,
            type2: previewCombination.type2,
            effects: previewCombination.effects,
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
        if (!nextEnemy) return;

        // Fight the currently selected enemy and preselect the next row in order.
        const currentIndex = enemies.findIndex((enemy) => enemy.name === nextEnemy.name);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const fullEnemy = enemies[safeCurrentIndex] ?? nextEnemy;
        const nextIndex = (safeCurrentIndex + 1) % enemies.length;
        setNextEnemy(enemies[nextIndex]);

        navigate("/fight", {
            state: {
                enemy: fullEnemy,
                elementPool: baseElements,
            },
        });
    };

    const handleConfirmStarter = () => {
        if (!selectedStarter) {
            return;
        }

        initializeElements([
            {
                id: nextId.current++,
                ...selectedStarter,
            },
        ]);
        setStarterChoices([]);
        setSelectedStarter(null);
    };

    const isStartMenuOpen = playerProgress.elements.length === 0 && starterChoices.length > 0;

    return (
        <div id="Game" ref={gameRef} style={{ position: "relative", width: "100%", height: "100%" }} >
            {draggables.map((draggable) => (
                <Draggable
                    key={draggable.id}
                    id={draggable.id}
                    letter={draggable.letter}
                    damage={draggable.damage}
                    description={draggable.description}
                    type1={draggable.type1}
                    type2={draggable.type2}
                    effects={draggable.effects}
                    containerRef={gameRef}
                    dropZoneRefs={dropZoneRefs}
                    initialPosition={draggable.initialPosition}
                    onSnapChange={handleSnapChange}
                    canSnapToZone={canSnapToZone}
                />
            ))}

            {previewCombination ? (
                <>
                    <div
                        ref={previewRef}
                        className={`drag drag-preview ${isPreviewDragging ? "is-dragging" : ""}`}
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
                        }}
                    >
                        {previewCombination.letter}
                    </div>
                    <FloatingTooltip
                        anchorElement={previewRef.current}
                        open={isPreviewHovered && !isPreviewDragging}
                        className="drag-description-popup"
                    >
                        {previewCombination.description.length > 0 ? (
                            <div className="drag-description-text">{previewCombination.description}</div>
                        ) : null}
                        <div className="drag-damage-text">Damage: {previewCombination.damage}</div>
                        <div className="drag-type-text">
                            <span className="drag-type-label">Types:</span>
                            <span className="drag-type-list">
                                {[previewCombination.type1, previewCombination.type2].filter(
                                    (value): value is string => Boolean(value && value.trim().length > 0),
                                ).length > 0 ? (
                                    [previewCombination.type1, previewCombination.type2]
                                        .filter((value): value is string => Boolean(value && value.trim().length > 0))
                                        .map((type) => (
                                            <span
                                                key={type}
                                                className={`type-chip type-${type
                                                    .trim()
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9]+/g, "-")}`}
                                            >
                                                {type}
                                            </span>
                                        ))
                                ) : (
                                    <span className="type-chip type-none">None</span>
                                )}
                            </span>
                        </div>
                        {getEffectSummaryLines(previewCombination.effects).length > 0 ? (
                            <div className="drag-effect-text">
                                <span className="drag-effect-label">Effects:</span>
                                <span className="drag-effect-list">
                                    {getEffectSummaryLines(previewCombination.effects).map((line) => (
                                        <span key={line} className={`effect-chip ${getEffectChipClass(line)}`}>{line}</span>
                                    ))}
                                </span>
                            </div>
                        ) : null}
                    </FloatingTooltip>
                </>
            ) : null}

            <div className="element-start" ref={elementStartRef}></div>
            <div className="game-controls-stack">
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

                    <div className={`combine-button-wrap ${!canCombine ? "is-disabled" : ""}`}>
                        <button className="combine-button" disabled={!canCombine} onClick={handleCombine}>
                            COMBINE!
                        </button>
                        <div className="combine-button-tooltip" role="tooltip">
                            Please insert two base elements to start combining
                        </div>
                    </div>
                </div>

                <div className="battle-station">
                    <button className="fight-button" onClick={handleFight}>
                        FIGHT!
                    </button>
                    <PlayerStats
                        level={playerProgress.level}
                        hp={playerProgress.hp}
                        experience={playerProgress.experience}
                        fillPercent={levelFillPercent}
                        className="player-stats-dock"
                    />
                </div>
            </div>
            <EnemyInfo 
                enemyName={nextEnemy?.name ?? "Unknown Enemy"} 
                enemyHealth={nextEnemy?.hp ?? 0}
                enemyDescription={nextEnemy?.description ?? ""}
                enemyWeaknesses={nextEnemy?.weaknesses ?? []}
                enemySpritePath={nextEnemy?.sprite ?? ""}
            />
            {isStartMenuOpen ? (
                <StartMenuModal
                    choices={starterChoices}
                    selected={selectedStarter}
                    onSelect={setSelectedStarter}
                    onConfirm={handleConfirmStarter}
                />
            ) : null}
        </div>
    );
}

export default Game;