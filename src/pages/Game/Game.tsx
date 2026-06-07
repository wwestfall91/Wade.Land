import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { useLocation, useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import EnemyStage from "../../components/EnemyStage";
import ElementIcon from "../../components/ElementIcon";
import { parseSpellEffectsFromRow, type SpellEffectConfig } from "../../combat/spellEffects";
import { getEffectChipClass, getEffectSummaryLines } from "../../combat/effectSummary";
import { type RewardElement, usePlayer } from "../../context/PlayerContext";
import { RewardFactory, type MonsterReward } from "../../combat/rewardFactory";
import FloatingTooltip from "./FloatingTooltip";
import CombinationStation, {
    COMBINATION_STATE_WORKBOOK_PATHS,
    getCombinationStationState,
    type CombinationStationActionStateKey,
    type CombinationStateEffectsLookup,
    type CombinationStateWorkbookRow,
} from "./CombinationStation";
import {
    STARTER_BUTTON_THEME_BY_TYPE,
    STARTER_BUTTON_THEME_DEFAULT,
} from "../../styles/elementThemes";
import RewardModal from "../Fight/RewardModal";
import MonsterUpgradeModal from "./MonsterUpgradeModal";
import soulIcon from "../../assets/icons/Soul.png";
import chestIcon from "../../assets/icons/Chest.png";
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
    category?: string;
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
    category?: string;
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
    Category?: string;
    category?: string;
};

