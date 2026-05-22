import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import StartMenuModal from "./StartMenuModal.tsx";
import { useLocation, useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import EnemyInfo from "../../components/EnemyInfo";
import ElementIcon from "../../components/ElementIcon";
import { parseSpellEffectsFromRow, type SpellEffectConfig } from "../../combat/spellEffects";
import { getEffectChipClass, getEffectSummaryLines } from "../../combat/effectSummary";
import { type RewardElement, usePlayer } from "../../context/PlayerContext";
import FloatingTooltip from "./FloatingTooltip";
import RewardModal from "../Fight/RewardModal";
import soulIcon from "../../assets/icons/Soul.png";
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
    energy?: number;
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
    energy?: number;
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
    energy?: number | string;
    Energy?: number | string;
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
    Souls?: number | string;
    souls?: number | string;
    Description?: string;
    description?: string;
    Sprite?: string;
    sprite?: string;
    Element1?: string;
    Element2?: string;
    Element3?: string;
    element1?: string;
    element2?: string;
    element3?: string;
    Weak1?: string;
    Weak2?: string;
    ["Weak 1"]?: string;
    ["Weak 2"]?: string;
};

type Enemy = {
    name: string;
    hp: number;
    souls: number;
    description: string;
    sprite: string;
    weaknesses: string[];
    elements: RewardElement[];
};

type PreviewCombination = {
    consumedIds: number[];
    letter: string;
    damage: number;
    energy?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
};

type FightRewardState = {
    soulsGained: number;
    rewardElements: RewardElement[];
};

type GameLocationState = {
    fightReward?: FightRewardState;
};

const SPREAD_X = 200;
const SPREAD_Y = 150;
const DRAG_TUTORIAL_SEEN_KEY = "game.dragTutorialSeen";
const DROP_ZONE_ONE_TUTORIAL_SEEN_KEY = "game.dropZoneOneTutorialSeen";
const INTRO_TEXT_VISIBLE_MS = 1850;
const INTRO_TEXT_FADE_GAP_MS = 850;
const INTRO_INPUT_FADE_MS = 640;
const INTRO_SCENE_FADEOUT_MS = 1600;
const REWARD_CUE_MS = 260;
const POTION_FILL_PER_WATER_CREATE = 25;
const POTION_FILL_CAP = 100;
const POTION_BREW_FLASH_MS = 320;
const POTION_SPARKLE_TRAVEL_MS = 620;
const SOULS_PER_FLYING_ICON = 5;
const SOUL_COLLECTION_TRAVEL_MS = 620;
const SOUL_COLLECTION_STAGGER_MS = 82;
const SOUL_COLLECTION_PULSE_MS = 500;
const SOUL_COLLECTION_TEXT_EXTRA_MS = 500;

type SoulFlightIcon = {
    id: number;
    startX: number;
    startY: number;
    midX: number;
    midY: number;
    toX: number;
    toY: number;
    delayMs: number;
};

type PotionSparkle = {
    id: number;
    startX: number;
    startY: number;
    toX: number;
    toY: number;
    delayMs: number;
};

const normalizeType = (value?: string): string => value?.trim().toLowerCase() ?? "";
const normalizeElementName = (value?: string): string => value?.trim().toLowerCase() ?? "";
const isPlasmaName = (value?: string): boolean => normalizeElementName(value) === "plasma";
const isUnstableName = (value?: string): boolean => {
    const normalized = normalizeElementName(value).replace(/[^a-z0-9]+/g, "");
    return normalized === "unstable" || normalized === "unstableelement";
};
const wait = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
});

type IntroPhase = "hidden" | "line1" | "line2" | "input" | "line3" | "line4" | "fadeout";