type EnemyRow = {
    Name?: string;
    name?: string;
    HP?: number | string;
    hp?: number | string;
    Power?: number | string;
    power?: number | string;
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

type MonsterRewardRow = {
    Level?: number | string;
    level?: number | string;
    Souls?: number | string;
    souls?: number | string;
    Experience?: number | string;
    experience?: number | string;
};

type MonsterRewardThreshold = {
    level: number;
    souls: number;
};

type Enemy = {
    name: string;
    hp: number;
    power: number;
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
    isDamageEnhanced?: boolean;
    baseDamageBeforeEnhance?: number;
    isCombusted?: boolean;
    baseDamageBeforeCombust?: number;
    isSoulChoiceOutput?: boolean;
    energy?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
};

type ChestDefinition = {
    elements: RewardElement[];
    bonusSoulsMultiplier?: number;
    tooltip: string;
};

type FightRewardState = {
    soulsGained: number;
    rewardElements: RewardElement[];
    isChestReward?: boolean;
    chests?: ChestDefinition[];
};

type GameLocationState = {
    fightReward?: FightRewardState;
    battleEnded?: boolean;
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
const SOULS_PER_FLYING_ICON = 5;
const SOUL_COLLECTION_TRAVEL_MS = 620;
const SOUL_COLLECTION_STAGGER_MS = 82;
const SOUL_COLLECTION_PULSE_MS = 500;
const SOUL_COLLECTION_TEXT_EXTRA_MS = 500;
const ELEMENT_FLIGHT_TRAVEL_MS = 520;
const ELEMENT_FLIGHT_STAGGER_MS = 130;
const CHEST_REVEAL_FADEOUT_MS = 320;
const STARTER_LABEL_ANIM_MS = 520;
const ENABLE_FIRST_BATTLE_OLD_ONE_SCENE = false;
const COMBUST_DAMAGE_MULTIPLIER = 2.5;

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

type EnhanceSoulFlight = {
    id: number;
    startX: number;
    startY: number;
    toX: number;
    toY: number;
};

type ElementFlightIcon = {
    id: number;
    startX: number;
    startY: number;
    toX: number;
    toY: number;
    letter: string;
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

const getRandomElements = (elements: RewardElement[], count: number): RewardElement[] => {
    if (elements.length === 0) return [];
    return Array.from({ length: count }, () => elements[Math.floor(Math.random() * elements.length)]);
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
        spendSouls,
        addElement,
        healPlayer,
        levels,
        selectedEnemy: nextEnemy,
        setSelectedEnemy: setNextEnemy,
        applyTypeMultiplier,
        typeMultipliers,
        monsterSoulsFed: soulsFed,
        setMonsterSoulsFed: setSoulsFed,
        playerStatuses,
        applyShieldMultiplier,
        applySoakMultiplier,
        applyBurnMultiplier,
        shieldMultiplier,
        soakMultiplier,
        burnMultiplier,
        discoveredCraftedLetters,
        addDiscoveredCraftedLetter,
    } = usePlayer();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const elementStartRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const dropZoneRefC = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const enhanceSlotRef = useRef<HTMLDivElement | null>(null);
    const machineSlotRef = useRef<HTMLDivElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const feedAnimCounterRef = useRef(0);
    const eyesFlashTimerRef = useRef<number | null>(null);
    const rewardGlowTimerRef = useRef<number | null>(null);

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [combinationStateEffectsLookup, setCombinationStateEffectsLookup] = useState<CombinationStateEffectsLookup>({});
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [baseElements, setBaseElements] = useState<RewardElement[]>([]);
    const [allElementOptions, setAllElementOptions] = useState<RewardElement[]>([]);
    const [isDevElementPanelOpen, setIsDevElementPanelOpen] = useState(false);
    const [isFeedOverlayOpen, setIsFeedOverlayOpen] = useState(false);
    const [isFeedOverlayFadingOut, setIsFeedOverlayFadingOut] = useState(false);
    const [isSoulsPanelFlashing, setIsSoulsPanelFlashing] = useState(false);
    const [feedAnimations, setFeedAnimations] = useState<number[]>([]);
    const [isOldOneIntroTriggered, setIsOldOneIntroTriggered] = useState(false);
    const [isOldOneReturnLocked, setIsOldOneReturnLocked] = useState(false);
    const [oldOneFeedCount, setOldOneFeedCount] = useState(0);
    const [isOldOneSequenceRunning, setIsOldOneSequenceRunning] = useState(false);
    const [feedStoryText, setFeedStoryText] = useState<string | null>(null);
    const [isFeedStoryTextFading, setIsFeedStoryTextFading] = useState(false);
    const [isOldOneStirsModalVisible, setIsOldOneStirsModalVisible] = useState(false);
    const [isOldOneStirsModalFadingOut, setIsOldOneStirsModalFadingOut] = useState(false);
    const [isEnhanceStationUnlocked, setIsEnhanceStationUnlocked] = useState(false);
    const [enhanceSlotOccupantId, setEnhanceSlotOccupantId] = useState<number | null>(null);
    const [machineSlotOccupantId, setMachineSlotOccupantId] = useState<number | null>(null);
    const [eyesFlashRevision, setEyesFlashRevision] = useState(0);
    const [monsterThresholds, setMonsterThresholds] = useState<MonsterRewardThreshold[]>([]);
    const [rewardGlowRevision, setRewardGlowRevision] = useState(0);
    const [pendingUpgradeRewards, setPendingUpgradeRewards] = useState<MonsterReward[] | null>(null);
    const [newElementToasts, setNewElementToasts] = useState<Array<{ id: number; x: number; y: number; category?: string }>>([]);
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
    const [plasmaForcedSnap, setPlasmaForcedSnap] = useState<{ zone: number; version: number } | null>(null);
    const [isPreviewDragging, setIsPreviewDragging] = useState(false);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [isPreviewTooltipHovered, setIsPreviewTooltipHovered] = useState(false);
    const [isPreviewTooltipGraceOpen, setIsPreviewTooltipGraceOpen] = useState(false);
    const [isPreviewAltLockActive, setIsPreviewAltLockActive] = useState(false);
    const [isPreviewAltHeld, setIsPreviewAltHeld] = useState(false);
    const [previewHomePosition, setPreviewHomePosition] = useState<Position | null>(null);
    const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
    const [previewPointerOffset, setPreviewPointerOffset] = useState<Position>({ x: 0, y: 0 });
    const [introPhase, setIntroPhase] = useState<IntroPhase>(() => (playerName.trim().length > 0 ? "hidden" : "line1"));
    const [isIntroTextVisible, setIsIntroTextVisible] = useState(() => playerName.trim().length === 0);
    const [introNameInput, setIntroNameInput] = useState("");
    const [isIntroInputFadingOut, setIsIntroInputFadingOut] = useState(false);
    const [fightReward, setFightReward] = useState<FightRewardState | null>(null);
    const [isCombinationStationUnlocked, setIsCombinationStationUnlocked] = useState(true);
    const [isFightVictoryCueVisible, setIsFightVictoryCueVisible] = useState(false);
    const [isSoulPulseVisible, setIsSoulPulseVisible] = useState(false);
    const [soulPulseAmount, setSoulPulseAmount] = useState(0);
    const [isSoulCounterPopping, setIsSoulCounterPopping] = useState(false);
    const [isSoulPanelErrorFeedback, setIsSoulPanelErrorFeedback] = useState(false);
    const [hoveredInsertSlot, setHoveredInsertSlot] = useState<1 | 2 | null>(null);
    const [isCombineButtonHovered, setIsCombineButtonHovered] = useState(false);
    const [isPostBattleSoulSequenceActive, setIsPostBattleSoulSequenceActive] = useState(false);
    const [postBattleSoulFillDurationMs, setPostBattleSoulFillDurationMs] = useState(0);
    const [isOldOnePreludeActive, setIsOldOnePreludeActive] = useState(false);
    const [isOldOnePreludeBlackVisible, setIsOldOnePreludeBlackVisible] = useState(false);
    const [isOldOnePreludeTextVisible, setIsOldOnePreludeTextVisible] = useState(false);
    const [isOldOnePreludeEyesApproaching, setIsOldOnePreludeEyesApproaching] = useState(false);
    const [soulFlightIcons, setSoulFlightIcons] = useState<SoulFlightIcon[]>([]);
    const [enhanceSoulFlights, setEnhanceSoulFlights] = useState<EnhanceSoulFlight[]>([]);
    const [elementFlightIcons, setElementFlightIcons] = useState<ElementFlightIcon[]>([]);
    const [isChestRevealVisible, setIsChestRevealVisible] = useState(false);
    const [isChestRevealFadingOut, setIsChestRevealFadingOut] = useState(false);
    const [newChestElementIds, setNewChestElementIds] = useState<Set<number>>(new Set());
    const [isStarterChoiceOpen, setIsStarterChoiceOpen] = useState(false);
    const [starterChoiceElements, setStarterChoiceElements] = useState<RewardElement[]>([]);
    const [hoveredStarterChoiceIndex, setHoveredStarterChoiceIndex] = useState<number | null>(null);
    const [selectedStarterChoiceIndex, setSelectedStarterChoiceIndex] = useState<number | null>(null);
    const [isStarterChoiceConfirming, setIsStarterChoiceConfirming] = useState(false);
    const [pendingChoicePlaceholderId, setPendingChoicePlaceholderId] = useState<number | null>(null);
    const [starterChoiceNameCurrent, setStarterChoiceNameCurrent] = useState("");
    const [starterChoiceNameOutgoing, setStarterChoiceNameOutgoing] = useState<string | null>(null);
    const [starterChoiceNameRevision, setStarterChoiceNameRevision] = useState(0);
    const previewPositionRef = useRef<Position | null>(null);
    const previewPointerClientRef = useRef<Position>({ x: 0, y: 0 });
    const previewAltHeldRef = useRef(false);
    const previewTooltipGraceTimeoutRef = useRef<number | null>(null);
    const introChosenNameRef = useRef("");
    const nextId = useRef(1);
    const soulFlightIdRef = useRef(1);
    const elementCatalogRef = useRef<Map<string, RewardElement>>(new Map());
    const pendingDropSpawnByIdRef = useRef<Map<number, Position>>(new Map());
    const rewardCueTimeoutRef = useRef<number | null>(null);
    const soulAnimationTimeoutsRef = useRef<number[]>([]);
    const soulCounterPopTimeoutRef = useRef<number | null>(null);
    const soulPanelErrorTimeoutRef = useRef<number | null>(null);
    const enhanceSoulFlightIdRef = useRef(1);
    const enhanceSoulFlightTimeoutsRef = useRef<number[]>([]);
    const elementFlightIdRef = useRef(1);
    const elementFlightTimeoutsRef = useRef<number[]>([]);
    const hasShownInitialRewardModalRef = useRef(false);
    const levelZeroElementsRef = useRef<RewardElement[]>([]);
    const allElementOptionsRef = useRef<RewardElement[]>([]);
    const discoveredCraftedLettersRef = useRef<Set<string>>(new Set());
    const newElementToastIdRef = useRef(0);
    const starterChoiceButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const starterChoiceLabelTimeoutRef = useRef<number | null>(null);
    const oldOneSequenceTimeoutsRef = useRef<number[]>([]);

    const clearPreviewTooltipGraceTimeout = useCallback(() => {
        if (previewTooltipGraceTimeoutRef.current !== null) {
            window.clearTimeout(previewTooltipGraceTimeoutRef.current);
            previewTooltipGraceTimeoutRef.current = null;
        }
    }, []);

    const startPreviewTooltipGraceClose = useCallback(() => {
        setIsPreviewTooltipGraceOpen(true);
        clearPreviewTooltipGraceTimeout();
        previewTooltipGraceTimeoutRef.current = window.setTimeout(() => {
            setIsPreviewTooltipGraceOpen(false);
            previewTooltipGraceTimeoutRef.current = null;
        }, 450);
    }, [clearPreviewTooltipGraceTimeout]);

    const releasePreviewAltLock = useCallback((preserveTooltipHover = false) => {
        setIsPreviewAltLockActive(false);
        setIsPreviewAltHeld(false);
        previewAltHeldRef.current = false;
        if (!preserveTooltipHover) {
            setIsPreviewTooltipHovered(false);
        }
        setIsPreviewTooltipGraceOpen(false);
        clearPreviewTooltipGraceTimeout();
    }, [clearPreviewTooltipGraceTimeout]);

    useEffect(() => () => {
        if (rewardCueTimeoutRef.current !== null) {
            window.clearTimeout(rewardCueTimeoutRef.current);
        }
        if (soulCounterPopTimeoutRef.current !== null) {
            window.clearTimeout(soulCounterPopTimeoutRef.current);
        }
        if (soulPanelErrorTimeoutRef.current !== null) {
            window.clearTimeout(soulPanelErrorTimeoutRef.current);
        }
        enhanceSoulFlightTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        elementFlightTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        if (rewardGlowTimerRef.current !== null) {
            window.clearTimeout(rewardGlowTimerRef.current);
        }
        if (starterChoiceLabelTimeoutRef.current !== null) {
            window.clearTimeout(starterChoiceLabelTimeoutRef.current);
        }
        if (previewTooltipGraceTimeoutRef.current !== null) {
            window.clearTimeout(previewTooltipGraceTimeoutRef.current);
        }
        oldOneSequenceTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        oldOneSequenceTimeoutsRef.current = [];
    }, []);

    const clearOldOneSequenceTimeouts = useCallback(() => {
        oldOneSequenceTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        oldOneSequenceTimeoutsRef.current = [];
    }, []);

    const runOldOneAwakeningSequence = useCallback(() => {
        setIsOldOneSequenceRunning(true);
        setFeedStoryText("GOOD... PROTECT");
        setIsFeedStoryTextFading(false);

        clearOldOneSequenceTimeouts();

        const toMakeStrongId = window.setTimeout(() => {
            setIsFeedStoryTextFading(true);
            const swapTextId = window.setTimeout(() => {
                setFeedStoryText("I MAKE... STRONG");
                setIsFeedStoryTextFading(false);
            }, 700);
            oldOneSequenceTimeoutsRef.current.push(swapTextId);
        }, 1200);
        oldOneSequenceTimeoutsRef.current.push(toMakeStrongId);

        const fadeOutSecondLineId = window.setTimeout(() => {
            setIsFeedStoryTextFading(true);
        }, 3000);
        oldOneSequenceTimeoutsRef.current.push(fadeOutSecondLineId);

        const showStirsModalId = window.setTimeout(() => {
            setFeedStoryText(null);
            setIsFeedStoryTextFading(false);
            setIsOldOneStirsModalVisible(true);
            setIsOldOneStirsModalFadingOut(false);

            const hideStirsModalId = window.setTimeout(() => {
                setIsOldOneStirsModalFadingOut(true);
                const finalizeIntroId = window.setTimeout(() => {
                    setIsOldOneStirsModalVisible(false);
                    setIsOldOneStirsModalFadingOut(false);
                    setIsOldOneReturnLocked(false);
                    setIsOldOneSequenceRunning(false);
                }, 2000);
                oldOneSequenceTimeoutsRef.current.push(finalizeIntroId);
            }, 2000);

            oldOneSequenceTimeoutsRef.current.push(hideStirsModalId);
        }, 3800);
        oldOneSequenceTimeoutsRef.current.push(showStirsModalId);
    }, [clearOldOneSequenceTimeouts]);

    const startOldOneFirstBattleIntro = useCallback((options?: { skipTimerClear?: boolean }) => {
        if (!options?.skipTimerClear) {
            clearOldOneSequenceTimeouts();
        }
        setIsOldOneIntroTriggered(true);
        setIsOldOneReturnLocked(true);
        setOldOneFeedCount(0);
        setIsOldOneSequenceRunning(false);
        setFeedStoryText("FEED...");
        setIsFeedStoryTextFading(false);
        setIsOldOneStirsModalVisible(false);
        setIsOldOneStirsModalFadingOut(false);
        setIsFeedOverlayFadingOut(false);
        setIsFeedOverlayOpen(true);
    }, [clearOldOneSequenceTimeouts]);

    const startOldOneStoryPrelude = useCallback(() => {
        clearOldOneSequenceTimeouts();

        setIsOldOnePreludeActive(true);
        setIsOldOnePreludeBlackVisible(false);
        setIsOldOnePreludeTextVisible(false);
        setIsOldOnePreludeEyesApproaching(false);

        const blackFadeId = window.setTimeout(() => {
            setIsOldOnePreludeBlackVisible(true);
        }, 250);
        oldOneSequenceTimeoutsRef.current.push(blackFadeId);

        const textFadeId = window.setTimeout(() => {
            setIsOldOnePreludeTextVisible(true);
            // Story scene starts the moment FEED appears.
            startOldOneFirstBattleIntro({ skipTimerClear: true });
        }, 4200);
        oldOneSequenceTimeoutsRef.current.push(textFadeId);

        const eyesApproachId = window.setTimeout(() => {
            setIsOldOnePreludeEyesApproaching(true);
        }, 4350);
        oldOneSequenceTimeoutsRef.current.push(eyesApproachId);

        const finishPreludeId = window.setTimeout(() => {
            setIsOldOnePreludeActive(false);
            setIsOldOnePreludeBlackVisible(false);
            setIsOldOnePreludeTextVisible(false);
            setIsOldOnePreludeEyesApproaching(false);
        }, 6200);
        oldOneSequenceTimeoutsRef.current.push(finishPreludeId);
    }, [clearOldOneSequenceTimeouts, startOldOneFirstBattleIntro]);

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

    const triggerSoulPanelErrorFeedback = useCallback(() => {
        setIsSoulPanelErrorFeedback(false);
        window.requestAnimationFrame(() => {
            setIsSoulPanelErrorFeedback(true);
            if (soulPanelErrorTimeoutRef.current !== null) {
                window.clearTimeout(soulPanelErrorTimeoutRef.current);
            }

            soulPanelErrorTimeoutRef.current = window.setTimeout(() => {
                setIsSoulPanelErrorFeedback(false);
                soulPanelErrorTimeoutRef.current = null;
            }, 500);
        });
    }, []);

    const launchEnhanceSoulFlight = useCallback(() => {
        const soulsPanel = document.querySelector("#Game .player-stats-dock .player-souls-panel") as HTMLElement | null;
        const enhanceSlot = enhanceSlotRef.current;
        if (!soulsPanel || !enhanceSlot) {
            return;
        }

        const soulsIcon = soulsPanel.querySelector(".player-souls-icon") as HTMLElement | null;
        const startRect = (soulsIcon ?? soulsPanel).getBoundingClientRect();
        const targetRect = enhanceSlot.getBoundingClientRect();
        const startX = startRect.left + startRect.width / 2;
        const startY = startRect.top + startRect.height / 2;

        const shot: EnhanceSoulFlight = {
            id: enhanceSoulFlightIdRef.current++,
            startX,
            startY,
            toX: targetRect.left + targetRect.width / 2 - startX,
            toY: targetRect.top + targetRect.height / 2 - startY,
        };

        setEnhanceSoulFlights((previous) => [...previous, shot]);

        const cleanupTimeoutId = window.setTimeout(() => {
            setEnhanceSoulFlights((previous) => previous.filter((item) => item.id !== shot.id));
        }, 420);
        enhanceSoulFlightTimeoutsRef.current.push(cleanupTimeoutId);
    }, []);

    useEffect(() => () => {
        clearSoulAnimationTimeouts();
    }, [clearSoulAnimationTimeouts]);

    useEffect(() => {
        const syncAltState = (isAltPressed: boolean) => {
            previewAltHeldRef.current = isAltPressed;
            setIsPreviewAltHeld(isAltPressed);

            if (!isAltPressed) {
                releasePreviewAltLock(true);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            syncAltState(event.altKey || event.key === "Alt");
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            syncAltState(event.altKey);
        };

        const handlePointerMove = (event: PointerEvent) => {
            syncAltState(event.altKey);
        };

        const handleWindowBlur = () => {
            syncAltState(false);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                syncAltState(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        document.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        document.addEventListener("keyup", handleKeyUp, true);
        window.addEventListener("pointermove", handlePointerMove, true);
        window.addEventListener("blur", handleWindowBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
            document.removeEventListener("keyup", handleKeyUp, true);
            window.removeEventListener("pointermove", handlePointerMove, true);
            window.removeEventListener("blur", handleWindowBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [releasePreviewAltLock]);

    useEffect(() => {
        if (!isStarterChoiceOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isStarterChoiceOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
                e.preventDefault();
                navigate("/element-map");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [navigate]);

    useEffect(() => {
        const state = location.state as GameLocationState | null;
        if (state?.battleEnded || state?.fightReward) {
            setIsCombinationStationUnlocked(true);
        }

        if (state?.fightReward) {
            if (rewardCueTimeoutRef.current !== null) {
                window.clearTimeout(rewardCueTimeoutRef.current);
            }

            setFightReward(null);
            setIsFightVictoryCueVisible(true);
            rewardCueTimeoutRef.current = window.setTimeout(() => {
                const reward = state.fightReward;
                const soulsGained = reward?.soulsGained ?? 0;
                const shouldTriggerOldOneIntro = Boolean(
                    ENABLE_FIRST_BATTLE_OLD_ONE_SCENE && state?.battleEnded && !isOldOneIntroTriggered,
                );

                if (soulsGained > 0) {
                    startSoulCollectionAnimation(soulsGained, {
                        isPostBattleSequence: shouldTriggerOldOneIntro,
                        onComplete: () => {
                            if (shouldTriggerOldOneIntro) {
                                startOldOneStoryPrelude();
                            }
                        },
                    });
                } else if (shouldTriggerOldOneIntro) {
                    startOldOneStoryPrelude();
                }

                navigate("/game", {
                    replace: true,
                    state: null,
                });

                setIsFightVictoryCueVisible(false);
            }, REWARD_CUE_MS);
        }
    }, [isOldOneIntroTriggered, location.state, navigate, startOldOneStoryPrelude]);

    const activeDropZoneRefs = zoneOccupants.length === 3
        ? [dropZoneRefA, dropZoneRefB, dropZoneRefC]
        : [dropZoneRefA, dropZoneRefB];
    const allDropZoneRefs = [
        ...activeDropZoneRefs,
        ...(isEnhanceStationUnlocked ? [enhanceSlotRef] : []),
        machineSlotRef,
    ];

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
            if (sanitized.length <= 2) {
                // 2-slot case: preserve element positions so either slot can be filled independently
                return [sanitized[0] ?? null, sanitized[1] ?? null];
            }
            // Collapsing from 3-slot (plasma removed): pack remaining elements into the 2 slots
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
        const row = Math.floor(index / columns);

        return {
            x: startRect.left - containerRect.left + padding + (index % columns) * step,
            y: startRect.bottom - containerRect.top - padding - step - row * step,
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
                    level: (() => {
                            const raw = row.Level ?? row.level;
                            if (raw !== undefined && raw !== null && String(raw).trim() !== "") return Number(raw);
                            return (row["Element 1"] ?? "").trim().length === 0 ? 1 : 2;
                        })(),
                    description: (row.Description ?? row.description ?? "").trim(),
                    type1: normalizeType((row.Type1 || "") as string),
                    type2: normalizeType((row.Type2 || "") as string),
                    effects: parseSpellEffectsFromRow(row),
                    category: ((row.Category ?? row.category ?? "") as string).trim().toLowerCase(),
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
                    category: row.category,
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
                    category: row.category,
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
                    category: row.category,
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
                    category: row.category,
                })),
            );
        };

        const loadGameData = async () => {
            const elementsBuffer = await fetch("/elements.xlsx").then((res) => res.arrayBuffer());
            if (isCancelled) {
                return;
            }

            loadElements(elementsBuffer);

            const stateLookup: CombinationStateEffectsLookup = {};
            for (const [stateKey, workbookPath] of Object.entries(COMBINATION_STATE_WORKBOOK_PATHS) as Array<[CombinationStationActionStateKey, string]>) {
                const workbookBuffer = await fetch(workbookPath).then((res) => (res.ok ? res.arrayBuffer() : null));
                if (isCancelled) {
                    return;
                }

                if (!workbookBuffer) {
                    continue;
                }

                const workbook = XLSX.read(workbookBuffer, { type: "array" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const workbookRows = XLSX.utils.sheet_to_json<CombinationStateWorkbookRow>(worksheet);

                const effectsMap = new Map<string, SpellEffectConfig[]>();
                workbookRows.forEach((row) => {
                    const elementName = String(row.Element ?? "").trim();
                    if (elementName.length === 0) {
                        return;
                    }

                    const mappedEffectRow: Record<string, unknown> = {
                        "Effect 1 Kind": String(row.Effect ?? "").trim(),
                        "Effect 1 Amount": row["Effect Amt"] ?? "",
                        "Effect 1 Hits": row["Effect Hits"] ?? "",
                        "Effect 1 Duration": row["Effect Dur"] ?? "",
                        "Effect 1 Target": String(row["Effect Target"] ?? "").trim(),
                    };

                    const parsedEffects = parseSpellEffectsFromRow(mappedEffectRow, 1);
                    effectsMap.set(normalizeElementName(elementName), parsedEffects);
                });

                stateLookup[stateKey] = effectsMap;
            }
            setCombinationStateEffectsLookup(stateLookup);

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
                    power: Number(row.Power ?? row.power ?? 0) || 0,
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

            const monsterRewardsBuffer = await fetch("/monster_rewards.xlsx")
                .then((res) => (res.ok ? res.arrayBuffer() : null))
                .catch(() => null);
            if (isCancelled) return;

            if (monsterRewardsBuffer) {
                const monsterWb = XLSX.read(monsterRewardsBuffer, { type: "array" });
                const monsterWs = monsterWb.Sheets[monsterWb.SheetNames[0]];
                const monsterRows = XLSX.utils.sheet_to_json<MonsterRewardRow>(monsterWs);
                const parsed: MonsterRewardThreshold[] = monsterRows
                    .map((row) => ({
                        level: Number(row.Level ?? row.level ?? 0) || 0,
                        souls: Number(row.Souls ?? row.souls ?? row.Experience ?? row.experience ?? 0) || 0,
                    }))
                    .filter((row) => row.level > 0 && row.souls > 0)
                    .sort((a, b) => a.souls - b.souls);
                setMonsterThresholds(parsed);
            }
        };

        void loadGameData();

        return () => {
            isCancelled = true;
        };

    }, []);


    useEffect(() => {
        if (introPhase !== "hidden") {
            return;
        }

        if (hasShownInitialRewardModalRef.current) {
            return;
        }

        if (allElementOptions.length === 0) {
            return;
        }

        if (playerProgress.elements.length > 0) {
            return;
        }

        const state = location.state as GameLocationState | null;
        if (state?.fightReward) {
            return;
        }

        const starterElements = allElementOptions
            .filter((element) => element.level === 0 && element.category?.toLowerCase() === "element")
            .slice(0, 4);
        if (starterElements.length === 0) {
            return;
        }

        hasShownInitialRewardModalRef.current = true;
        setIsFightVictoryCueVisible(false);

        setStarterChoiceElements(starterElements);
        setHoveredStarterChoiceIndex(null);
        setSelectedStarterChoiceIndex(null);
        setIsStarterChoiceConfirming(false);
        setStarterChoiceNameCurrent("");
        setStarterChoiceNameOutgoing(null);
        setStarterChoiceNameRevision((current) => current + 1);
        setIsStarterChoiceOpen(true);
    }, [allElementOptions, introPhase, location.state, playerProgress.elements.length]);

    useEffect(() => {
        levelZeroElementsRef.current = allElementOptions.filter((e) => e.level === 0);
        allElementOptionsRef.current = allElementOptions;
    }, [allElementOptions]);

    useEffect(() => {
        discoveredCraftedLettersRef.current = discoveredCraftedLetters;
    }, [discoveredCraftedLetters]);

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
                        category: element.category,
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

        setEnhanceSlotOccupantId((previous) =>
            previous !== null && playerProgress.elements.some((element) => element.id === previous)
                ? previous
                : null,
        );

        setMachineSlotOccupantId((previous) =>
            previous !== null && playerProgress.elements.some((element) => element.id === previous)
                ? previous
                : null,
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
            if (event.ctrlKey && event.key === ".") {
                event.preventDefault();
                addSouls(10);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [addSouls]);

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

        const applyCombustPreview = (combination: PreviewCombination): PreviewCombination => {
            const hasCombust = combination.effects?.some((effect) => effect.kind === "explode") ?? false;
            if (!hasCombust) {
                return combination;
            }

            return {
                ...combination,
                damage: Math.round(combination.damage * COMBUST_DAMAGE_MULTIPLIER),
                isCombusted: true,
                baseDamageBeforeCombust: combination.damage,
            };
        };

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

            return applyCombustPreview({
                consumedIds,
                letter: `${otherItem.letter}+`,
                damage: otherItem.damage,
                energy: otherItem.energy,
                level: otherItem.level,
                description: otherItem.description,
                type1: unstableItem.type1,
                type2: unstableItem.type2,
                effects: unstableItem.effects,
            });
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

            return applyCombustPreview({
                consumedIds,
                letter: "Unstable Element",
                damage: 0,
                energy: combinedEnergy,
                level: 2,
                description: "Unstable fusion carrying the effects of both connected elements.",
                type1: mergedTypes[0],
                type2: mergedTypes[1],
                effects: sideEffects,
            });
        }

        const [leftItem, rightItem] = occupantItems;
        const leftIsUnstable = Boolean(leftItem && isUnstableName(leftItem.letter));
        const rightIsUnstable = Boolean(rightItem && isUnstableName(rightItem.letter));

        const leftIsSoul = Boolean(leftItem && normalizeElementName(leftItem.letter) === "soul");
        const rightIsSoul = Boolean(rightItem && normalizeElementName(rightItem.letter) === "soul");
        if (leftItem && rightItem && leftIsSoul && rightIsSoul) {
            return {
                consumedIds,
                letter: "?",
                damage: 0,
                isSoulChoiceOutput: true,
                energy: 0,
                level: 0,
                description: "An element of your choice",
                category: "element",
            };
        }

        if (leftItem && rightItem && leftIsUnstable !== rightIsUnstable) {
            const unstableItem = leftIsUnstable ? leftItem : rightItem;
            const otherItem = leftIsUnstable ? rightItem : leftItem;
            return buildUnstableCloneResult(unstableItem, otherItem);
        }

        if (!leftItem || !rightItem) {
            return null;
        }

        const state = getCombinationStationState(normalizeElementName(leftItem.letter));
        if (state.key === "idle") {
            return null;
        }

        if (state.key === "enhance") {
            return applyCombustPreview({
                consumedIds: [leftItem.id],
                letter: rightItem.letter,
                damage: Math.round(rightItem.damage * 1.5),
                isDamageEnhanced: true,
                baseDamageBeforeEnhance: rightItem.damage,
                energy: rightItem.energy,
                level: rightItem.level,
                description: rightItem.description,
                type1: rightItem.type1,
                type2: rightItem.type2,
                effects: rightItem.effects,
                category: rightItem.category,
            });
        }

        const stateEffects = combinationStateEffectsLookup[state.key];
        const rightElementKey = normalizeElementName(rightItem.letter);
        const mappedEffects = stateEffects?.get(rightElementKey);
        if (!mappedEffects) {
            return null;
        }

        return applyCombustPreview({
            consumedIds: [rightItem.id],
            letter: rightItem.letter,
            damage: rightItem.damage,
            energy: rightItem.energy,
            level: rightItem.level,
            description: rightItem.description,
            type1: rightItem.type1,
            type2: rightItem.type2,
            effects: mappedEffects,
            category: rightItem.category,
        });
    }, [combinationStateEffectsLookup, draggables, zoneOccupants]);

    const canCombine = previewCombination !== null;
    const firstSlottedDraggable = getDraggableById(zoneOccupants[0] ?? null);
    const firstSlotElementKey = normalizeElementName(firstSlottedDraggable?.letter);
    const firstSlotConnectorKey = normalizeType(firstSlottedDraggable?.type1) || firstSlotElementKey;
    const combinationStationState = getCombinationStationState(firstSlotElementKey);
    const hasActiveCombinationState = combinationStationState.key !== "idle";
    const areBothCombinationSlotsFilled = zoneOccupants[0] !== null && zoneOccupants[1] !== null;
    const isEnhanceCombinationReady = combinationStationState.key === "enhance"
        && areBothCombinationSlotsFilled;
    const isNonEnhanceCombinationReady = hasActiveCombinationState
        && combinationStationState.key !== "enhance"
        && areBothCombinationSlotsFilled;

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
            category: previewCombination.category,
        };

        nextId.current += 1;

        combineElements(previewCombination.consumedIds, newDraggable);

        if (previewCombination.isSoulChoiceOutput) {
            const starterElements = allElementOptionsRef.current
                .filter((element) => element.level === 0 && element.category?.toLowerCase() === "element");
            if (starterElements.length > 0) {
                setStarterChoiceElements(starterElements);
                setHoveredStarterChoiceIndex(null);
                setSelectedStarterChoiceIndex(null);
                setIsStarterChoiceConfirming(false);
                setStarterChoiceNameCurrent("");
                setStarterChoiceNameOutgoing(null);
                setStarterChoiceNameRevision((current) => current + 1);
                setPendingChoicePlaceholderId(newDraggable.id);
                setIsStarterChoiceOpen(true);
            }
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

        setZoneOccupants((previous) =>
            previous.map((occupantId) =>
                occupantId !== null && previewCombination.consumedIds.includes(occupantId)
                    ? null
                    : occupantId,
            ),
        );
        setIsPreviewDragging(false);
        setPreviewPosition(null);
        previewPositionRef.current = null;

        if (newDraggable.level > 0 && !discoveredCraftedLettersRef.current.has(newDraggable.letter)) {
            addDiscoveredCraftedLetter(newDraggable.letter);
            const toastId = newElementToastIdRef.current++;
            setNewElementToasts((previous) => [...previous, { id: toastId, x: targetPosition.x, y: targetPosition.y, category: newDraggable.category }]);
            window.setTimeout(() => {
                setNewElementToasts((previous) => previous.filter((t) => t.id !== toastId));
            }, 2600);
        }
    }, [addDiscoveredCraftedLetter, combineElements, getOutputCenterPosition, previewCombination]);

    useEffect(() => {
        if (previewCombination) {
            return;
        }

        setIsPreviewDragging(false);
        setIsPreviewHovered(false);
        setIsPreviewTooltipHovered(false);
        setIsPreviewTooltipGraceOpen(false);
        setIsPreviewAltLockActive(false);
        clearPreviewTooltipGraceTimeout();
        setPreviewHomePosition(null);
        setPreviewPosition(null);
        previewPositionRef.current = null;
    }, [clearPreviewTooltipGraceTimeout, previewCombination]);

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
        setIsPreviewTooltipGraceOpen(false);
        clearPreviewTooltipGraceTimeout();
        setIsPreviewHovered(false);
        setIsPreviewTooltipHovered(false);
        setIsPreviewAltLockActive(false);
        previewPositionRef.current = initial;
        setIsPreviewDragging(true);
    };

    const handlePreviewMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
        clearPreviewTooltipGraceTimeout();
        setIsPreviewTooltipGraceOpen(false);
        setIsPreviewHovered(true);

        if (event.altKey || isPreviewAltHeld || previewAltHeldRef.current) {
            previewAltHeldRef.current = true;
            setIsPreviewAltHeld(true);
            setIsPreviewAltLockActive(true);
        }
    };

    const handlePreviewMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
        setIsPreviewHovered(false);

        if (isPreviewAltLockActive && (isPreviewAltHeld || previewAltHeldRef.current || event.altKey)) {
            return;
        }

        if (isPreviewAltHeld || previewAltHeldRef.current || event.altKey) {
            startPreviewTooltipGraceClose();
            return;
        }

        setIsPreviewTooltipHovered(false);
        setIsPreviewTooltipGraceOpen(false);
        clearPreviewTooltipGraceTimeout();
    };

    const handlePreviewTooltipMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.altKey || isPreviewAltHeld || previewAltHeldRef.current) {
            previewAltHeldRef.current = true;
            setIsPreviewAltHeld(true);
            setIsPreviewAltLockActive(true);
        }

        if (!isPreviewAltHeld && !previewAltHeldRef.current && !event.altKey) {
            return;
        }

        clearPreviewTooltipGraceTimeout();
        setIsPreviewTooltipGraceOpen(false);
        setIsPreviewTooltipHovered(true);
    };

    const handlePreviewTooltipMouseLeave = () => {
        setIsPreviewTooltipHovered(false);

        if (isPreviewAltLockActive && (isPreviewAltHeld || previewAltHeldRef.current)) {
            return;
        }

        startPreviewTooltipGraceClose();
    };

    const isPreviewAltStickyOpen = isPreviewAltLockActive && isPreviewAltHeld;
    const isPreviewTooltipOpen = !isPreviewDragging && (isPreviewHovered || isPreviewTooltipHovered || isPreviewTooltipGraceOpen || isPreviewAltStickyOpen);

    const handleSnapChange = (draggableId: number, zoneIndex: number | null) => {
        const enhanceZoneIndex = zoneOccupants.length;
        const machineZoneIndex = zoneOccupants.length + (isEnhanceStationUnlocked ? 1 : 0);
        if (newChestElementIds.has(draggableId)) {
            setNewChestElementIds((prev) => {
                const next = new Set(prev);
                next.delete(draggableId);
                return next;
            });
        }

        if (zoneIndex === null && !hasStartedDraggingElement) {
            setHasStartedDraggingElement(true);
        }

        if (zoneIndex === 0 && !hasSeenDropZoneOneTutorial) {
            setHasSeenDropZoneOneTutorial(true);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(DROP_ZONE_ONE_TUTORIAL_SEEN_KEY, "1");
            }
        }

        if (zoneIndex === enhanceZoneIndex && isEnhanceStationUnlocked) {
            setEnhanceSlotOccupantId(draggableId);
            setMachineSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            setZoneOccupants((previous) => normalizeZoneOccupants(
                previous.map((occupantId) => (occupantId === draggableId ? null : occupantId)),
            ));
            return;
        }

        if (zoneIndex === machineZoneIndex) {
            setMachineSlotOccupantId(draggableId);
            setEnhanceSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            setZoneOccupants((previous) => normalizeZoneOccupants(
                previous.map((occupantId) => (occupantId === draggableId ? null : occupantId)),
            ));
            return;
        }

        setEnhanceSlotOccupantId((previous) => (previous === draggableId ? null : previous));
        setMachineSlotOccupantId((previous) => (previous === draggableId ? null : previous));

        setZoneOccupants((previous) => {
            const next = previous.map((occupantId) =>
                occupantId === draggableId ? null : occupantId,
            );

            if (zoneIndex !== null && zoneIndex < enhanceZoneIndex) {
                next[zoneIndex] = draggableId;
            }

            // When plasma drops to slot 0 in 2-slot mode, the layout will expand to 3
            // slots with plasma normalised to the middle (index 1). Schedule a forced
            // visual reposition so the tile moves to drop zone B (the middle slot).
            const droppedItem = draggables.find((item) => item.id === draggableId);
            if (
                zoneIndex === 0 &&
                previous.length < 3 &&
                droppedItem &&
                isPlasmaName(droppedItem.letter)
            ) {
                setPlasmaForcedSnap((prev) => ({ zone: 1, version: (prev?.version ?? 0) + 1 }));
            }

            return normalizeZoneOccupants(next);
        });
    };

    const canSnapToZone = (draggableId: number, zoneIndex: number) => {
        const draggable = draggables.find((item) => item.id === draggableId);
        if (!draggable) {
            return false;
        }

        const enhanceZoneIndex = zoneOccupants.length;
        const machineZoneIndex = zoneOccupants.length + (isEnhanceStationUnlocked ? 1 : 0);
        if (isEnhanceStationUnlocked && zoneIndex === enhanceZoneIndex) {
            return enhanceSlotOccupantId === null || enhanceSlotOccupantId === draggableId;
        }

        if (zoneIndex === machineZoneIndex) {
            if (draggable.category !== "soul") {
                return false;
            }

            return machineSlotOccupantId === null || machineSlotOccupantId === draggableId;
        }

        // Spells cannot be combined — block snapping entirely
        if (draggable.category === "spell") {
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

        const occupantId = zoneOccupants[zoneIndex];
        return occupantId === null || occupantId === draggableId;
    };

    const enhanceSlottedDraggable = getDraggableById(enhanceSlotOccupantId);
    const machineSlottedDraggable = getDraggableById(machineSlotOccupantId);
    const isEnhanceDisabled = !enhanceSlottedDraggable;

    const handleEnhanceClick = useCallback(() => {
        if (!enhanceSlottedDraggable) {
            return;
        }

        if (playerProgress.souls <= 0) {
            triggerSoulPanelErrorFeedback();
            return;
        }

        spendSouls(1);
        launchEnhanceSoulFlight();
    }, [enhanceSlottedDraggable, launchEnhanceSoulFlight, playerProgress.souls, spendSouls, triggerSoulPanelErrorFeedback]);

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

        setNewChestElementIds(new Set());

        // Fight the currently selected enemy and preselect the next row in order.
        const currentIndex = enemies.findIndex((enemy) => enemy.name === nextEnemy.name);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const fullEnemy = enemies[safeCurrentIndex] ?? nextEnemy;
        const nextIndex = (safeCurrentIndex + 1) % enemies.length;
        setNextEnemy(enemies[nextIndex]);

        navigate("/fight", {
            state: {
                enemy: fullEnemy,
                elementPool: allElementOptions,
            },
        });
    };

    const handleFeedClick = () => {
        setIsFeedOverlayFadingOut(false);
        setIsFeedOverlayOpen(true);
    };

    const handleFeedOverlayClose = () => {
        if (isOldOneReturnLocked) {
            return;
        }

        if (isFeedOverlayFadingOut) return;
        setIsFeedOverlayFadingOut(true);
        window.setTimeout(() => {
            setIsFeedOverlayOpen(false);
            setIsFeedOverlayFadingOut(false);

            if (isOldOneIntroTriggered && !isEnhanceStationUnlocked) {
                setIsEnhanceStationUnlocked(true);
            }
        }, 1000);
    };

    const handleFeedSpend = () => {
        if (playerProgress.souls <= 0) {
            if (isSoulsPanelFlashing) return;
            setIsSoulsPanelFlashing(true);
            window.setTimeout(() => setIsSoulsPanelFlashing(false), 600);
            return;
        }
        spendSouls(1);

        const prevFed = soulsFed;
        const nextFed = prevFed + 1;
        setSoulsFed(nextFed);

        if (isOldOneReturnLocked && !isOldOneSequenceRunning) {
            setOldOneFeedCount((previousCount) => {
                const nextCount = previousCount + 1;
                if (nextCount >= 5) {
                    runOldOneAwakeningSequence();
                }
                return nextCount;
            });
        }

        const crossed = isOldOneReturnLocked
            ? undefined
            : monsterThresholds.find((t) => nextFed >= t.souls && prevFed < t.souls);
        if (crossed) {
            const choices = RewardFactory.getRandom(3);
            setPendingUpgradeRewards(choices);
            if (rewardGlowTimerRef.current !== null) {
                window.clearTimeout(rewardGlowTimerRef.current);
            }
            setRewardGlowRevision((r) => r + 1);
            rewardGlowTimerRef.current = window.setTimeout(() => {
                setRewardGlowRevision(0);
                rewardGlowTimerRef.current = null;
            }, 3500);
        }

        const id = ++feedAnimCounterRef.current;
        setFeedAnimations((prev) => [...prev, id]);
        window.setTimeout(() => {
            setFeedAnimations((prev) => prev.filter((x) => x !== id));
            if (crossed) return;
            setEyesFlashRevision((r) => r + 1);
            if (eyesFlashTimerRef.current !== null) {
                window.clearTimeout(eyesFlashTimerRef.current);
            }
            eyesFlashTimerRef.current = window.setTimeout(() => {
                setEyesFlashRevision(0);
                eyesFlashTimerRef.current = null;
            }, 450);
        }, 280);
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

    const startSoulCollectionAnimation = useCallback((
        soulsGained: number,
        options?: {
            onComplete?: () => void;
            isPostBattleSequence?: boolean;
        },
    ) => {
        const onComplete = options?.onComplete;
        const isPostBattleSequence = options?.isPostBattleSequence ?? false;
        const normalizedSouls = Math.max(0, Math.floor(soulsGained));
        if (normalizedSouls <= 0) {
            setIsPostBattleSoulSequenceActive(false);
            onComplete?.();
            return;
        }

        clearSoulAnimationTimeouts();
        setSoulFlightIcons([]);

        // Souls become individual draggable items in the element-start area.
        // Show a single centred soul icon, then animate each soul to its spawn position.
        const containerRect = gameRef.current?.getBoundingClientRect();
        const startRect = elementStartRef.current?.getBoundingClientRect();

        const SOUL_CENTRE_LINGER_MS = 420;
        const SOUL_FLIGHT_DURATION_MS = 520;
        const SOUL_STAGGER_MS = 90;

        const totalDurationMs = SOUL_CENTRE_LINGER_MS + (normalizedSouls - 1) * SOUL_STAGGER_MS + SOUL_FLIGHT_DURATION_MS + 100;

        if (isPostBattleSequence) {
            setPostBattleSoulFillDurationMs(totalDurationMs);
            setIsPostBattleSoulSequenceActive(true);
        }

        setSoulPulseAmount(normalizedSouls);
        setIsSoulPulseVisible(true);

        const currentElementCount = playerProgress.elements.length;

        for (let i = 0; i < normalizedSouls; i++) {
            const spawnIndex = currentElementCount + i;
            let spawnPos: Position;

            if (containerRect && startRect) {
                const step = 44;
                const padding = 10;
                const columns = Math.max(1, Math.floor((startRect.width - padding * 2) / step));
                const row = Math.floor(spawnIndex / columns);
                spawnPos = {
                    x: startRect.left - containerRect.left + padding + (spawnIndex % columns) * step,
                    y: startRect.bottom - containerRect.top - padding - step - row * step,
                };
            } else {
                spawnPos = {
                    x: (spawnIndex % 3) * SPREAD_X,
                    y: Math.floor(spawnIndex / 3) * SPREAD_Y,
                };
            }

            const startX = window.innerWidth / 2;
            const startY = window.innerHeight / 2;
            const toX = containerRect
                ? (spawnPos.x + containerRect.left + 16) - startX
                : spawnPos.x - startX;
            const toY = containerRect
                ? (spawnPos.y + containerRect.top + 16) - startY
                : spawnPos.y - startY;

            const flightIcon: SoulFlightIcon = {
                id: soulFlightIdRef.current++,
                startX,
                startY,
                midX: toX * 0.5 + (Math.random() - 0.5) * 80,
                midY: toY * 0.5 - 60 - Math.random() * 60,
                toX,
                toY,
                delayMs: SOUL_CENTRE_LINGER_MS + i * SOUL_STAGGER_MS,
            };

            const launchTimeoutId = window.setTimeout(() => {
                setSoulFlightIcons((prev) => [...prev, flightIcon]);

                const landTimeoutId = window.setTimeout(() => {
                    setSoulFlightIcons((prev) => prev.filter((icon) => icon.id !== flightIcon.id));

                    const soulElement: RewardElement = {
                        letter: "Soul",
                        damage: 0,
                        energy: 0,
                        level: 1,
                        description: "A captured soul.",
                        category: "soul",
                    };

                    pendingDropSpawnByIdRef.current.set(
                        nextId.current,
                        spawnPos,
                    );
                    addElement(soulElement);
                }, SOUL_FLIGHT_DURATION_MS);

                soulAnimationTimeoutsRef.current.push(landTimeoutId);
            }, SOUL_CENTRE_LINGER_MS + i * SOUL_STAGGER_MS);

            soulAnimationTimeoutsRef.current.push(launchTimeoutId);
        }

        const textHideTimeoutId = window.setTimeout(() => {
            setIsSoulPulseVisible(false);
        }, SOUL_CENTRE_LINGER_MS + 600);
        soulAnimationTimeoutsRef.current.push(textHideTimeoutId);

        const doneTimeoutId = window.setTimeout(() => {
            if (isPostBattleSequence) {
                setIsPostBattleSoulSequenceActive(false);
            }
            onComplete?.();
            soulAnimationTimeoutsRef.current = [];
        }, totalDurationMs);
        soulAnimationTimeoutsRef.current.push(doneTimeoutId);
    }, [addElement, clearSoulAnimationTimeouts, playerProgress.elements.length]);

    const handleRewardConfirm = ({ elements, bonusSoulsMultiplier, sourceRect }: { elements: RewardElement[]; bonusSoulsMultiplier?: number; sourceRect?: DOMRect }) => {
        if (!fightReward) {
            return;
        }

        if (rewardCueTimeoutRef.current !== null) {
            window.clearTimeout(rewardCueTimeoutRef.current);
            rewardCueTimeoutRef.current = null;
        }

        const bonusSouls = bonusSoulsMultiplier ? Math.floor(fightReward.soulsGained * bonusSoulsMultiplier) : 0;
        const totalSouls = fightReward.soulsGained + bonusSouls;
        const isChestRewardPath = (fightReward.isChestReward ?? false) && elements.length > 0;
        hasShownInitialRewardModalRef.current = true;
        setFightReward(null);
        setIsFightVictoryCueVisible(false);
        navigate("/game", {
            replace: true,
            state: null,
        });

        if (isChestRewardPath) {
            setIsChestRevealVisible(true);
            setIsChestRevealFadingOut(false);
            const currentMaxId = playerProgress.elements.reduce((max, e) => Math.max(max, e.id), 0);
            const predictedNewIds = elements.map((_, i) => currentMaxId + 1 + i);
            setNewChestElementIds((prev) => {
                const next = new Set(prev);
                predictedNewIds.forEach((id) => next.add(id));
                return next;
            });
            const currentCount = playerProgress.elements.length;
            const containerRect = gameRef.current?.getBoundingClientRect();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const flightIcons: ElementFlightIcon[] = elements.map((el, i) => {
                const targetPos = getSpawnPosition(currentCount + i);
                const targetX = (containerRect?.left ?? 0) + targetPos.x + 16;
                const targetY = (containerRect?.top ?? 0) + targetPos.y + 16;
                return {
                    id: elementFlightIdRef.current++,
                    startX: centerX,
                    startY: centerY,
                    toX: targetX - centerX,
                    toY: targetY - centerY,
                    letter: el.letter,
                    delayMs: 150 + i * ELEMENT_FLIGHT_STAGGER_MS,
                };
            });

            setElementFlightIcons(flightIcons);

            elements.forEach((el, i) => {
                const landTimeoutId = window.setTimeout(() => {
                    addElement(el);
                }, flightIcons[i].delayMs + ELEMENT_FLIGHT_TRAVEL_MS);
                elementFlightTimeoutsRef.current.push(landTimeoutId);
            });

            const lastLandMs = 150 + (elements.length - 1) * ELEMENT_FLIGHT_STAGGER_MS + ELEMENT_FLIGHT_TRAVEL_MS;
            const fadeOutTimeoutId = window.setTimeout(() => {
                setElementFlightIcons([]);
                setIsChestRevealFadingOut(true);
            }, lastLandMs + 100);
            elementFlightTimeoutsRef.current.push(fadeOutTimeoutId);

            const cleanupTimeoutId = window.setTimeout(() => {
                elementFlightTimeoutsRef.current = [];
                setIsChestRevealVisible(false);
                setIsChestRevealFadingOut(false);
                startSoulCollectionAnimation(totalSouls);
            }, lastLandMs + 100 + CHEST_REVEAL_FADEOUT_MS);
            elementFlightTimeoutsRef.current.push(cleanupTimeoutId);
        } else {
            elements.forEach((e) => addElement(e));
            startSoulCollectionAnimation(totalSouls);
        }
    };

    const handleStarterChoiceSelect = (index: number) => {
        if (isStarterChoiceConfirming) {
            return;
        }

        setSelectedStarterChoiceIndex(index);
    };

    const handleConfirmStarterChoice = () => {
        if (selectedStarterChoiceIndex === null || isStarterChoiceConfirming) {
            return;
        }

        const chosenElement = starterChoiceElements[selectedStarterChoiceIndex];
        if (!chosenElement) {
            return;
        }

        const sourceRect = starterChoiceButtonRefs.current[selectedStarterChoiceIndex]?.getBoundingClientRect();
        const containerRect = gameRef.current?.getBoundingClientRect();
        const spawnPosition = getSpawnPosition(playerProgress.elements.length);
        const targetX = (containerRect?.left ?? 0) + spawnPosition.x + 16;
        const targetY = (containerRect?.top ?? 0) + spawnPosition.y + 16;
        const startX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
        const startY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight / 2;

        setIsStarterChoiceConfirming(true);
        setHoveredStarterChoiceIndex(null);
        setIsStarterChoiceOpen(false);
        const placeholderId = pendingChoicePlaceholderId;
        setElementFlightIcons([
            {
                id: elementFlightIdRef.current++,
                startX,
                startY,
                toX: targetX - startX,
                toY: targetY - startY,
                letter: chosenElement.letter,
                delayMs: 0,
            },
        ]);

        const landTimeoutId = window.setTimeout(() => {
            if (placeholderId !== null) {
                combineElements([placeholderId], {
                    id: placeholderId,
                    ...chosenElement,
                });
            } else {
                addElement(chosenElement);
            }
        }, ELEMENT_FLIGHT_TRAVEL_MS);

        const cleanupTimeoutId = window.setTimeout(() => {
            setElementFlightIcons([]);
            setStarterChoiceElements([]);
            setSelectedStarterChoiceIndex(null);
            setIsStarterChoiceConfirming(false);
            setPendingChoicePlaceholderId(null);
        }, ELEMENT_FLIGHT_TRAVEL_MS + 120);

        elementFlightTimeoutsRef.current.push(landTimeoutId, cleanupTimeoutId);
    };

    const hoveredStarterChoiceElement =
        hoveredStarterChoiceIndex !== null
            ? (starterChoiceElements[hoveredStarterChoiceIndex] ?? null)
            : null;
    const hasActiveUpgrades = Object.keys(typeMultipliers).length > 0 || shieldMultiplier > 1 || soakMultiplier > 1 || burnMultiplier > 1;
    const selectedStarterChoiceElement =
        selectedStarterChoiceIndex !== null
            ? (starterChoiceElements[selectedStarterChoiceIndex] ?? null)
            : null;
    const starterChoiceTypeKey = normalizeType(selectedStarterChoiceElement?.type1 ?? selectedStarterChoiceElement?.type2);
    const starterChoiceButtonTheme = STARTER_BUTTON_THEME_BY_TYPE[starterChoiceTypeKey] ?? STARTER_BUTTON_THEME_DEFAULT;
    const starterChoiceModalStyle = {
        ["--starter-modal-top" as string]: starterChoiceButtonTheme.top,
        ["--starter-modal-bottom" as string]: starterChoiceButtonTheme.bottom,
        ["--starter-modal-border" as string]: starterChoiceButtonTheme.border,
        ["--starter-modal-title-text" as string]: starterChoiceButtonTheme.text,
        ["--starter-modal-glow" as string]: starterChoiceButtonTheme.glow,
    } as React.CSSProperties;

    useEffect(() => {
        const nextName = selectedStarterChoiceElement?.letter ?? "";

        setStarterChoiceNameCurrent((currentName) => {
            if (currentName === nextName) {
                return currentName;
            }

            setStarterChoiceNameOutgoing(currentName.length > 0 ? currentName : null);
            setStarterChoiceNameRevision((current) => current + 1);

            if (starterChoiceLabelTimeoutRef.current !== null) {
                window.clearTimeout(starterChoiceLabelTimeoutRef.current);
            }

            starterChoiceLabelTimeoutRef.current = window.setTimeout(() => {
                setStarterChoiceNameOutgoing(null);
                starterChoiceLabelTimeoutRef.current = null;
            }, STARTER_LABEL_ANIM_MS);

            return nextName;
        });
    }, [selectedStarterChoiceElement]);

    const isIntroVisible = introPhase !== "hidden";
    const introDisplayName = introChosenNameRef.current || playerName || "Traveler";
    const introText =
        introPhase === "line1"
            ? "..."
            : introPhase === "line2"
                ? "... ?"
                : introPhase === "line3"
                    ? `${introDisplayName}... Feed...`
                    : introPhase === "line4"
                        ? "Feed... Me..."
                        : "";

    return (
        <div
            id="Game"
            ref={gameRef}
            onDragOver={handleGameDragOver}
            onDrop={handleGameDrop}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                ["--post-battle-soul-fill-ms" as string]: `${postBattleSoulFillDurationMs}ms`,
            }}
        >
            {isSoulPulseVisible ? (
                <div className="soul-pulse-cue" aria-hidden="true">
                    <img src={soulIcon} alt="" className="soul-pulse-cue-icon" />
                    <span className="soul-pulse-cue-text">+{soulPulseAmount} SOULS</span>
                </div>
            ) : null}
            {isOldOnePreludeActive ? (
                <div className={`old-one-prelude-overlay${isOldOnePreludeBlackVisible ? " is-black-visible" : ""}`} aria-hidden="true">
                    <div className={`feed-story-text old-one-prelude-text${isOldOnePreludeTextVisible ? " is-visible" : ""}`}>FEED...</div>
                    <div className={`old-one-prelude-eyes${isOldOnePreludeEyesApproaching ? " is-approaching" : ""}`}>
                        <span className="game-intro-eye game-intro-eye--left" />
                        <span className="game-intro-eye game-intro-eye--right" />
                    </div>
                </div>
            ) : null}
            {isChestRevealVisible ? (
                <div
                    className={`chest-reveal-overlay${isChestRevealFadingOut ? " is-fading-out" : ""}`}
                    aria-hidden="true"
                >
                    <img src={chestIcon} alt="" className="chest-reveal-icon" />
                </div>
            ) : null}
            {elementFlightIcons.length > 0 ? (
                <div className="element-flight-layer" aria-hidden="true">
                    {elementFlightIcons.map((icon) => (
                        <span
                            key={icon.id}
                            className="element-flight-icon"
                            style={{
                                left: `${icon.startX}px`,
                                top: `${icon.startY}px`,
                                animationDelay: `${icon.delayMs}ms`,
                                ["--elem-fly-x" as string]: `${icon.toX}px`,
                                ["--elem-fly-y" as string]: `${icon.toY}px`,
                            }}
                        >
                            <ElementIcon name={icon.letter} />
                        </span>
                    ))}
                </div>
            ) : null}
            {newElementToasts.map((toast) => (
                <div
                    key={toast.id}
                    className="new-element-toast"
                    style={{ left: toast.x + 16, top: toast.y }}
                    aria-hidden="true"
                >
                    New {toast.category}!
                </div>
            ))}
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
            {enhanceSoulFlights.length > 0 ? (
                <div className="enhance-soul-flight-layer" aria-hidden="true">
                    {enhanceSoulFlights.map((flight) => (
                        <img
                            key={flight.id}
                            src={soulIcon}
                            alt=""
                            className="enhance-soul-flight"
                            style={{
                                left: `${flight.startX}px`,
                                top: `${flight.startY}px`,
                                ["--enhance-soul-fly-x" as string]: `${flight.toX}px`,
                                ["--enhance-soul-fly-y" as string]: `${flight.toY}px`,
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
                    <div className={`game-intro-eyes${introPhase === "line4" || introPhase === "fadeout" ? " is-dismissing" : ""}`} aria-hidden="true">
                        <span className="game-intro-eye game-intro-eye--left" />
                        <span className="game-intro-eye game-intro-eye--right" />
                    </div>
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
            {isStarterChoiceOpen ? (
                <div className="starter-choice-overlay" role="dialog" aria-modal="true" aria-label="Starter choice">
                    <div className="starter-choice-modal" style={starterChoiceModalStyle}>
                        <div className={`starter-choice-grid${selectedStarterChoiceIndex !== null ? " has-selection" : ""}`}>
                            {starterChoiceElements.map((element, index) => (
                                <button
                                    key={`${element.letter}-${index}`}
                                    ref={(button) => { starterChoiceButtonRefs.current[index] = button; }}
                                    type="button"
                                    className={`starter-choice-element${selectedStarterChoiceIndex === index ? " is-selected" : ""}`}
                                    onClick={() => handleStarterChoiceSelect(index)}
                                    onMouseEnter={() => setHoveredStarterChoiceIndex(index)}
                                    onMouseLeave={() => setHoveredStarterChoiceIndex((current) => (current === index ? null : current))}
                                    onFocus={() => setHoveredStarterChoiceIndex(index)}
                                    onBlur={() => setHoveredStarterChoiceIndex((current) => (current === index ? null : current))}
                                    disabled={isStarterChoiceConfirming}
                                    aria-label={`Choose ${element.letter}`}
                                >
                                    <ElementIcon name={element.letter} />
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="starter-choice-confirm"
                            onClick={handleConfirmStarterChoice}
                            disabled={selectedStarterChoiceIndex === null || isStarterChoiceConfirming}
                        >
                            <span className="starter-choice-confirm-label" aria-live="polite">
                                {starterChoiceNameCurrent.length === 0 && !starterChoiceNameOutgoing ? (
                                    <span className="starter-choice-confirm-prefix">Make Your Choice</span>
                                ) : (
                                    <>
                                        <span className="starter-choice-confirm-prefix">I Choose</span>
                                        {starterChoiceNameOutgoing ? (
                                            <span className="starter-choice-confirm-text is-outgoing">{starterChoiceNameOutgoing}</span>
                                        ) : null}
                                        <span key={starterChoiceNameRevision} className="starter-choice-confirm-text is-current">{starterChoiceNameCurrent}</span>
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </div>
            ) : null}
            {isStarterChoiceOpen && hoveredStarterChoiceElement && hoveredStarterChoiceIndex !== null ? (
                <FloatingTooltip
                    anchorElement={starterChoiceButtonRefs.current[hoveredStarterChoiceIndex]}
                    open
                    className="start-menu-element-tooltip-shell"
                    clampHorizontal={false}
                    typeMultipliers={typeMultipliers}
                    elementDetails={{
                        letter: hoveredStarterChoiceElement.letter,
                        damage: hoveredStarterChoiceElement.damage,
                        energy: hoveredStarterChoiceElement.energy,
                        description: hoveredStarterChoiceElement.description,
                        type1: hoveredStarterChoiceElement.type1,
                        type2: hoveredStarterChoiceElement.type2,
                        effects: hoveredStarterChoiceElement.effects,
                        level: hoveredStarterChoiceElement.level,
                        category: hoveredStarterChoiceElement.category,
                    }}
                />
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
                    category={draggable.category}
                    containerRef={gameRef}
                    dropZoneRefs={allDropZoneRefs}
                    initialPosition={draggable.initialPosition}
                    onSnapChange={handleSnapChange}
                    canSnapToZone={canSnapToZone}
                    isNewFromChest={newChestElementIds.has(draggable.id)}
                    forcedSnapZone={isPlasmaName(draggable.letter) ? plasmaForcedSnap : null}
                />
            ))}

            {previewCombination ? (
                <>
                    <div
                        ref={previewRef}
                        className={[
                            "drag",
                            "drag-preview",
                            isPreviewDragging ? "is-dragging" : "",
                            previewCombination.category === "spell" ? "is-spell" : "",
                            previewCombination.category === "spell" ? `is-spell--${previewCombination.type1 || previewCombination.type2 || "none"}` : "",
                            previewCombination.category === "weapon" ? "is-weapon" : "",
                        ].filter(Boolean).join(" ")}
                        onPointerDown={handlePreviewPointerDown}
                        onMouseEnter={handlePreviewMouseEnter}
                        onMouseLeave={handlePreviewMouseLeave}
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
                        open={isPreviewTooltipOpen}
                        className="drag-description-popup"
                        interactive={isPreviewAltHeld}
                        onTooltipMouseEnter={handlePreviewTooltipMouseEnter}
                        onTooltipMouseLeave={handlePreviewTooltipMouseLeave}
                        clampHorizontal={false}
                        typeMultipliers={typeMultipliers}
                        elementDetails={(() => {
                            return {
                                letter: previewCombination.letter,
                                damage: previewCombination.damage,
                                isDamageEnhanced: previewCombination.isDamageEnhanced,
                                baseDamageBeforeEnhance: previewCombination.baseDamageBeforeEnhance,
                                isCombusted: previewCombination.isCombusted,
                                baseDamageBeforeCombust: previewCombination.baseDamageBeforeCombust,
                                description: previewCombination.description,
                                type1: previewCombination.type1,
                                type2: previewCombination.type2,
                                effects: previewCombination.effects,
                                category: previewCombination.category,
                            };
                        })()}
                    />
                </>
            ) : null}
            <div className="element-start" ref={elementStartRef}></div>
            <div className="game-scene-row">
                {hasActiveUpgrades ? (
                <div className="game-scene-col game-scene-col--left">
                    <div className="upgrades-panel" aria-label="Active upgrades">
                        <div className="upgrades-panel-title">Upgrades</div>
                        <ul className="upgrades-panel-list">
                            {Object.entries(typeMultipliers).map(([type, mult]) => (
                                <li key={type} className={`upgrades-panel-item type-${type}`}>
                                    <span className="upgrades-item-type">{type}</span>
                                    <span className="upgrades-item-value">×{mult.toFixed(1)}</span>
                                </li>
                            ))}
                            {shieldMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-shield">
                                    <span className="upgrades-item-type">shield gain</span>
                                    <span className="upgrades-item-value">×{shieldMultiplier.toFixed(1)}</span>
                                </li>
                            ) : null}
                            {soakMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-soak">
                                    <span className="upgrades-item-type">soak stacks</span>
                                    <span className="upgrades-item-value">×{soakMultiplier.toFixed(1)}</span>
                                </li>
                            ) : null}
                            {burnMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-burn">
                                    <span className="upgrades-item-type">burn stacks</span>
                                    <span className="upgrades-item-value">×{burnMultiplier.toFixed(1)}</span>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                </div>
                ) : null}
                
                <div className="game-controls-stack">
                    {isCombinationStationUnlocked ? (
                        <CombinationStation
                            zoneOccupants={zoneOccupants}
                            hasStartedDraggingElement={hasStartedDraggingElement}
                            hasSeenDropZoneOneTutorial={hasSeenDropZoneOneTutorial}
                            isEnhanceCombinationReady={isEnhanceCombinationReady}
                            isNonEnhanceCombinationReady={isNonEnhanceCombinationReady}
                            firstSlotConnectorKey={firstSlotConnectorKey}
                            hasActiveCombinationState={hasActiveCombinationState}
                            combinationStationState={combinationStationState}
                            canCombine={canCombine}
                            onCombine={handleCombine}
                            dropZoneRefA={dropZoneRefA}
                            dropZoneRefB={dropZoneRefB}
                            dropZoneRefC={dropZoneRefC}
                            outputRef={outputRef}
                            hoveredInsertSlot={hoveredInsertSlot}
                            onHoverInsertSlot={setHoveredInsertSlot}
                            isCombineButtonHovered={isCombineButtonHovered}
                            onCombineButtonHoverChange={setIsCombineButtonHovered}
                        />
                    ) : null}

                    {isEnhanceStationUnlocked ? (
                        <div className="enhance-station" aria-label="Enhance station">
                            <div className={`enhance-slot${enhanceSlottedDraggable ? " has-element" : ""}`} ref={enhanceSlotRef} aria-label="Enhance slot">
                                {enhanceSlottedDraggable ? <ElementIcon name={enhanceSlottedDraggable.letter} /> : "1"}
                            </div>
                            <div className={`enhance-button-wrap ${isEnhanceDisabled ? "is-disabled" : ""}`}>
                                <button type="button" className="enhance-button" disabled={isEnhanceDisabled} onClick={handleEnhanceClick}>
                                    <img src={soulIcon} alt="" aria-hidden="true" className="enhance-button-icon" />
                                    <span>ENHANCE</span>
                                </button>
                                <div className="enhance-button-tooltip" role="tooltip">
                                    Please insert an element
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="battle-station">
                        <PlayerStats
                            playerName={playerName}
                            level={playerProgress.level}
                            hp={playerProgress.hp}
                            souls={playerProgress.souls}
                            statuses={playerStatuses}
                            className={`player-stats-dock${isSoulCounterPopping ? " is-soul-counter-pop" : ""}${isPostBattleSoulSequenceActive ? " is-soul-fill-sequence" : ""}${isSoulPanelErrorFeedback ? " is-soul-panel-error" : ""}`}
                        />
                        {/* <button className="feed-button" onClick={handleFeedClick}>
                            FEED
                        </button> */}
                    </div>
                </div>
                <div className="game-scene-col game-scene-col--right">
                    <div className="game-enemy-card">
                        <div className="next-enemy-text">Next Enemy</div>
                        <div className="game-enemy-card-header">
                            <div className="game-enemy-card-name">{nextEnemy?.name ?? "Unknown Enemy"}</div>
                        </div>
                        <EnemyStage
                            className="game-enemy-stage"
                            enemyName={nextEnemy?.name ?? "Unknown Enemy"}
                            spritePath={nextEnemy?.sprite ?? ""}
                            enemyHealth={nextEnemy?.hp ?? 0}
                            enemyMaxHp={nextEnemy?.hp ?? 0}
                            enemyPower={nextEnemy?.power ?? 0}
                            weaknesses={nextEnemy?.weaknesses ?? []}
                            elements={nextEnemy?.elements ?? []}
                            souls={nextEnemy?.souls ?? 0}
                        />
                        <div className="game-enemy-card-footer">Hover for details</div>
                    </div>
                    <div className="game-enemy-actions">
                        <button className="fight-button" onClick={handleFight}>
                            FIGHT!
                        </button>
                    </div>
                </div>
            </div>
            {isDevElementPanelOpen ? (
                <aside className="dev-element-panel" aria-label="Developer element panel">
                    <div className="dev-element-panel__header">
                        <h3>Element Spawner</h3>
                        <button type="button" onClick={() => setIsDevElementPanelOpen(false)}>Close</button>
                    </div>
                    <p className="dev-element-panel__hint">Drag an element onto the game scene to spawn a copy.</p>
                    <div className="dev-element-panel__list">
                        {allElementOptions.map((element, index) => (
                            <button
                                key={`${element.letter}-${element.level}-${element.damage}-${index}`}
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
            {/* {fightReward ? (
                <RewardModal
                    soulsGained={fightReward.soulsGained ?? null}
                    rewardElements={fightReward.rewardElements ?? null}
                    isChestReward={fightReward.isChestReward ?? false}
                    chests={fightReward.chests ?? []}
                    onConfirm={handleRewardConfirm}
                />
            ) : null} */}
            {pendingUpgradeRewards ? (
                <MonsterUpgradeModal
                    rewards={pendingUpgradeRewards}
                    applyContext={{ applyTypeMultiplier, applyShieldMultiplier, applySoakMultiplier, applyBurnMultiplier }}
                    onConfirm={() => setPendingUpgradeRewards(null)}
                />
            ) : null}
            {isFeedOverlayOpen ? (
                <div
                    className={`feed-overlay${isFeedOverlayFadingOut ? " is-fading-out" : ""}`}
                    onClick={handleFeedOverlayClose}
                    aria-hidden="true"
                >
                    <div className="feed-overlay-eyes">
                        <div
                            key={rewardGlowRevision > 0 ? rewardGlowRevision : eyesFlashRevision}
                            className={`feed-eyes-inner${rewardGlowRevision > 0 ? " is-reward-glow" : eyesFlashRevision > 0 ? " is-soul-flash" : ""}`}
                            style={{ ["--upgrade-count" as string]: Object.keys(typeMultipliers).length }}
                        >
                            <span className="game-intro-eye game-intro-eye--left" />
                            <span className="game-intro-eye game-intro-eye--right" />
                        </div>
                    </div>
                    {feedAnimations.map((id) => (
                        <img
                            key={id}
                            src={soulIcon}
                            alt=""
                            aria-hidden="true"
                            className="feed-soul-fly"
                        />
                    ))}
                    {feedStoryText ? (
                        <div className={`feed-story-text${isFeedStoryTextFading ? " is-fading" : ""}`} aria-live="polite">
                            {feedStoryText}
                        </div>
                    ) : null}
                    {isOldOneStirsModalVisible ? (
                        <div className={`old-one-stirs-overlay${isOldOneStirsModalFadingOut ? " is-fading-out" : ""}`} aria-hidden="true">
                            <div className="old-one-stirs-modal">The old one stirs</div>
                        </div>
                    ) : null}
                    <div className="feed-overlay-actions" onClick={(e) => e.stopPropagation()}>
                        {/* <div className={`player-souls-panel${isSoulsPanelFlashing ? " player-souls-panel--flash" : ""}`} aria-label={`Souls ${playerProgress.souls}`} title="Souls are earned from victories and persist between battles.">
                            <img src={soulIcon} alt="" aria-hidden="true" className="player-souls-icon" />
                            <div className="player-souls-copy">
                                <span className="player-souls-label">SOULS</span>
                                <span className="player-souls-value">{playerProgress.souls}</span>
                            </div>
                        </div> */}
                        {/* <button
                            className="feed-button"
                            onClick={handleFeedSpend}
                            disabled={isOldOneSequenceRunning || isOldOneStirsModalVisible}
                            aria-label={isOldOneReturnLocked ? `Feed (${Math.min(oldOneFeedCount, 5)}/5)` : "Feed"}
                        >
                            FEED
                        </button> */}
                        {!isOldOneReturnLocked ? (
                            <button className="feed-overlay-return-button" onClick={handleFeedOverlayClose}>
                                RETURN
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Game;