const getRandomUniqueElements = (elements: RewardElement[], count: number): RewardElement[] => {
    const shuffled = [...elements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
};

function Game() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        player: playerProgress,
        playerName,
        setPlayerName,
        initializeElements,
        combineElements,
        addSouls,
        addElement,
        healPlayer,
        levels,
        selectedEnemy: nextEnemy,
        setSelectedEnemy: setNextEnemy,
    } = usePlayer();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const elementStartRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const dropZoneRefC = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [baseElements, setBaseElements] = useState<RewardElement[]>([]);
    const [allElementOptions, setAllElementOptions] = useState<RewardElement[]>([]);
    const [starterChoices, setStarterChoices] = useState<RewardElement[]>([]);
    const [selectedStarter, setSelectedStarter] = useState<RewardElement | null>(null);
    const [isDevElementPanelOpen, setIsDevElementPanelOpen] = useState(false);
    const [hasSeenDragTutorial, setHasSeenDragTutorial] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }

        return window.localStorage.getItem(DRAG_TUTORIAL_SEEN_KEY) === "1";
    });
    const [hasSeenDropZoneOneTutorial, setHasSeenDropZoneOneTutorial] = useState(() => {
        if (typeof window === "undefined") {
            return false;
        }

        return window.localStorage.getItem(DROP_ZONE_ONE_TUTORIAL_SEEN_KEY) === "1";
    });
    const [hasStartedDraggingElement, setHasStartedDraggingElement] = useState(false);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const [isPreviewDragging, setIsPreviewDragging] = useState(false);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [previewHomePosition, setPreviewHomePosition] = useState<Position | null>(null);
    const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
    const [previewPointerOffset, setPreviewPointerOffset] = useState<Position>({ x: 0, y: 0 });
    const [introPhase, setIntroPhase] = useState<IntroPhase>(() => (playerName.trim().length > 0 ? "hidden" : "line1"));
    const [isIntroTextVisible, setIsIntroTextVisible] = useState(() => playerName.trim().length === 0);
    const [introNameInput, setIntroNameInput] = useState("");
    const [isIntroInputFadingOut, setIsIntroInputFadingOut] = useState(false);
    const [fightReward, setFightReward] = useState<FightRewardState | null>(null);
    const [isFightVictoryCueVisible, setIsFightVictoryCueVisible] = useState(false);
    const [potionCount, setPotionCount] = useState(0);
    const [potionFillPercent, setPotionFillPercent] = useState(0);
    const [isPotionUnavailableFeedback, setIsPotionUnavailableFeedback] = useState(false);
    const [isPotionBrewedFlash, setIsPotionBrewedFlash] = useState(false);
    const [potionSparkles, setPotionSparkles] = useState<PotionSparkle[]>([]);
    const [isSoulPulseVisible, setIsSoulPulseVisible] = useState(false);
    const [soulPulseAmount, setSoulPulseAmount] = useState(0);
    const [isSoulCounterPopping, setIsSoulCounterPopping] = useState(false);
    const [soulFlightIcons, setSoulFlightIcons] = useState<SoulFlightIcon[]>([]);
    const previewPositionRef = useRef<Position | null>(null);
    const previewPointerClientRef = useRef<Position>({ x: 0, y: 0 });
    const introChosenNameRef = useRef("");
    const nextId = useRef(1);
    const soulFlightIdRef = useRef(1);
    const elementCatalogRef = useRef<Map<string, RewardElement>>(new Map());
    const pendingDropSpawnByIdRef = useRef<Map<number, Position>>(new Map());
    const rewardCueTimeoutRef = useRef<number | null>(null);
    const potionUnavailableTimeoutRef = useRef<number | null>(null);
    const potionBrewFlashTimeoutRef = useRef<number | null>(null);
    const potionSparkleIdRef = useRef(1);
    const potionSparkleTimeoutsRef = useRef<number[]>([]);
    const soulAnimationTimeoutsRef = useRef<number[]>([]);
    const soulCounterPopTimeoutRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (rewardCueTimeoutRef.current !== null) {
            window.clearTimeout(rewardCueTimeoutRef.current);
        }
        if (potionUnavailableTimeoutRef.current !== null) {
            window.clearTimeout(potionUnavailableTimeoutRef.current);
        }
        if (potionBrewFlashTimeoutRef.current !== null) {
            window.clearTimeout(potionBrewFlashTimeoutRef.current);
        }
        potionSparkleTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        if (soulCounterPopTimeoutRef.current !== null) {
            window.clearTimeout(soulCounterPopTimeoutRef.current);
        }
    }, []);

    const clearSoulAnimationTimeouts = useCallback(() => {
        soulAnimationTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        soulAnimationTimeoutsRef.current = [];
    }, []);

    const triggerSoulCounterPop = useCallback(() => {
        setIsSoulCounterPopping(false);
        window.requestAnimationFrame(() => {
            setIsSoulCounterPopping(true);
            if (soulCounterPopTimeoutRef.current !== null) {
                window.clearTimeout(soulCounterPopTimeoutRef.current);
            }

            soulCounterPopTimeoutRef.current = window.setTimeout(() => {
                setIsSoulCounterPopping(false);
            }, 240);
        });
    }, []);

    const triggerPotionBrewFlash = useCallback(() => {
        setIsPotionBrewedFlash(false);
        window.requestAnimationFrame(() => {
            setIsPotionBrewedFlash(true);
            if (potionBrewFlashTimeoutRef.current !== null) {
                window.clearTimeout(potionBrewFlashTimeoutRef.current);
            }

            potionBrewFlashTimeoutRef.current = window.setTimeout(() => {
                setIsPotionBrewedFlash(false);
            }, POTION_BREW_FLASH_MS);
        });
    }, []);

    const launchPotionSparkle = useCallback((spawnViewportPosition: Position) => {
        const potionTarget = document.querySelector("#Game .player-stats-dock .player-potion-panel") as HTMLElement | null;
        if (!potionTarget) {
            return;
        }

        const targetRect = potionTarget.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const burstSparkles: PotionSparkle[] = Array.from({ length: 3 }, (_, index) => {
            const delayMs = index * 65;
            const jitterX = (Math.random() - 0.5) * 14;
            const jitterY = (Math.random() - 0.5) * 14;
            return {
                id: potionSparkleIdRef.current++,
                startX: spawnViewportPosition.x + jitterX,
                startY: spawnViewportPosition.y + jitterY,
                toX: targetX - (spawnViewportPosition.x + jitterX),
                toY: targetY - (spawnViewportPosition.y + jitterY),
                delayMs,
            };
        });

        setPotionSparkles((previous) => [...previous, ...burstSparkles]);

        burstSparkles.forEach((sparkle) => {
            const cleanupTimeoutId = window.setTimeout(() => {
                setPotionSparkles((previous) => previous.filter((entry) => entry.id !== sparkle.id));
            }, sparkle.delayMs + POTION_SPARKLE_TRAVEL_MS + 110);
            potionSparkleTimeoutsRef.current.push(cleanupTimeoutId);
        });
    }, []);

    useEffect(() => () => {
        clearSoulAnimationTimeouts();
    }, [clearSoulAnimationTimeouts]);

    useEffect(() => {
        const state = location.state as GameLocationState | null;
        if (state?.fightReward) {
            if (rewardCueTimeoutRef.current !== null) {
                window.clearTimeout(rewardCueTimeoutRef.current);
            }

            setFightReward(null);
            setIsFightVictoryCueVisible(true);
            rewardCueTimeoutRef.current = window.setTimeout(() => {
                setFightReward(state.fightReward ?? null);
                setIsFightVictoryCueVisible(false);
            }, REWARD_CUE_MS);
        }
    }, [location.state]);

    const activeDropZoneRefs = zoneOccupants.length === 3
        ? [dropZoneRefA, dropZoneRefB, dropZoneRefC]
        : [dropZoneRefA, dropZoneRefB];

    const getDraggableById = useCallback((draggableId: number | null) => {
        if (draggableId === null) {
            return null;
        }

        return draggables.find((item) => item.id === draggableId) ?? null;
    }, [draggables]);

    const normalizeZoneOccupants = useCallback((occupants: Array<number | null>): Array<number | null> => {
        const sanitized = occupants.map((id) => (getDraggableById(id) ? id : null));
        const plasmaId = sanitized.find((id) => {
            const item = getDraggableById(id);
            return item ? isPlasmaName(item.letter) : false;
        }) ?? null;

        if (plasmaId === null) {
            const nonPlasma = sanitized.filter((id): id is number => id !== null).slice(0, 2);
            return [nonPlasma[0] ?? null, nonPlasma[1] ?? null];
        }

        let left: number | null = null;
        let right: number | null = null;

        if (sanitized.length === 2) {
            const [first, second] = sanitized;
            if (first === plasmaId && second !== null && second !== plasmaId) {
                right = second;
            }
            if (second === plasmaId && first !== null && first !== plasmaId) {
                left = first;
            }
        } else {
            const possibleLeft = sanitized[0];
            const possibleRight = sanitized[2];
            if (possibleLeft !== null && possibleLeft !== plasmaId) {
                left = possibleLeft;
            }
            if (possibleRight !== null && possibleRight !== plasmaId) {
                right = possibleRight;
            }
        }

        const leftovers = sanitized.filter((id): id is number => (
            id !== null && id !== plasmaId && id !== left && id !== right
        ));

        if (left === null) {
            left = leftovers.shift() ?? null;
        }

        if (right === null) {
            right = leftovers.shift() ?? null;
        }

        return [left, plasmaId, right];
    }, [getDraggableById]);

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
        if (introPhase === "hidden" || introPhase === "input" || introPhase === "fadeout") {
            return;
        }

        let isCancelled = false;

        const playNarrationPhase = async () => {
            setIsIntroTextVisible(false);
            await wait(40);
            if (isCancelled) {
                return;
            }

            setIsIntroTextVisible(true);
            await wait(INTRO_TEXT_VISIBLE_MS);
            if (isCancelled) {
                return;
            }

            setIsIntroTextVisible(false);
            await wait(INTRO_TEXT_FADE_GAP_MS);
            if (isCancelled) {
                return;
            }

            if (introPhase === "line1") {
                setIntroPhase("line2");
                return;
            }

            if (introPhase === "line2") {
                setIntroPhase("input");
                return;
            }

            if (introPhase === "line3") {
                setIntroPhase("line4");
                return;
            }

            if (introPhase === "line4") {
                setIntroPhase("fadeout");
            }
        };

        void playNarrationPhase();

        return () => {
            isCancelled = true;
        };
    }, [introPhase]);

    useEffect(() => {
        if (introPhase !== "fadeout") {
            return;
        }

        let isCancelled = false;

        const fadeOutScene = async () => {
            await wait(INTRO_SCENE_FADEOUT_MS);
            if (isCancelled) {
                return;
            }

            setIntroPhase("hidden");
            setIsIntroTextVisible(false);
        };

        void fadeOutScene();

        return () => {
            isCancelled = true;
        };
    }, [introPhase]);

    useEffect(() => {
        let isCancelled = false;

        const loadElements = (buffer: ArrayBuffer) => {
            const wb = XLSX.read(buffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<ElementRow>(ws);

            const parsedRows = rows
                .map((row) => ({
                    name: (row.name ?? row.Name ?? "").trim(),
                    element1: (row["Element 1"] ?? "").trim(),
                    element2: (row["Element 2"] ?? "").trim(),
                    damage: Number(row.damage ?? row.Damage ?? 0) || 0,
                    energy: Math.max(0, Number(row.energy ?? row.Energy ?? 0) || 0),
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
                    energy: row.energy,
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

            setAllElementOptions(
                parsedRows.map((row) => ({
                    letter: row.name,
                    damage: row.damage,
                    energy: row.energy,
                    level: row.level,
                    description: row.description,
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                })),
            );

            elementCatalogRef.current = new Map(
                parsedRows.map((row) => [normalizeElementName(row.name), {
                    letter: row.name,
                    damage: row.damage,
                    energy: row.energy,
                    level: row.level,
                    description: row.description,
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                } satisfies RewardElement]),
            );
            setBaseElements(
                baseElementRows.map((row) => ({
                    letter: row.name,
                    damage: row.damage,
                    energy: row.energy,
                    level: row.level,
                    description: row.description,
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                })),
            );
        };

        const loadGameData = async () => {
            const elementsBuffer = await fetch("/elements.xlsx").then((res) => res.arrayBuffer());
            if (isCancelled) {
                return;
            }

            loadElements(elementsBuffer);

            const enemiesBuffer = await fetch("/enemies.xlsx").then((res) => res.arrayBuffer());
            if (isCancelled) {
                return;
            }

            const wb = XLSX.read(enemiesBuffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<EnemyRow>(ws);
            const parsed: Enemy[] = rows
                .map((row) => ({
                    name: ((row.Name ?? row.name ?? "") as string).trim(),
                    hp: Number(row.HP ?? row.hp ?? 0) || 0,
                    souls: Number(row.Souls ?? row.souls ?? 0) || 0,
                    description: ((row.Description ?? row.description ?? "") as string).trim(),
                    sprite: ((row.Sprite ?? row.sprite ?? "") as string).trim(),
                    weaknesses: [row.Weak1, row["Weak 1"], row.Weak2, row["Weak 2"]]
                        .flatMap((value) => String(value ?? "").split(/[;,/]/g))
                        .map((value) => normalizeType(value))
                        .filter(Boolean),
                    elements: [row.Element1 ?? row.element1, row.Element2 ?? row.element2, row.Element3 ?? row.element3]
                        .map((value) => String(value ?? "").trim())
                        .filter((value) => value.length > 0)
                        .map((value) => elementCatalogRef.current.get(normalizeElementName(value)))
                        .filter((value): value is RewardElement => Boolean(value)),
                }))
                .filter((e) => e.name.length > 0);
            setEnemies(parsed);
        };

        void loadGameData();

        return () => {
            isCancelled = true;
        };

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
                        energy: element.energy,
                        level: element.level,
                        description: element.description,
                        type1: element.type1,
                        type2: element.type2,
                        effects: element.effects,
                    };
                }

                return {
                    ...element,
                    initialPosition: pendingDropSpawnByIdRef.current.get(element.id) ?? getSpawnPosition(index),
                };
            });
        });

        pendingDropSpawnByIdRef.current.clear();

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
        setZoneOccupants((previous) => {
            const normalized = normalizeZoneOccupants(previous);
            if (
                normalized.length === previous.length &&
                previous.every((value, index) => value === normalized[index])
            ) {
                return previous;
            }

            return normalized;
        });
    }, [draggables, normalizeZoneOccupants]);

    useEffect(() => {
        if (enemies.length === 0 || nextEnemy) return;
        // Start with the first enemy row from the sheet.
        setNextEnemy(enemies[0]);
    }, [enemies, nextEnemy, setNextEnemy]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key === "/") {
                event.preventDefault();
                setIsDevElementPanelOpen((previous) => !previous);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const handleDevElementDragStart = (event: React.DragEvent<HTMLButtonElement>, element: RewardElement) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-wade-element", JSON.stringify(element));
    };

    const handleGameDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const payload = event.dataTransfer.getData("application/x-wade-element");
        if (!payload) {
            return;
        }

        try {
            const parsed = JSON.parse(payload) as RewardElement;
            const nextElementId = playerProgress.elements.reduce(
                (currentMax, element) => Math.max(currentMax, element.id),
                0,
            ) + 1;

            const containerRect = gameRef.current?.getBoundingClientRect();
            if (containerRect) {
                pendingDropSpawnByIdRef.current.set(nextElementId, {
                    x: Math.round(event.clientX - containerRect.left - 16),
                    y: Math.round(event.clientY - containerRect.top - 16),
                });
            }

            addElement(parsed);
        } catch {
            // Ignore malformed test-panel payloads.
        }
    };

    const handleGameDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.types.includes("application/x-wade-element")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }
    };

    const previewCombination = useMemo<PreviewCombination | null>(() => {
        if (!zoneOccupants.every((occupantId) => occupantId !== null)) {
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

        if (consumedIds.length !== zoneOccupants.length) {
            return null;
        }

        const buildUnstableCloneResult = (
            unstableItem: DraggableItem,
            otherItem: DraggableItem,
        ): PreviewCombination | null => {
            const unstableTypes = [unstableItem.type1, unstableItem.type2]
                .filter((type): type is string => Boolean(type && type.trim().length > 0));
            const otherTypes = [otherItem.type1, otherItem.type2]
                .filter((type): type is string => Boolean(type && type.trim().length > 0));
            const hasSharedType = otherTypes.some((type) => unstableTypes.includes(type));

            if (!hasSharedType) {
                return null;
            }

            return {
                consumedIds,
                letter: `${otherItem.letter}+`,
                damage: otherItem.damage,
                energy: otherItem.energy,
                level: otherItem.level,
                description: otherItem.description,
                type1: unstableItem.type1,
                type2: unstableItem.type2,
                effects: unstableItem.effects,
            };
        };

        if (zoneOccupants.length === 3) {
            const [leftItem, middleItem, rightItem] = occupantItems;
            if (!leftItem || !middleItem || !rightItem || !isPlasmaName(middleItem.letter)) {
                return null;
            }

            const sideEffects = [...(leftItem.effects ?? []), ...(rightItem.effects ?? [])];
            const combinedEnergy = Math.max(0, (leftItem.energy ?? 0) + (rightItem.energy ?? 0));
            const leftPrimaryType = leftItem.type1 || leftItem.type2;
            const rightPrimaryType = rightItem.type1 || rightItem.type2;
            const mergedTypes = [leftPrimaryType, rightPrimaryType]
                .filter((type): type is string => Boolean(type && type.trim().length > 0))
                .filter((type, index, collection) => collection.indexOf(type) === index)
                .slice(0, 2);

            const leftIsUnstable = isUnstableName(leftItem.letter);
            const rightIsUnstable = isUnstableName(rightItem.letter);
            const hasSingleUnstable = leftIsUnstable !== rightIsUnstable;

            if (hasSingleUnstable) {
                const unstableItem = leftIsUnstable ? leftItem : rightItem;
                const otherItem = leftIsUnstable ? rightItem : leftItem;
                return buildUnstableCloneResult(unstableItem, otherItem);
            }

            return {
                consumedIds,
                letter: "Unstable Element",
                damage: 0,
                energy: combinedEnergy,
                level: 2,
                description: "Unstable fusion carrying the effects of both connected elements.",
                type1: mergedTypes[0],
                type2: mergedTypes[1],
                effects: sideEffects,
            };
        }

        const [leftItem, rightItem] = occupantItems;
        const leftIsUnstable = Boolean(leftItem && isUnstableName(leftItem.letter));
        const rightIsUnstable = Boolean(rightItem && isUnstableName(rightItem.letter));

        if (leftItem && rightItem && leftIsUnstable !== rightIsUnstable) {
            const unstableItem = leftIsUnstable ? leftItem : rightItem;
            const otherItem = leftIsUnstable ? rightItem : leftItem;
            return buildUnstableCloneResult(unstableItem, otherItem);
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
        if (combinedLetter.length === 0) {
            return null;
        }

        return {
            consumedIds,
            letter: combinedLetter,
            damage: matchingRecipe ? matchingRecipe.damage : occupantDamage,
            energy: matchingRecipe ? matchingRecipe.energy : 0,
            level: matchingRecipe ? matchingRecipe.level : 2,
            description: matchingRecipe
                ? matchingRecipe.description
                : "Unstable fusion of two primal forces.",
            type1: matchingRecipe?.type1,
            type2: matchingRecipe?.type2,
            effects: matchingRecipe?.effects,
        };
    }, [draggables, recipes, zoneOccupants]);

    const canCombine = previewCombination !== null;

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
            energy: previewCombination.energy,
            level: previewCombination.level,
            description: previewCombination.description,
            type1: previewCombination.type1,
            type2: previewCombination.type2,
            effects: previewCombination.effects,
        };

        nextId.current += 1;

        combineElements(previewCombination.consumedIds, newDraggable);
        const createdElementTypes = [newDraggable.type1, newDraggable.type2]
            .map((type) => normalizeType(type))
            .filter((type) => type.length > 0);
        if (createdElementTypes.includes("water")) {
            const containerRect = gameRef.current?.getBoundingClientRect();
            if (containerRect) {
                launchPotionSparkle({
                    x: containerRect.left + targetPosition.x + 16,
                    y: containerRect.top + targetPosition.y + 16,
                });
            }

            setPotionFillPercent((previousFill) => {
                const totalFill = previousFill + POTION_FILL_PER_WATER_CREATE;
                const createdPotions = Math.floor(totalFill / POTION_FILL_CAP);

                if (createdPotions > 0) {
                    setPotionCount((previousPotions) => previousPotions + createdPotions);
                    triggerPotionBrewFlash();
                }

                return totalFill % POTION_FILL_CAP;
            });
        }

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
    }, [combineElements, getOutputCenterPosition, launchPotionSparkle, previewCombination, triggerPotionBrewFlash]);

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

    const handlePotionClick = useCallback(() => {
        if (potionCount <= 0) {
            setIsPotionUnavailableFeedback(false);
            window.requestAnimationFrame(() => {
                setIsPotionUnavailableFeedback(true);
                if (potionUnavailableTimeoutRef.current !== null) {
                    window.clearTimeout(potionUnavailableTimeoutRef.current);
                }
                potionUnavailableTimeoutRef.current = window.setTimeout(() => {
                    setIsPotionUnavailableFeedback(false);
                }, 340);
            });
            return;
        }

        const playerMaxHp = levels.find((levelDef) => levelDef.level === playerProgress.level)?.hp ?? Math.max(playerProgress.hp, 1);
        setPotionCount((previous) => Math.max(0, previous - 1));
        healPlayer(playerMaxHp);
    }, [healPlayer, levels, playerProgress.hp, playerProgress.level, potionCount]);

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
        if (zoneIndex === null && !hasStartedDraggingElement) {
            setHasStartedDraggingElement(true);
        }

        if (zoneIndex === 0 && !hasSeenDropZoneOneTutorial) {
            setHasSeenDropZoneOneTutorial(true);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(DROP_ZONE_ONE_TUTORIAL_SEEN_KEY, "1");
            }
        }

        setZoneOccupants((previous) => {
            const next = previous.map((occupantId) =>
                occupantId === draggableId ? null : occupantId,
            );

            if (zoneIndex !== null) {
                next[zoneIndex] = draggableId;
            }

            return normalizeZoneOccupants(next);
        });
    };

    const canSnapToZone = (draggableId: number, zoneIndex: number) => {
        const draggable = draggables.find((item) => item.id === draggableId);
        if (!draggable) {
            return false;
        }

        const isPlasma = isPlasmaName(draggable.letter);
        const hasThreeSlots = zoneOccupants.length === 3;

        if (hasThreeSlots) {
            if (isPlasma && zoneIndex !== 1) {
                return false;
            }
            if (!isPlasma && zoneIndex === 1) {
                return false;
            }
        }

        if (!hasThreeSlots && draggable.level >= 2 && !isPlasma && !isUnstableName(draggable.letter)) {
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

    const handleDismissDragTutorial = useCallback(() => {
        if (hasSeenDragTutorial) {
            return;
        }

        setHasSeenDragTutorial(true);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(DRAG_TUTORIAL_SEEN_KEY, "1");
        }
    }, [hasSeenDragTutorial]);

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

    const handleIntroNameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = introNameInput.trim().slice(0, 28);
        if (trimmedName.length === 0) {
            return;
        }

        introChosenNameRef.current = trimmedName;
        setIsIntroInputFadingOut(true);
        await wait(INTRO_INPUT_FADE_MS);
        setPlayerName(trimmedName);
        setIsIntroInputFadingOut(false);
        setIntroPhase("line3");
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

    const startSoulCollectionAnimation = useCallback((soulsGained: number) => {
        const normalizedSouls = Math.max(0, Math.floor(soulsGained));
        if (normalizedSouls <= 0) {
            return;
        }

        clearSoulAnimationTimeouts();
        setSoulFlightIcons([]);

        const soulsTarget = document.querySelector("#Game .player-stats-dock .player-souls-copy") as HTMLElement | null;
        if (!soulsTarget) {
            addSouls(normalizedSouls);
            triggerSoulCounterPop();
            return;
        }

        const targetRect = soulsTarget.getBoundingClientRect();
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight / 2;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const iconCount = Math.max(1, Math.ceil(normalizedSouls / SOULS_PER_FLYING_ICON));
        const baseAmount = Math.floor(normalizedSouls / iconCount);
        const remainder = normalizedSouls - baseAmount * iconCount;
        const gainsPerIcon = Array.from({ length: iconCount }, (_, index) => (
            baseAmount + (index < remainder ? 1 : 0)
        ));

        const nextIcons: SoulFlightIcon[] = gainsPerIcon.map((_, index) => {
            const delayMs = index * SOUL_COLLECTION_STAGGER_MS;
            const horizontalJitter = (Math.random() - 0.5) * 170;
            const verticalArcLift = -70 - Math.random() * 120;
            return {
                id: soulFlightIdRef.current++,
                startX,
                startY,
                midX: (targetX - startX) * 0.56 + horizontalJitter,
                midY: (targetY - startY) * 0.5 + verticalArcLift,
                toX: targetX - startX,
                toY: targetY - startY,
                delayMs,
            };
        });

        setSoulPulseAmount(normalizedSouls);
        setIsSoulPulseVisible(true);

        const pulseTimeoutId = window.setTimeout(() => {
            setSoulFlightIcons(nextIcons);

            gainsPerIcon.forEach((amount, index) => {
                const hitTimeoutId = window.setTimeout(() => {
                    addSouls(amount);
                    triggerSoulCounterPop();
                }, index * SOUL_COLLECTION_STAGGER_MS + SOUL_COLLECTION_TRAVEL_MS);
                soulAnimationTimeoutsRef.current.push(hitTimeoutId);
            });

            const cleanupTimeoutId = window.setTimeout(() => {
                setSoulFlightIcons([]);
                soulAnimationTimeoutsRef.current = [];
            }, (iconCount - 1) * SOUL_COLLECTION_STAGGER_MS + SOUL_COLLECTION_TRAVEL_MS + 140);
            soulAnimationTimeoutsRef.current.push(cleanupTimeoutId);
        }, SOUL_COLLECTION_PULSE_MS);
        soulAnimationTimeoutsRef.current.push(pulseTimeoutId);

        const textHideTimeoutId = window.setTimeout(() => {
            setIsSoulPulseVisible(false);
        }, SOUL_COLLECTION_PULSE_MS + SOUL_COLLECTION_TEXT_EXTRA_MS);
        soulAnimationTimeoutsRef.current.push(textHideTimeoutId);
    }, [addSouls, clearSoulAnimationTimeouts, triggerSoulCounterPop]);

    const handleRewardConfirm = (selectedElement: RewardElement) => {
        if (!fightReward) {
            return;
        }

        if (rewardCueTimeoutRef.current !== null) {
            window.clearTimeout(rewardCueTimeoutRef.current);
            rewardCueTimeoutRef.current = null;
        }

        startSoulCollectionAnimation(fightReward.soulsGained);
        addElement(selectedElement);
        setFightReward(null);
        setIsFightVictoryCueVisible(false);
        navigate("/game", {
            replace: true,
            state: null,
        });
    };

    const isStartMenuOpen = playerProgress.elements.length === 0 && starterChoices.length > 0;
    const isIntroVisible = introPhase !== "hidden";
    const introDisplayName = introChosenNameRef.current || playerName || "Traveler";
    const introText =
        introPhase === "line1"
            ? "Oh - It's you!"
            : introPhase === "line2"
                ? "Remind me what your name was again?"
                : introPhase === "line3"
                    ? `You are the boss of this dungeon, ${introDisplayName}`
                    : introPhase === "line4"
                        ? "Defend this sanctuary with your life!"
                        : "";

    return (
        <div
            id="Game"
            ref={gameRef}
            onDragOver={handleGameDragOver}
            onDrop={handleGameDrop}
            style={{ position: "relative", width: "100%", height: "100%" }}
        >
            {potionSparkles.length > 0 ? (
                <div className="potion-sparkle-layer" aria-hidden="true">
                    {potionSparkles.map((sparkle) => (
                        <span
                            key={sparkle.id}
                            className="potion-sparkle"
                            style={{
                                left: `${sparkle.startX}px`,
                                top: `${sparkle.startY}px`,
                                animationDelay: `${sparkle.delayMs}ms`,
                                ["--potion-sparkle-x" as string]: `${sparkle.toX}px`,
                                ["--potion-sparkle-y" as string]: `${sparkle.toY}px`,
                            }}
                        >
                            ✦
                        </span>
                    ))}
                </div>
            ) : null}
            {isSoulPulseVisible ? (
                <div className="soul-pulse-cue" aria-hidden="true">
                    <img src={soulIcon} alt="" className="soul-pulse-cue-icon" />
                    <span className="soul-pulse-cue-text">+{soulPulseAmount} SOULS</span>
                </div>
            ) : null}
            {soulFlightIcons.length > 0 ? (
                <div className="soul-collection-layer" aria-hidden="true">
                    {soulFlightIcons.map((icon) => (
                        <img
                            key={icon.id}
                            src={soulIcon}
                            alt=""
                            className="soul-flight-icon"
                            style={{
                                left: `${icon.startX}px`,
                                top: `${icon.startY}px`,
                                animationDelay: `${icon.delayMs}ms`,
                                ["--soul-mid-x" as string]: `${icon.midX}px`,
                                ["--soul-mid-y" as string]: `${icon.midY}px`,
                                ["--soul-fly-x" as string]: `${icon.toX}px`,
                                ["--soul-fly-y" as string]: `${icon.toY}px`,
                            }}
                        />
                    ))}
                </div>
            ) : null}
            {isFightVictoryCueVisible ? (
                <div className="fight-victory-cue" role="status" aria-live="polite">
                    Victory! Claim your reward.
                </div>
            ) : null}
            {isIntroVisible ? (
                <div className={`game-intro-overlay ${introPhase === "fadeout" ? "is-fading-out" : ""}`}>
                    {introPhase === "input" ? (
                        <form
                            className={`game-intro-input-shell ${isIntroInputFadingOut ? "is-fading-out" : ""}`}
                            onSubmit={handleIntroNameSubmit}
                        >
                            <input
                                className="game-intro-input"
                                type="text"
                                maxLength={28}
                                placeholder="Name"
                                value={introNameInput}
                                onChange={(event) => setIntroNameInput(event.target.value)}
                            />
                            <button className="game-intro-submit" type="submit">
                                Enter
                            </button>
                        </form>
                    ) : introText.length > 0 ? (
                        <div className={`game-intro-line ${isIntroTextVisible ? "is-visible" : ""}`}>
                            {introText}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {draggables.map((draggable) => (
                <Draggable
                    key={draggable.id}
                    id={draggable.id}
                    letter={draggable.letter}
                    damage={draggable.damage}
                    energy={draggable.energy}
                    description={draggable.description}
                    showTutorialCue={draggable.id === 1 && !hasSeenDragTutorial}
                    onDismissTutorialCue={handleDismissDragTutorial}
                    type1={draggable.type1}
                    type2={draggable.type2}
                    effects={draggable.effects}
                    level={draggable.level}
                    containerRef={gameRef}
                    dropZoneRefs={activeDropZoneRefs}
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
                        <ElementIcon name={previewCombination.letter} />
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
                            <div className={`drop-zone ${hasStartedDraggingElement && !hasSeenDropZoneOneTutorial ? "is-discoverable" : ""}`} ref={dropZoneRefA}>1</div>
                            <div>+</div>
                            <div className="drop-zone" ref={dropZoneRefB}>2</div>
                            {zoneOccupants.length === 3 ? (
                                <>
                                    <div>+</div>
                                    <div className="drop-zone" ref={dropZoneRefC}>3</div>
                                </>
                            ) : null}
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
                        playerName={playerName}
                        level={playerProgress.level}
                        hp={playerProgress.hp}
                        potionCount={potionCount}
                        potionFillPercent={potionFillPercent}
                        onPotionClick={handlePotionClick}
                        isPotionUnavailableFeedback={isPotionUnavailableFeedback}
                        isPotionBrewedFlash={isPotionBrewedFlash}
                        souls={playerProgress.souls}
                        className={`player-stats-dock${isSoulCounterPopping ? " is-soul-counter-pop" : ""}`}
                    />
                </div>
            </div>
            <EnemyInfo 
                enemyName={nextEnemy?.name ?? "Unknown Enemy"} 
                enemyHealth={nextEnemy?.hp ?? 0}
                enemySouls={nextEnemy?.souls ?? 0}
                enemyDescription={nextEnemy?.description ?? ""}
                enemyWeaknesses={nextEnemy?.weaknesses ?? []}
                enemyElements={nextEnemy?.elements ?? []}
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
            {isDevElementPanelOpen ? (
                <aside className="dev-element-panel" aria-label="Developer element panel">
                    <div className="dev-element-panel__header">
                        <h3>Element Spawner</h3>
                        <button type="button" onClick={() => setIsDevElementPanelOpen(false)}>Close</button>
                    </div>
                    <p className="dev-element-panel__hint">Drag an element onto the game scene to spawn a copy.</p>
                    <div className="dev-element-panel__list">
                        {allElementOptions.map((element) => (
                            <button
                                key={`${element.letter}-${element.level}-${element.damage}`}
                                type="button"
                                className="dev-element-panel__item"
                                draggable
                                onDragStart={(event) => handleDevElementDragStart(event, element)}
                                title={`${element.letter} (${element.damage} DMG)`}
                            >
                                <ElementIcon name={element.letter} />
                                <span>{element.letter}</span>
                            </button>
                        ))}
                    </div>
                </aside>
            ) : null}
            {fightReward ? (
                <RewardModal
                    soulsGained={fightReward.soulsGained}
                    rewardElements={fightReward.rewardElements}
                    onConfirm={handleRewardConfirm}
                />
            ) : null}
        </div>
    );
}

export default Game;