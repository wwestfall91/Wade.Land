import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { HomunculusWorkbook, type HomunculusRow } from "./homunculusWorkbook";
import { useLocation, useNavigate } from "react-router";
import PlayerStats from "../../components/PlayerStats";
import EnemyStage from "../../components/EnemyStage";
import ElementIcon from "../../components/ElementIcon";
import { EFFECTS, parseSpellEffectsFromRow, type SpellEffectConfig } from "../../combat/spellEffects";
import {
    type CombinationModeKey,
    type ElementalResistanceKey,
    type ElementEnhancements,
    type RewardElement,
    usePlayer,
} from "../../context/PlayerContext";
import { type MonsterReward } from "../../combat/rewardFactory";
import FloatingTooltip from "./FloatingTooltip";
import ComparisonTooltip from "./ComparisonTooltip";
import PreviewOutputTooltip from "./PreviewOutputTooltip";
import CombinationStation, {
    COMBINATION_STATE_WORKBOOK_PATHS,
    getCombinationStationState,
    type CombinationStationActionStateKey,
    type CombinationStateEffectsLookup,
    type CombinationStateWorkbookRow,
    type ModeTabElementKey,
} from "./CombinationStation";
import {
    buildEffectValuesByKey,
    buildMappedEffectRow,
    resolveCombinationPreviewFromEffects,
    type EffectWorkbookRow,
    type EffectWorkbookValues,
} from "./combinationEffectLookup";
import { mergeEnhancements } from "./combinationCalculations";
import type { Position, DraggableItem, PreviewCombination } from "./combinationTypes";
import type { ModePreviewContext } from "./combinationModeRules";
import {
    combinationStationRulesEngine,
    withBrittleFormulaConsumedIds,
} from "./CombinationStationRulesEngine";
import {
    STARTER_BUTTON_THEME_BY_TYPE,
    ELEMENT_SPELL_COLORS,
    STARTER_BUTTON_THEME_DEFAULT,
} from "../../styles/elementThemes";
import { buildCombinedTripleFragmentElement } from "./consumeRewards";
import BossCountdown from "./BossCountdown";
import MonsterUpgradeModal from "./MonsterUpgradeModal";
import { LevelUpModal } from "../Fight/LevelUpModal";
import soulIcon from "../../assets/icons/Soul.png";
import chestIcon from "../../assets/icons/Chest.png";
import slotIcon from "../../assets/icons/Slot.png";
import fragmentSlotIcon from "../../assets/icons/Fragment Slot.png";
import powerIcon from "../../assets/icons/Power.png";
import shieldIcon from "../../assets/icons/Shield.png";
import "./Game.scss";
import "./SpellSlots.scss";

// TODO: Add special effects (Healing, burn, multi-hit)
// TODO: Balance the current state to be fun
// TODO: Add combos to battles

type ElementRow = {
    [key: string]: unknown;
    name?: string;
    Name?: string;
    ["Element 1"]?: string;
    ["Element 2"]?: string;
    damage?: number | string;
    Damage?: number | string;
    shield?: number | string;
    Shield?: number | string;
    energy?: number | string;
    Energy?: number | string;
    Rank?: number | string;
    rank?: number | string;
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
    resistances?: Partial<Record<string, number>>;
    baseElement?: RewardElement;
    homunculusFragments?: RewardElement[];
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

type LevelUpEffectEntry = {
    config: SpellEffectConfig;
    types: string[];
};

type PendingLevelUp = {
    elementId: number;
    elementPreview: RewardElement;
    elementLetter: string;
    elementType1?: string;
    elementType2?: string;
    newLevel: number;
    choices: SpellEffectConfig[];
};

type GameLocationState = {
    fightReward?: FightRewardState;
    battleEnded?: boolean;
    elementUseCounts?: Record<number, number>;
    defeatedEnemy?: Enemy;
};

const SPREAD_X = 200;
const SPREAD_Y = 150;
const DRAG_TUTORIAL_SEEN_KEY = "game.dragTutorialSeen";
const DROP_ZONE_ONE_TUTORIAL_SEEN_KEY = "game.dropZoneOneTutorialSeen";
const DEFERRED_JOBS_STORAGE_KEY = "game.deferredJobs";
const MODE_OUTPUT_STORAGE_KEY = "game.modeOutputElementIds";
const INTRO_TEXT_VISIBLE_MS = 1850;
const INTRO_TEXT_FADE_GAP_MS = 850;
const INTRO_INPUT_FADE_MS = 640;
const INTRO_SCENE_FADEOUT_MS = 1600;
const REWARD_CUE_MS = 260;
const ELEMENT_FLIGHT_TRAVEL_MS = 520;
const STARTER_LABEL_ANIM_MS = 520;
const MODE_SHUTTER_CLOSE_MS = 180;
const MODE_COLLAPSE_ANIMATION_MS = 420;
const ENABLE_FIRST_BATTLE_OLD_ONE_SCENE = false;
// Set to true to re-enable the level-up effect-choice modal (see LevelUpModal).
const ENABLE_LEVEL_UP_MODAL = false;
const COMBUST_DAMAGE_MULTIPLIER = 2.5;
const PREVIEW_DRAG_START_THRESHOLD_PX = 6;
const HOMUNCULUS_CREATE_ANIMATION_MS = 2000;
const BOSS_COUNTDOWN_KEY = "game.bossCountdown";
/** Number of regular battles before the first boss fight. */
const BOSS_BATTLE_THRESHOLD = 10;

// ── Draggable overlap separation ─────────────────────────────────────────────
// Elements are 32×32 px. Fragments are CSS-scaled to 50% (16×16 visual) but
// their layout box is still 32×32; the visual area is centred with an 8px
// offset on each side.
const ELEMENT_VISUAL_SIZE = 32;
const FRAGMENT_VISUAL_SIZE = 16;
const FRAGMENT_VISUAL_OFFSET = (ELEMENT_VISUAL_SIZE - FRAGMENT_VISUAL_SIZE) / 2; // 8

function separateOverlappingDraggables(
    items: DraggableItem[],
    slottedIds: ReadonlySet<number>,
): { draggables: DraggableItem[]; movedIds: Set<number> } {
    const free = items.filter((d) => !slottedIds.has(d.id));
    if (free.length < 2) {
        return { draggables: items, movedIds: new Set() };
    }

    const positions = new Map<number, Position>(
        free.map((d) => [d.id, { ...d.initialPosition }]),
    );

    const MAX_ITERATIONS = 24;
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let hadOverlap = false;

        for (let i = 0; i < free.length; i++) {
            for (let j = i + 1; j < free.length; j++) {
                const a = free[i];
                const b = free[j];
                const pa = positions.get(a.id)!;
                const pb = positions.get(b.id)!;

                const sA = a.category === "fragment" ? FRAGMENT_VISUAL_SIZE : ELEMENT_VISUAL_SIZE;
                const oA = a.category === "fragment" ? FRAGMENT_VISUAL_OFFSET : 0;
                const sB = b.category === "fragment" ? FRAGMENT_VISUAL_SIZE : ELEMENT_VISUAL_SIZE;
                const oB = b.category === "fragment" ? FRAGMENT_VISUAL_OFFSET : 0;

                const ax1 = pa.x + oA; const ay1 = pa.y + oA;
                const ax2 = ax1 + sA; const ay2 = ay1 + sA;
                const bx1 = pb.x + oB; const by1 = pb.y + oB;
                const bx2 = bx1 + sB; const by2 = by1 + sB;

                const penX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
                const penY = Math.min(ay2, by2) - Math.max(ay1, by1);
                if (penX <= 0 || penY <= 0) continue;

                hadOverlap = true;
                const pushX = Math.ceil(penX / 2);
                const pushY = Math.ceil(penY / 2);

                if (penX <= penY) {
                    if (ax1 <= bx1) {
                        positions.set(a.id, { ...pa, x: pa.x - pushX });
                        positions.set(b.id, { ...pb, x: pb.x + pushX });
                    } else {
                        positions.set(a.id, { ...pa, x: pa.x + pushX });
                        positions.set(b.id, { ...pb, x: pb.x - pushX });
                    }
                } else {
                    if (ay1 <= by1) {
                        positions.set(a.id, { ...pa, y: pa.y - pushY });
                        positions.set(b.id, { ...pb, y: pb.y + pushY });
                    } else {
                        positions.set(a.id, { ...pa, y: pa.y + pushY });
                        positions.set(b.id, { ...pb, y: pb.y - pushY });
                    }
                }
            }
        }

        if (!hadOverlap) break;
    }

    const movedIds = new Set<number>();
    const updated = items.map((d) => {
        const newPos = positions.get(d.id);
        if (!newPos) return d;
        if (newPos.x === d.initialPosition.x && newPos.y === d.initialPosition.y) return d;
        movedIds.add(d.id);
        return { ...d, initialPosition: newPos };
    });

    return { draggables: updated, movedIds };
}

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
const RESISTANCE_ELEMENT_KEYS = ["fire", "water", "earth", "air"] as const;
const RESISTANCE_COUNTER_TYPE: Record<ElementalResistanceKey, ElementalResistanceKey> = {
    fire: "water",
    water: "fire",
    earth: "air",
    air: "earth",
};

const resolveResistanceElementType = (type1?: string, letter?: string): ElementalResistanceKey | null => {
    const candidates = [normalizeType(type1), normalizeType(letter)];
    for (const candidate of candidates) {
        if (candidate === "fire" || candidate === "water" || candidate === "earth" || candidate === "air") {
            return candidate;
        }
    }

    return null;
};
const isModeTabElementKey = (value: string): value is ModeTabElementKey =>
    value === "water" || value === "fire" || value === "earth" || value === "air" || value === "soul";
const MODE_SENTINEL_IDS: Record<ModeTabElementKey, number> = {
    water: -101,
    fire: -102,
    earth: -103,
    air: -104,
    soul: -105,
};
const MODE_KEY_BY_SENTINEL_ID: Record<number, ModeTabElementKey> = {
    [-101]: "water",
    [-102]: "fire",
    [-103]: "earth",
    [-104]: "air",
    [-105]: "soul",
};
const isModeSentinelId = (value: number | null | undefined): value is number =>
    typeof value === "number" && value <= -100;
const getModeSentinelId = (elementKey: ModeTabElementKey): number => MODE_SENTINEL_IDS[elementKey];
const getModeKeyFromSentinelId = (value: number | null | undefined): ModeTabElementKey | null =>
    isModeSentinelId(value) ? (MODE_KEY_BY_SENTINEL_ID[value] ?? null) : null;

const isPlasmaName = (value?: string): boolean => normalizeElementName(value) === "plasma";
const isUnstableName = (value?: string): boolean => {
    const normalized = normalizeElementName(value).replace(/[^a-z0-9]+/g, "");
    return normalized === "unstable" || normalized === "unstableelement";
};
const wait = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
});

const resolvePublicAssetUrl = (assetPath: string): string => {
    const normalized = assetPath.replace(/^\/+/, "");
    return `${import.meta.env.BASE_URL}${normalized}`;
};

const isSuccessfulResponse = (response: Response): boolean =>
    typeof response.ok === "boolean" ? response.ok : true;

// Homunculus sprites — populated when files are added to src/assets/homunculus/.
const homunculusSpriteModules = import.meta.glob("../../assets/homunculus/*", {
    eager: true,
    import: "default",
}) as Record<string, string>;

const resolveHomunculusSpriteUrl = (name: string): string | null => {
    const key = name.replace(/\s+/g, "").toLowerCase();
    const entry = Object.entries(homunculusSpriteModules).find(([path]) => {
        const fileName = path.split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
        return fileName === key;
    });
    return entry ? entry[1] : null;
};

type IntroPhase = "hidden" | "line1" | "line2" | "input" | "line3" | "line4" | "fadeout";

function Game() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        player: playerProgress,
        player,
        playerName,
        setPlayerName,
        combineElements,
        combineElementsMultiple,
        consumeElements,
        addSouls,
        spendSouls,
        addElement,
        selectedEnemy: nextEnemy,
        setSelectedEnemy: setNextEnemy,
        applyTypeMultiplier,
        typeMultipliers,
        playerStatuses,
        applyShieldMultiplier,
        applySoakMultiplier,
        applyBurnMultiplier,
        shieldMultiplier,
        soakMultiplier,
        burnMultiplier,
        discoveredCraftedLetters,
        addDiscoveredCraftedLetter,
        updateElementEffects,
        sealedCombinationModes,
        sealCombinationMode,
        unsealCombinationMode,
        levels,
        recordElementUses,
        upgradeElement,
        levelUpElementOnly,
        spellSlots,
        setSpellSlotElement,
        addSpellSlot,
        setElementalResistance,
        lockedModes,
        unlockMode,
    } = usePlayer();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const elementStartRef = useRef<HTMLDivElement | null>(null);
    const fragmentStartRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const dropZoneRefC = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const outputRef2 = useRef<HTMLDivElement | null>(null);
    const enhanceSlotRef = useRef<HTMLDivElement | null>(null);
    const machineSlotRef = useRef<HTMLDivElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const previewRef2 = useRef<HTMLDivElement | null>(null);
    const spellSlotRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
    const createBaseSlotRef = useRef<HTMLDivElement | null>(null);
    const createElemSlotRef0 = useRef<HTMLDivElement | null>(null);
    const createElemSlotRef1 = useRef<HTMLDivElement | null>(null);
    const createElemSlotRef2 = useRef<HTMLDivElement | null>(null);
    const unlockSlotRef0 = useRef<HTMLDivElement | null>(null);
    const unlockSlotRef1 = useRef<HTMLDivElement | null>(null);
    const unlockSlotRef2 = useRef<HTMLDivElement | null>(null);
    const createHomunculusTimeoutRef = useRef<number | null>(null);

    const [draggables, setDraggables] = useState<DraggableItem[]>([]);
    const [combinationStateEffectsLookup, setCombinationStateEffectsLookup] = useState<CombinationStateEffectsLookup>({});
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [allElementOptions, setAllElementOptions] = useState<RewardElement[]>([]);
    const [isDevElementPanelOpen, setIsDevElementPanelOpen] = useState(false);
    const [isFeedOverlayOpen, setIsFeedOverlayOpen] = useState(false);
    const [isFeedOverlayFadingOut, setIsFeedOverlayFadingOut] = useState(false);
    const [feedAnimations] = useState<number[]>([]);
    const [isOldOneIntroTriggered, setIsOldOneIntroTriggered] = useState(false);
    const [isOldOneReturnLocked, setIsOldOneReturnLocked] = useState(false);
    const [, setIsOldOneSequenceRunning] = useState(false);
    const [feedStoryText, setFeedStoryText] = useState<string | null>(null);
    const [isFeedStoryTextFading, setIsFeedStoryTextFading] = useState(false);
    const [isOldOneStirsModalVisible, setIsOldOneStirsModalVisible] = useState(false);
    const [isOldOneStirsModalFadingOut, setIsOldOneStirsModalFadingOut] = useState(false);
    const [isEnhanceStationUnlocked, setIsEnhanceStationUnlocked] = useState(false);
    const [enhanceSlotOccupantId, setEnhanceSlotOccupantId] = useState<number | null>(null);
    const [machineSlotOccupantId, setMachineSlotOccupantId] = useState<number | null>(null);
    const [eyesFlashRevision] = useState(0);
    const [, setMonsterThresholds] = useState<MonsterRewardThreshold[]>([]);
    const [rewardGlowRevision] = useState(0);
    const [pendingUpgradeRewards, setPendingUpgradeRewards] = useState<MonsterReward[] | null>(null);
    const [levelUpEffectPool, setLevelUpEffectPool] = useState<LevelUpEffectEntry[]>([]);
    const [pendingElementUseCounts, setPendingElementUseCounts] = useState<Record<number, number> | null>(null);
    const [pendingLevelUps, setPendingLevelUps] = useState<PendingLevelUp[]>([]);
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
    const zoneOccupantsRef = useRef<Array<number | null>>([null, null]);
    const [returnHomeVersions, setReturnHomeVersions] = useState<Record<number, number>>({});
    const [plasmaForcedSnap, setPlasmaForcedSnap] = useState<{ zone: number; version: number } | null>(null);
    const [modeTransformForcedSnap, setModeTransformForcedSnap] = useState<{ id: number; version: number } | null>(null);
    /** Forces spell-slot elements back to their slots after Game remounts from a fight. */
    const [spellSlotForcedSnaps, setSpellSlotForcedSnaps] = useState<Record<number, { zone: number; version: number }>>({});
    const [isPreviewDragging, setIsPreviewDragging] = useState(false);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [isPreviewTooltipHovered, setIsPreviewTooltipHovered] = useState(false);
    const [isPreviewTooltipGraceOpen, setIsPreviewTooltipGraceOpen] = useState(false);
    const [isPreviewTooltipPinned, setIsPreviewTooltipPinned] = useState(false);
    const [isPreviewAltLockActive, setIsPreviewAltLockActive] = useState(false);
    const [isPreviewAltHeld, setIsPreviewAltHeld] = useState(false);
    const [isPreviewPointerDown, setIsPreviewPointerDown] = useState(false);
    const [previewHomePosition, setPreviewHomePosition] = useState<Position | null>(null);
    const [previewHomePosition2, setPreviewHomePosition2] = useState<Position | null>(null);
    const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
    const [previewPointerOffset, setPreviewPointerOffset] = useState<Position>({ x: 0, y: 0 });
    const [introPhase, setIntroPhase] = useState<IntroPhase>(() => (playerName.trim().length > 0 ? "hidden" : "line1"));
    const [isIntroTextVisible, setIsIntroTextVisible] = useState(() => playerName.trim().length === 0);
    const [introNameInput, setIntroNameInput] = useState("");
    const [isIntroInputFadingOut, setIsIntroInputFadingOut] = useState(false);
    const [, setFightReward] = useState<FightRewardState | null>(null);
    const [isCombinationStationUnlocked, setIsCombinationStationUnlocked] = useState(true);
    const [isFightVictoryCueVisible, setIsFightVictoryCueVisible] = useState(false);
    const [isSoulPulseVisible, setIsSoulPulseVisible] = useState(false);
    const [soulPulseAmount, setSoulPulseAmount] = useState(0);
    const [battlesCompleted, setBattlesCompleted] = useState(() => {
        try {
            return Math.max(0, parseInt(window.localStorage.getItem(BOSS_COUNTDOWN_KEY) ?? "0", 10) || 0);
        } catch {
            return 0;
        }
    });
    const [warriorAnimateVersion, setWarriorAnimateVersion] = useState(0);
    const [bossIndex, setBossIndex] = useState(0);
    const [bossTransitionVersion, setBossTransitionVersion] = useState(0);
    // ── Homunculus / enemy-card mode ──────────────────────────────────────────
    const [enemyCardMode, setEnemyCardMode] = useState<"create" | "fight" | "consume" | "boss">(() => {
        try {
            const b = parseInt(window.localStorage.getItem(BOSS_COUNTDOWN_KEY) ?? "0", 10) || 0;
            return b >= BOSS_BATTLE_THRESHOLD ? "boss" : "fight";
        } catch {
            return "fight";
        }
    });
    // Derived: non-null as soon as enemies.xlsx is loaded and battlesCompleted >= threshold.
    // Using useMemo avoids a separate state update cycle that caused "Unknown Boss" while
    // enemies were still loading after a post-battle navigation.
    const bossEnemy: Enemy | null = useMemo(() => {
        if (battlesCompleted < BOSS_BATTLE_THRESHOLD || enemies.length === 0) return null;
        const boss = enemies[bossIndex];
        if (!boss) return null;
        return { ...boss }; // soul reward comes directly from the enemies sheet
    }, [battlesCompleted, enemies, bossIndex]);
    const [isCreatingHomunculus, setIsCreatingHomunculus] = useState(false);
    const [pendingCreatedEnemy, setPendingCreatedEnemy] = useState<Enemy | null>(null);
    const [pendingBaseElemLetter, setPendingBaseElemLetter] = useState<string | null>(null);
    const [isConsuming, setIsConsuming] = useState(false);
    const [isDrainShaking, setIsDrainShaking] = useState(false);
    const [drainShakeColor, setDrainShakeColor] = useState("");
    const [consumeDrainedMeters, setConsumeDrainedMeters] = useState<Set<string>>(new Set());
    const [consumeFinalePhase, setConsumeFinalePhase] = useState<1 | 2 | null>(null);
    const [consumeFinaleTemplate, setConsumeFinaleTemplate] = useState<RewardElement | null>(null);
    const [statBoostToasts, setStatBoostToasts] = useState<Array<{ id: number; x: number; y: number; damageBoost: number; shieldBoost: number }>>([]); 
    const [createBaseSlotId, setCreateBaseSlotId] = useState<number | null>(null);
    const [elemSlotCount, setElemSlotCount] = useState(3);
    const [createElemSlotIds, setCreateElemSlotIds] = useState<(number | null)[]>([null, null, null]);
    const [unlockSlotOccupants, setUnlockSlotOccupants] = useState<[number | null, number | null, number | null]>([null, null, null]);
    const [homunculusWorkbook, setHomunculusWorkbook] = useState<HomunculusWorkbook | null>(null);
    const [isSoulCounterPopping] = useState(false);
    const [isSoulPanelErrorFeedback, setIsSoulPanelErrorFeedback] = useState(false);
    const [hoveredInsertSlot, setHoveredInsertSlot] = useState<1 | 2 | null>(null);
    const [insertedModeElementId, setInsertedModeElementId] = useState<number | null>(null);
    const [hiddenInsertedModeElementId, setHiddenInsertedModeElementId] = useState<number | null>(null);
    const [isModeInsertAnimating, setIsModeInsertAnimating] = useState(false);
    const [selectedModeTabElementKey, setSelectedModeTabElementKey] = useState<ModeTabElementKey | null>(null);
    const [isCombineButtonHovered, setIsCombineButtonHovered] = useState(false);
    const [incubateCounter, setIncubateCounter] = useState(1);
    const [refineCounter, setRefineCounter] = useState(1);

    useEffect(() => {
        const nextResistances: Record<ElementalResistanceKey, number> = {
            fire: 0,
            water: 0,
            earth: 0,
            air: 0,
        };

        for (let slotIndex = 0; slotIndex < spellSlots.length; slotIndex += 1) {
            const slottedElementId = spellSlots[slotIndex];
            if (slottedElementId === null) {
                break;
            }

            const slottedElement = player.elements.find((element) => element.id === slottedElementId);
            const slotElementType = resolveResistanceElementType(slottedElement?.type1, slottedElement?.letter);
            if (!slotElementType) {
                continue;
            }

            nextResistances[slotElementType] += 25;
            nextResistances[RESISTANCE_COUNTER_TYPE[slotElementType]] -= 25;
        }

        RESISTANCE_ELEMENT_KEYS.forEach((element) => {
            setElementalResistance(element, nextResistances[element]);
        });
    }, [player.elements, setElementalResistance, spellSlots]);

    type DeferredJob = {
        jobId: number;
        modeKey: "incubate" | "refine";
        inputElement: DraggableItem;
        counter: number;
        battlesWon: number;
    };
    const [deferredJobs, setDeferredJobs] = useState<DeferredJob[]>(() => {
        if (typeof window === "undefined") {
            return [];
        }

        try {
            const raw = window.sessionStorage.getItem(DEFERRED_JOBS_STORAGE_KEY);
            if (!raw) {
                return [];
            }

            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter((job): job is DeferredJob => {
                if (!job || typeof job !== "object") {
                    return false;
                }

                const candidate = job as Partial<DeferredJob>;
                return (
                    typeof candidate.jobId === "number"
                    && (candidate.modeKey === "incubate" || candidate.modeKey === "refine")
                    && typeof candidate.counter === "number"
                    && typeof candidate.battlesWon === "number"
                    && Boolean(candidate.inputElement)
                );
            });
        } catch {
            return [];
        }
    });
    const nextJobId = useRef(1);
    const [isDeferredShutterAnimating, setIsDeferredShutterAnimating] = useState(false);
    const [isDeferredShutterOpening, setIsDeferredShutterOpening] = useState(false);
    const [deferredCompletionRevealModes, setDeferredCompletionRevealModes] = useState<Set<"incubate" | "refine">>(new Set());
    // Ref so early callbacks (normalizeZoneOccupants) can read the current mode key without
    // creating a forward-reference to the derived `insertedModeStateKey` const.
    const insertedModeStateKeyRef = useRef<string>("idle");
    // Tracks how many combination uses have occurred for each sealed mode element key.
    // After 3 uses the slot is unsealed and resets to idle.
    const modeUseCountsRef = useRef<Partial<Record<string, number>>>({});
    // Always reflects the current activeModeElementKey so finalizeCombination can read it
    // without adding it to the useCallback dependency array.
    const activeModeElementKeyRef = useRef<ModeTabElementKey | null>(null);
    const [isOutputHovered, setIsOutputHovered] = useState(false);
    const [isOutputHovered2, setIsOutputHovered2] = useState(false);
    const [isModeCollapsing, setIsModeCollapsing] = useState(false);
    const [isModeCollapseAnimating, setIsModeCollapseAnimating] = useState(false);
    const [modeUsesRemaining, setModeUsesRemaining] = useState(3);
    const collapseTimerRef = useRef<number | null>(null);
    const [modeOutputElementIds, setModeOutputElementIds] = useState<Partial<Record<string, number[]>>>(() => {
        if (typeof window === "undefined") {
            return {};
        }

        try {
            const raw = window.sessionStorage.getItem(MODE_OUTPUT_STORAGE_KEY);
            if (!raw) {
                return {};
            }

            const parsed = JSON.parse(raw) as unknown;
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                return {};
            }

            return parsed as Partial<Record<string, number[]>>;
        } catch {
            return {};
        }
    });
    const [isPostBattleSoulSequenceActive, setIsPostBattleSoulSequenceActive] = useState(false);
    const [postBattleSoulFillDurationMs, setPostBattleSoulFillDurationMs] = useState(0);
    const [isOldOnePreludeActive, setIsOldOnePreludeActive] = useState(false);
    const [isOldOnePreludeBlackVisible, setIsOldOnePreludeBlackVisible] = useState(false);
    const [isOldOnePreludeTextVisible, setIsOldOnePreludeTextVisible] = useState(false);
    const [isOldOnePreludeEyesApproaching, setIsOldOnePreludeEyesApproaching] = useState(false);
    const [soulFlightIcons, setSoulFlightIcons] = useState<SoulFlightIcon[]>([]);
    const [enhanceSoulFlights, setEnhanceSoulFlights] = useState<EnhanceSoulFlight[]>([]);
    const [elementFlightIcons, setElementFlightIcons] = useState<ElementFlightIcon[]>([]);
    const [isChestRevealVisible] = useState(false);
    const [isChestRevealFadingOut] = useState(false);
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
    const previewPointerDownStartRef = useRef<Position | null>(null);
    const previewDragStartedRef = useRef(false);
    const suppressPreviewPinOnPointerUpRef = useRef(false);
    const previewAltHeldRef = useRef(false);
    const previewTooltipGraceTimeoutRef = useRef<number | null>(null);
    const introChosenNameRef = useRef("");
    const nextId = useRef(1);
    const pendingModeTransformRef = useRef<string | null>(null);
    const soulFlightIdRef = useRef(1);
    const elementCatalogRef = useRef<Map<string, RewardElement>>(new Map());
    const pendingDropSpawnByIdRef = useRef<Map<number, Position>>(new Map());
    const rewardCueTimeoutRef = useRef<number | null>(null);
    const soulAnimationTimeoutsRef = useRef<number[]>([]);
    const soulCounterPopTimeoutRef = useRef<number | null>(null);
    const soulPanelErrorTimeoutRef = useRef<number | null>(null);
    const modeInsertConsumeTimeoutRef = useRef<number | null>(null);
    const enhanceSoulFlightIdRef = useRef(1);
    const enhanceSoulFlightTimeoutsRef = useRef<number[]>([]);
    const elementFlightIdRef = useRef(1);
    const elementFlightTimeoutsRef = useRef<number[]>([]);
    const consumeCardRef = useRef<HTMLDivElement | null>(null);
    const consumeFlightTimeoutsRef = useRef<number[]>([]);
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
        consumeFlightTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
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

    const startOldOneFirstBattleIntro = useCallback((options?: { skipTimerClear?: boolean }) => {
        if (!options?.skipTimerClear) {
            clearOldOneSequenceTimeouts();
        }
        setIsOldOneIntroTriggered(true);
        setIsOldOneReturnLocked(true);
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
        if (typeof window === "undefined") {
            return;
        }

        if (deferredJobs.length === 0) {
            window.sessionStorage.removeItem(DEFERRED_JOBS_STORAGE_KEY);
            return;
        }

        window.sessionStorage.setItem(DEFERRED_JOBS_STORAGE_KEY, JSON.stringify(deferredJobs));
    }, [deferredJobs]);

    useEffect(() => {
        const maxPersistedJobId = deferredJobs.reduce((maxId, job) => Math.max(maxId, job.jobId), 0);
        if (maxPersistedJobId >= nextJobId.current) {
            nextJobId.current = maxPersistedJobId + 1;
        }
    }, [deferredJobs]);

    useEffect(() => () => {
        if (createHomunculusTimeoutRef.current !== null) {
            window.clearTimeout(createHomunculusTimeoutRef.current);
            createHomunculusTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        const state = location.state as GameLocationState | null;
        if (state?.battleEnded || state?.fightReward) {
            setIsCombinationStationUnlocked(true);
        }

        if (state?.elementUseCounts) {
            setPendingElementUseCounts(state.elementUseCounts);
        }

        if (state?.fightReward) {
            if (rewardCueTimeoutRef.current !== null) {
                window.clearTimeout(rewardCueTimeoutRef.current);
            }

            // Advance battle counters on all pending deferred jobs
            setDeferredJobs((prev) => prev.map((job) => ({
                ...job,
                battlesWon: job.battlesWon + 1,
            })));

            // Advance the boss countdown and trigger the warrior slide animation.
            setBattlesCompleted((prev) => {
                const next = prev + 1;
                try { window.localStorage.setItem(BOSS_COUNTDOWN_KEY, String(next)); } catch { /* ignore */ }
                return next;
            });
            setWarriorAnimateVersion((v) => v + 1);

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
                // When the 10th battle is won the countdown hits 0 and the boss
                // fight should be queued. `battlesCompleted` in this closure is
                // the pre-increment value, so check against threshold - 1.
                const isBossTransition = battlesCompleted === BOSS_BATTLE_THRESHOLD - 1;
                if (isBossTransition) {
                    // Boss mode is activated by the boss useEffect after remount.
                    // Do not enter consume mode for this transition.
                } else {
                    if (state.defeatedEnemy) {
                        setNextEnemy(state.defeatedEnemy);
                    }
                    setEnemyCardMode("consume");
                    setConsumeDrainedMeters(new Set());
                }

                // Re-snap any spell-slot elements back to their slots.
                // Game remounts after navigation so Draggables start at their
                // inventory initialPosition rather than the slot they were in.
                setSpellSlotForcedSnaps((prev) => {
                    const next: Record<number, { zone: number; version: number }> = {};
                    spellSlots.forEach((elementId, slotIndex) => {
                        if (elementId !== null) {
                            next[elementId] = {
                                zone: spellSlotStartIndex + slotIndex,
                                version: (prev[elementId]?.version ?? 0) + 1,
                            };
                        }
                    });
                    return Object.keys(next).length > 0 ? { ...prev, ...next } : prev;
                });
            }, REWARD_CUE_MS);
        }
    }, [isOldOneIntroTriggered, location.state, navigate, startOldOneStoryPrelude]);

    useEffect(() => {
        if (!pendingElementUseCounts || levels.length === 0) return;

        const counts = pendingElementUseCounts;
        setPendingElementUseCounts(null);
        recordElementUses(counts);

        for (const [idStr, usesGained] of Object.entries(counts)) {
            const elementId = Number(idStr);
            const element = playerProgress.elements.find((e) => e.id === elementId);
            if (!element || usesGained <= 0) continue;

            const oldUses = element.uses ?? 0;
            const newUses = oldUses + usesGained;
            let currentLevel = Math.max(1, element.level || 1);

            while (true) {
                const levelDef = levels.find((l) => l.level === currentLevel);
                if (!levelDef || levelDef.usesRequired <= 0 || newUses < levelDef.usesRequired) break;
                currentLevel++;
            }

            if (currentLevel > Math.max(1, element.level || 1)) {
                levelUpElementOnly(elementId, currentLevel);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingElementUseCounts, levels]);

    const activeDropZoneRefs = zoneOccupants.length === 3
        ? [dropZoneRefA, dropZoneRefB, dropZoneRefC]
        : [dropZoneRefA, dropZoneRefB];
    const allDropZoneRefs = [
        ...activeDropZoneRefs,
        ...(isEnhanceStationUnlocked ? [enhanceSlotRef] : []),
        machineSlotRef,
    ];
    const spellSlotStartIndex = allDropZoneRefs.length;
    const allDropZoneRefsWithSpellSlots = [
        ...allDropZoneRefs,
        ...spellSlotRefs.current,
    ];
    const createSlotStartIndex = allDropZoneRefsWithSpellSlots.length;
    const allDropZoneRefsCreate = [
        ...allDropZoneRefsWithSpellSlots,
        createBaseSlotRef,
        createElemSlotRef0,
        createElemSlotRef1,
        createElemSlotRef2,
    ];
    const unlockSlotStartIndex = allDropZoneRefsCreate.length;
    const allDropZoneRefsAll = [
        ...allDropZoneRefsCreate,
        unlockSlotRef0,
        unlockSlotRef1,
        unlockSlotRef2,
    ];

    const getDraggableById = useCallback((draggableId: number | null) => {
        if (draggableId === null) {
            return null;
        }

        const existing = draggables.find((item) => item.id === draggableId);
        if (existing) {
            return existing;
        }

        const sentinelModeKey = getModeKeyFromSentinelId(draggableId);
        if (!sentinelModeKey) {
            return null;
        }

        return {
            id: draggableId,
            letter: sentinelModeKey,
            damage: 0,
            energy: 0,
            rank: 0,
            level: 0,
            description: "Mode lock",
            category: "element",
            initialPosition: { x: 0, y: 0 },
        };
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
            // In a 3-slot mode (e.g. Mix), keep the 3-slot layout intact
            if (combinationStationRulesEngine.usesThirdSlot(insertedModeStateKeyRef.current)) {
                return [sanitized[0] ?? null, sanitized[1] ?? null, sanitized[2] ?? null];
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

    const getFragmentSpawnPosition = (index: number): Position => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const startRect = fragmentStartRef.current?.getBoundingClientRect();

        if (!containerRect || !startRect) {
            return {
                x: (index % 6) * 22,
                y: Math.floor(index / 6) * 22,
            };
        }

        // Fragments are rendered at 50% scale (22px effective), so use a 22px grid.
        const step = 22;
        const padding = 5;
        const columns = Math.max(1, Math.floor((startRect.width - padding * 2) / step));
        const row = Math.floor(index / columns);

        return {
            x: startRect.left - containerRect.left + padding + (index % columns) * step,
            y: startRect.bottom - containerRect.top - padding - step - row * step,
        };
    };

    const getElementStartCount = (): number =>
        playerProgress.elements.filter((element) => element.category !== "fragment").length;

    // Complete any deferred jobs (Incubate/Refine) whose battle count has been met.
    useEffect(() => {
        const completedJobs = deferredJobs.filter((job) => job.battlesWon >= job.counter);
        if (completedJobs.length === 0) return;

        const completedOutputsByMode: Array<{ id: number; modeKey: "incubate" | "refine" }> = [];

        completedJobs.forEach((job) => {
            // Spawn at the output slot position so the element appears there, falling back to inventory stack.
            const containerRect = gameRef.current?.getBoundingClientRect();
            const outputRect = outputRef.current?.getBoundingClientRect();
            const spawnPos = (containerRect && outputRect)
                ? {
                    x: outputRect.left - containerRect.left + (outputRect.width - 32) / 2,
                    y: outputRect.top - containerRect.top + (outputRect.height - 32) / 2,
                }
                : getSpawnPosition(getElementStartCount());

            if (job.modeKey === "incubate") {
                const incubateOutput = combinationStationRulesEngine.applyDeferred("incubate", job.inputElement, job.counter);
                if (incubateOutput) {
                    const deferredOutput = {
                        id: nextId.current++,
                        ...incubateOutput,
                        initialPosition: spawnPos,
                    };

                    completedOutputsByMode.push({ id: deferredOutput.id, modeKey: "incubate" });
                    combineElements([], deferredOutput);
                }
            } else if (job.modeKey === "refine") {
                const refineOutput = combinationStationRulesEngine.applyDeferred("refine", job.inputElement, job.counter);
                if (refineOutput) {
                    const deferredOutput = {
                        id: nextId.current++,
                        ...refineOutput,
                        initialPosition: spawnPos,
                    };

                    completedOutputsByMode.push({ id: deferredOutput.id, modeKey: "refine" });
                    combineElements([], deferredOutput);
                }
            }

            setDeferredCompletionRevealModes((prev) => {
                const next = new Set(prev);
                next.add(job.modeKey);
                return next;
            });

            if (job.modeKey === "incubate") {
                setIncubateCounter(1);
            } else {
                setRefineCounter(1);
            }
        });

        if (completedOutputsByMode.length > 0) {
            setModeOutputElementIds((previous) => {
                const next = { ...previous };
                completedOutputsByMode.forEach(({ id, modeKey }) => {
                    next[modeKey] = [...(next[modeKey] ?? []), id];
                });
                return next;
            });
        }

        setDeferredJobs((prev) => prev.filter((job) => job.battlesWon < job.counter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combineElements, deferredJobs, playerProgress.elements.length]);

    useEffect(() => {
        setModeOutputElementIds((previous) => {
            const liveIds = new Set(playerProgress.elements.map((element) => element.id));
            const next: Partial<Record<string, number[]>> = {};
            let changed = false;
            for (const [modeKey, ids] of Object.entries(previous)) {
                const filtered = (ids ?? []).filter((id) => liveIds.has(id));
                if (filtered.length > 0) {
                    next[modeKey] = filtered;
                }
                if (filtered.length !== (ids ?? []).length) {
                    changed = true;
                }
            }
            if (!changed && Object.keys(next).length === Object.keys(previous).length) {
                return previous;
            }
            return next;
        });
    }, [playerProgress.elements]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const hasAny = Object.values(modeOutputElementIds).some((ids) => (ids?.length ?? 0) > 0);
        if (!hasAny) {
            window.sessionStorage.removeItem(MODE_OUTPUT_STORAGE_KEY);
            return;
        }

        window.sessionStorage.setItem(MODE_OUTPUT_STORAGE_KEY, JSON.stringify(modeOutputElementIds));
    }, [modeOutputElementIds]);

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
                    shield: Number(row.shield ?? row.Shield ?? 0) || 0,
                    energy: Math.max(0, Number(row.energy ?? row.Energy ?? 0) || 0),
                    rank: (() => {
                            const raw = row.Rank ?? row.rank;
                            if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
                                return Number(raw) || 0;
                            }
                            return (row["Element 1"] ?? "").trim().length === 0 ? 0 : 2;
                        })(),
                    level: 1,
                    description: (row.Description ?? row.description ?? "").trim(),
                    type1: normalizeType((row.Type1 || "") as string),
                    type2: normalizeType((row.Type2 || "") as string),
                    effects: parseSpellEffectsFromRow(row),
                    category: ((row.Category ?? row.category ?? "") as string).trim().toLowerCase(),
                }))
                .filter((row) => row.name.length > 0);

            setAllElementOptions(
                parsedRows.map((row) => {
                    const baseEffects: SpellEffectConfig[] = row.effects ?? [];
                    // Inject default starter effects for rank-0 elements by type
                    const starterEffectByType: Record<string, SpellEffectConfig> = {
                        air:       { kind: EFFECTS.GUST,    target: "self", amount: 50, growth: "+" },
                        earth:     { kind: EFFECTS.ROOT,    target: "self", amount: 50, growth: "+" },
                        lightning: { kind: EFFECTS.STATIC,  target: "self", amount: 50, growth: "+" },
                        fire:      { kind: EFFECTS.FLAME,   target: "self", amount: 50, growth: "+" },
                        water:     { kind: EFFECTS.DRIZZLE, target: "self", amount: 50, growth: "+" },
                    };
                    let effects = baseEffects;
                    if (row.rank === 0) {
                        const primaryType = row.type1 || row.type2;
                        const starterEffect = primaryType ? starterEffectByType[primaryType] : undefined;
                        if (starterEffect && !baseEffects.some((e) => e.kind === starterEffect.kind)) {
                            effects = [...baseEffects, starterEffect];
                        }
                    }
                    return {
                        letter: row.name,
                        damage: row.damage,
                        shield: row.shield,
                        energy: row.energy,
                        rank: row.rank,
                        level: row.level,
                        description: row.description,
                        type1: row.type1,
                        type2: row.type2,
                        effects,
                        category: row.category,
                    };
                }),
            );

            elementCatalogRef.current = new Map(
                parsedRows.map((row) => [normalizeElementName(row.name), {
                    letter: row.name,
                    damage: row.damage,
                    shield: row.shield,
                    energy: row.energy,
                    rank: row.rank,
                    level: row.level,
                    description: row.description,
                    type1: row.type1,
                    type2: row.type2,
                    effects: row.effects,
                    category: row.category,
                } satisfies RewardElement]),
            );
        };

        const loadGameData = async () => {
            try {
                const elementsResponse = await fetch(resolvePublicAssetUrl("elements.xlsx"));
                if (!isSuccessfulResponse(elementsResponse)) {
                    throw new Error(`Failed to load elements workbook (${elementsResponse.status})`);
                }
                const elementsBuffer = await elementsResponse.arrayBuffer();
                if (isCancelled) {
                    return;
                }

                loadElements(elementsBuffer);

                const effectsWorkbookBuffer = await fetch(resolvePublicAssetUrl("effects.xlsx"))
                    .then((res) => (res.ok ? res.arrayBuffer() : null))
                    .catch(() => null);
                if (isCancelled) {
                    return;
                }

                let effectValuesByKey = new Map<string, EffectWorkbookValues>();
                if (effectsWorkbookBuffer) {
                    const effectsWorkbook = XLSX.read(effectsWorkbookBuffer, { type: "array" });
                    const effectsWorksheet = effectsWorkbook.Sheets[effectsWorkbook.SheetNames[0]];
                    const effectRows = XLSX.utils.sheet_to_json<EffectWorkbookRow>(effectsWorksheet);
                    effectValuesByKey = buildEffectValuesByKey(effectRows);

                    const parsedLevelUpEffects: LevelUpEffectEntry[] = [];
                    effectRows.forEach((row) => {
                        const typeColumn = String(row.Type ?? "").trim();
                        if (!typeColumn) return;
                        const effectName = String(row.Effect ?? "").trim();
                        if (!effectName) return;
                        const mappedRow = buildMappedEffectRow(effectName, effectValuesByKey);
                        const parsed = parseSpellEffectsFromRow(mappedRow, 1);
                        if (parsed.length === 0) return;
                        const types = typeColumn
                            .split(",")
                            .map((t) => t.trim().toLowerCase())
                            .filter(Boolean);
                        parsedLevelUpEffects.push({ config: parsed[0], types });
                    });
                    setLevelUpEffectPool(parsedLevelUpEffects);
                }

                const stateLookup: CombinationStateEffectsLookup = {};
                for (const [stateKey, workbookPath] of Object.entries(COMBINATION_STATE_WORKBOOK_PATHS) as Array<[CombinationStationActionStateKey, string]>) {
                    const workbookBuffer = await fetch(resolvePublicAssetUrl(workbookPath))
                        .then((res) => (res.ok ? res.arrayBuffer() : null))
                        .catch(() => null);
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

                        const effectName = String(row.Effect ?? "").trim();
                        const mappedEffectRow = buildMappedEffectRow(effectName, effectValuesByKey);

                        const parsedEffects = parseSpellEffectsFromRow(mappedEffectRow, 1);
                        effectsMap.set(normalizeElementName(elementName), parsedEffects);
                    });

                    stateLookup[stateKey] = effectsMap;
                }
                setCombinationStateEffectsLookup(stateLookup);

                const monsterRewardsBuffer = await fetch(resolvePublicAssetUrl("monster_rewards.xlsx"))
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
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                console.error("Failed to load non-enemy game data.", error);
            }

            try {
                const enemyUrls = [resolvePublicAssetUrl("enemies.xlsx"), "/enemies.xlsx"];
                let enemiesBuffer: ArrayBuffer | null = null;

                for (const url of enemyUrls) {
                    const response = await fetch(url).catch(() => null);
                    if (!response || !isSuccessfulResponse(response)) {
                        continue;
                    }

                    enemiesBuffer = await response.arrayBuffer();
                    break;
                }

                if (!enemiesBuffer) {
                    throw new Error("Failed to load enemies workbook from all known paths.");
                }

                if (isCancelled) {
                    return;
                }

                const wb = XLSX.read(enemiesBuffer, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<EnemyRow>(ws);
                const parsed: Enemy[] = rows
                    .map((row) => ({
                        name: String(row.Name ?? row.name ?? "").trim(),
                        hp: Number(row.HP ?? row.hp ?? 0) || 0,
                        power: Number(row.Power ?? row.power ?? 0) || 0,
                        souls: Number(row.Souls ?? row.souls ?? 0) || 0,
                        description: String(row.Description ?? row.description ?? "").trim(),
                        sprite: String(row.Sprite ?? row.sprite ?? "").trim(),
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
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                console.error("Failed to load enemies workbook.", error);
            }

            // Load homunculus workbook (non-fatal — create mode works without it)
            try {
                const hwb = await HomunculusWorkbook.load(resolvePublicAssetUrl("homunculus.xlsx"));
                if (!isCancelled) {
                    setHomunculusWorkbook(hwb);

                    // Use the first row (Scarecrow) as the opening enemy.
                    const scarecrowRow = hwb.rows[0];
                    if (scarecrowRow) {
                        const scarecrowHp = Number(scarecrowRow.extras["HP"] ?? scarecrowRow.extras["hp"] ?? 30);
                        const scarecrowPwr = Number(scarecrowRow.extras["Power"] ?? scarecrowRow.extras["power"] ?? 5);
                        const scarecrowDef = Number(
                            scarecrowRow.extras["DEF"]
                            ?? scarecrowRow.extras["def"]
                            ?? scarecrowRow.extras["Defense"]
                            ?? scarecrowRow.extras["defense"]
                            ?? 0,
                        );
                        const scarecrowSpd = Number(
                            scarecrowRow.extras["SPD"]
                            ?? scarecrowRow.extras["spd"]
                            ?? scarecrowRow.extras["Speed"]
                            ?? scarecrowRow.extras["speed"]
                            ?? scarecrowRow.extras["EXP"]
                            ?? scarecrowRow.extras["exp"]
                            ?? scarecrowRow.extras["Energy"]
                            ?? scarecrowRow.extras["energy"]
                            ?? 0,
                        );
                        // Only set the opening (Scarecrow) enemy when the boss
                        // fight is not yet due; otherwise the boss useEffect
                        // will populate bossEnemy from enemies.xlsx instead.
                        const storedBattles = parseInt(window.localStorage.getItem(BOSS_COUNTDOWN_KEY) ?? "0", 10) || 0;
                        if (storedBattles < BOSS_BATTLE_THRESHOLD) {
                            setNextEnemy({
                                name: scarecrowRow.name,
                                hp: scarecrowHp,
                                power: scarecrowPwr,
                                souls: Number(scarecrowRow.extras["Souls"] ?? scarecrowRow.extras["souls"] ?? 0),
                                description: String(scarecrowRow.extras["Description"] ?? scarecrowRow.extras["description"] ?? ""),
                                sprite: `homunculus/${scarecrowRow.name.replace(/\s+/g, "")}`,
                                weaknesses: [],
                                resistances: { fire: -25 },
                                elements: [{
                                    letter: "Earth",
                                    damage: scarecrowPwr,
                                    shield: scarecrowDef,
                                    energy: scarecrowSpd,
                                    rank: 1,
                                    level: 1,
                                    description: "Homunculus attack profile",
                                    type1: "earth",
                                    category: "element",
                                }],
                            });
                        }
                    }
                }
            } catch {
                console.warn("Failed to load homunculus workbook.");
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
            .filter((element) => element.rank === 0 && element.category?.toLowerCase() === "element")
            .slice(0, 4);
        if (starterElements.length === 0) {
            return;
        }

        hasShownInitialRewardModalRef.current = true;
        setIsFightVictoryCueVisible(false);

        starterElements.forEach((element, index) => {
            addElement({
                ...element,
                initialPosition: getSpawnPosition(index),
            });
        });
    }, [addElement, allElementOptions, introPhase, location.state, playerProgress.elements.length]);

    useEffect(() => {
        levelZeroElementsRef.current = allElementOptions.filter((e) => e.rank === 0);
        allElementOptionsRef.current = allElementOptions;
    }, [allElementOptions]);

    useEffect(() => {
        discoveredCraftedLettersRef.current = discoveredCraftedLetters;
    }, [discoveredCraftedLetters]);

    useEffect(() => {
        // Capture slot state at this render so the separation pass inside
        // setDraggables knows which elements are anchored in fixed slots.
        const slottedIds = new Set<number>([
            ...zoneOccupants.filter((x): x is number => x !== null),
            ...spellSlots.filter((x): x is number => x !== null),
            ...(createBaseSlotId !== null ? [createBaseSlotId] : []),
            ...createElemSlotIds.filter((x): x is number => x !== null),
            ...unlockSlotOccupants.filter((x): x is number => x !== null),
            ...(enhanceSlotOccupantId !== null ? [enhanceSlotOccupantId] : []),
            ...(machineSlotOccupantId !== null ? [machineSlotOccupantId] : []),
        ]);

        setDraggables((previous) => {
            const previousById = new Map(previous.map((item) => [item.id, item]));

            const next = playerProgress.elements.map((element, index) => {
                const existing = previousById.get(element.id);
                if (existing) {
                    return {
                        ...existing,
                        letter: element.letter,
                        damage: element.damage,
                        shield: element.shield,
                        energy: element.energy,
                        enhancements: element.enhancements,
                        rank: element.rank,
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
                    initialPosition: element.initialPosition ?? pendingDropSpawnByIdRef.current.get(element.id) ?? getSpawnPosition(index),
                };
            });

            if (
                insertedModeElementId !== null
                && !playerProgress.elements.some((element) => element.id === insertedModeElementId)
            ) {
                const insertedModeDraggable = previousById.get(insertedModeElementId);
                if (insertedModeDraggable) {
                    next.push(insertedModeDraggable);
                }
            }

            return next;
        });

        // Run separation so newly spawned elements don’t land on top of existing ones.
        setDraggables((prev) => {
            const { draggables: separated } = separateOverlappingDraggables(prev, slottedIds);
            return separated;
        });

        pendingDropSpawnByIdRef.current.clear();

        setZoneOccupants((previous) =>
            previous.map((occupantId, index) =>
                playerProgress.elements.some((element) => element.id === occupantId)
                    || isModeSentinelId(occupantId)
                    || (index === 0 && insertedModeElementId !== null && occupantId === insertedModeElementId)
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
    }, [insertedModeElementId, playerProgress.elements]);

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
        zoneOccupantsRef.current = zoneOccupants;
    }, [zoneOccupants]);

    useEffect(() => {
        if (enemies.length === 0 || nextEnemy) return;
        // Start with the first enemy row from the sheet.
        setNextEnemy(enemies[0]);
    }, [enemies, nextEnemy, setNextEnemy]);

    // When the boss countdown reaches 0, switch to the boss card mode.
    // bossEnemy is derived via useMemo above — no need to set state here.
    useEffect(() => {
        if (battlesCompleted !== BOSS_BATTLE_THRESHOLD || enemies.length === 0) return;
        setEnemyCardMode("boss");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [battlesCompleted, enemies]);

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

    useEffect(() => {
        const slotZeroOccupantId = zoneOccupants[0] ?? null;

        if (slotZeroOccupantId === null) {
            if (modeInsertConsumeTimeoutRef.current !== null) {
                window.clearTimeout(modeInsertConsumeTimeoutRef.current);
                modeInsertConsumeTimeoutRef.current = null;
            }
            setIsModeInsertAnimating(false);
            setInsertedModeElementId(null);
            setHiddenInsertedModeElementId(null);
            return;
        }

        if (insertedModeElementId !== null && insertedModeElementId !== slotZeroOccupantId) {
            if (modeInsertConsumeTimeoutRef.current !== null) {
                window.clearTimeout(modeInsertConsumeTimeoutRef.current);
                modeInsertConsumeTimeoutRef.current = null;
            }
            setIsModeInsertAnimating(false);
            setInsertedModeElementId(null);
            setHiddenInsertedModeElementId(null);
        }
    }, [insertedModeElementId, zoneOccupants]);

    const handleInsertMode = useCallback(() => {
        const slotZeroOccupantId = zoneOccupants[0] ?? null;
        if (slotZeroOccupantId === null) {
            return;
        }
        const slotZeroDraggable = getDraggableById(slotZeroOccupantId);
        const slotZeroElementKey = normalizeElementName(slotZeroDraggable?.letter);
        if (
            selectedModeTabElementKey === null
            || slotZeroElementKey !== selectedModeTabElementKey
        ) {
            return;
        }

        if (modeInsertConsumeTimeoutRef.current !== null) {
            window.clearTimeout(modeInsertConsumeTimeoutRef.current);
            modeInsertConsumeTimeoutRef.current = null;
        }

        setInsertedModeElementId(slotZeroOccupantId);
        setHiddenInsertedModeElementId(slotZeroOccupantId);
        setIsModeInsertAnimating(true);
        const insertedItem = getDraggableById(slotZeroOccupantId);
        const insertedElementKey = normalizeElementName(insertedItem?.letter);
        const insertedModeKey: CombinationModeKey | null = isModeTabElementKey(insertedElementKey)
            ? insertedElementKey
            : null;
        if (insertedModeKey) {
            setSelectedModeTabElementKey(insertedModeKey);
        }
        modeInsertConsumeTimeoutRef.current = window.setTimeout(() => {
            consumeElements([slotZeroOccupantId]);
            if (insertedModeKey) {
                sealCombinationMode(insertedModeKey);
                modeUseCountsRef.current = { ...modeUseCountsRef.current, [insertedModeKey]: 0 };
                setModeUsesRemaining(3);
                setIsModeCollapsing(false);
                setIsModeCollapseAnimating(false);
                if (collapseTimerRef.current !== null) {
                    window.clearTimeout(collapseTimerRef.current);
                    collapseTimerRef.current = null;
                }
                setZoneOccupants((previous) => {
                    const next = [...previous];
                    next[0] = getModeSentinelId(insertedModeKey);
                    return normalizeZoneOccupants(next);
                });
            }
            setIsModeInsertAnimating(false);
            setInsertedModeElementId(null);
            setHiddenInsertedModeElementId(null);
            modeInsertConsumeTimeoutRef.current = null;
        }, MODE_SHUTTER_CLOSE_MS);
    }, [consumeElements, getDraggableById, normalizeZoneOccupants, sealCombinationMode, selectedModeTabElementKey, zoneOccupants]);

    const getUnlockSlotLetter = useCallback((id: number): string | undefined => {
        return draggables.find((d) => d.id === id)?.letter;
    }, [draggables]);

    const handleUnlock = useCallback(() => {
        const modeKey = activeModeElementKeyRef.current;
        if (!modeKey || !lockedModes.has(modeKey)) return;
        unlockMode(modeKey as import("./CombinationModePanel").ModeTabElementKey);
        // Return all three slot occupants to their home positions
        setUnlockSlotOccupants((prev) => {
            const ids = prev.filter((id): id is number => id !== null);
            if (ids.length > 0) {
                setReturnHomeVersions((v) => {
                    const next = { ...v };
                    for (const id of ids) next[id] = (next[id] ?? 0) + 1;
                    return next;
                });
            }
            return [null, null, null];
        });
    }, [lockedModes, unlockMode]);

    const handleModeTabSelect = useCallback((elementKey: ModeTabElementKey) => {
        setSelectedModeTabElementKey((current) => (current === elementKey ? null : elementKey));

        // Evict formula input slots (1+) and animate elements back to their home position.
        const inputIds = zoneOccupantsRef.current
            .slice(1)
            .filter((id): id is number => id !== null);
        if (inputIds.length > 0) {
            setZoneOccupants((prev) => {
                const next = [...prev];
                for (let i = 1; i < next.length; i++) next[i] = null;
                return next;
            });
            setReturnHomeVersions((prev) => {
                const next = { ...prev };
                for (const id of inputIds) next[id] = (next[id] ?? 0) + 1;
                return next;
            });
        }
    }, []);

    useEffect(() => {
        if (hiddenInsertedModeElementId === null) {
            return;
        }

        if (!playerProgress.elements.some((element) => element.id === hiddenInsertedModeElementId)) {
            return;
        }

        consumeElements([hiddenInsertedModeElementId]);
    }, [consumeElements, hiddenInsertedModeElementId, playerProgress.elements]);

    useEffect(() => () => {
        if (modeInsertConsumeTimeoutRef.current !== null) {
            window.clearTimeout(modeInsertConsumeTimeoutRef.current);
            modeInsertConsumeTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!isModeCollapsing || isModeCollapseAnimating) {
            return;
        }

        const currentModeOutputCount = (modeOutputElementIds[insertedModeStateKeyRef.current] ?? []).length;
        if (currentModeOutputCount > 0) {
            return;
        }

        setIsModeCollapseAnimating(true);
        collapseTimerRef.current = window.setTimeout(() => {
            setIsModeCollapsing(false);
            setIsModeCollapseAnimating(false);
            collapseTimerRef.current = null;
        }, MODE_COLLAPSE_ANIMATION_MS);
    }, [isModeCollapsing, isModeCollapseAnimating, modeOutputElementIds]);

    // When the mode slot finishes collapsing, spawn the transformed element into zone 0.
    useEffect(() => {
        if (isModeCollapsing) return;
        const modeKey = pendingModeTransformRef.current;
        if (!modeKey) return;
        pendingModeTransformRef.current = null;

        const MODE_ELEMENT_TRANSFORMS: Partial<Record<string, string>> = {
            fire: "Ash",
            water: "Oil",
            air: "Dust",
            earth: "Sand",
        };
        const transformedName = MODE_ELEMENT_TRANSFORMS[modeKey];
        if (!transformedName) return;

        const catalogEntry = elementCatalogRef.current.get(normalizeElementName(transformedName));
        const newId = nextId.current++;
        const spawnPos = getSpawnPosition(getElementStartCount());
        const newElement = {
            id: newId,
            letter: transformedName,
            damage: catalogEntry?.damage ?? 0,
            shield: catalogEntry?.shield,
            energy: catalogEntry?.energy,
            rank: catalogEntry?.rank ?? 0,
            level: catalogEntry?.level ?? 1,
            description: catalogEntry?.description ?? `${transformedName} element`,
            type1: catalogEntry?.type1,
            type2: catalogEntry?.type2,
            effects: catalogEntry?.effects,
            category: catalogEntry?.category ?? "element",
            initialPosition: spawnPos,
        };

        combineElements([], newElement);
        setDraggables((prev) => [...prev, newElement]);
        setZoneOccupants((prev) => {
            const next = [...prev];
            next[0] = newId;
            return next;
        });
        setModeTransformForcedSnap({ id: newId, version: Date.now() });
        // Clear after one frame so the snap fires exactly once and the element
        // becomes freely draggable immediately afterwards.
        window.requestAnimationFrame(() => {
            setModeTransformForcedSnap(null);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModeCollapsing, combineElements]);

    useEffect(() => {
        if (selectedModeTabElementKey === null) {
            return;
        }

        const sentinelId = getModeSentinelId(selectedModeTabElementKey);
        const isSelectedModeSealed = sealedCombinationModes.has(selectedModeTabElementKey);

        setZoneOccupants((previous) => {
            const slotZeroOccupantId = previous[0] ?? null;

            if (isSelectedModeSealed) {
                if (slotZeroOccupantId === sentinelId) {
                    return previous;
                }

                const next = [...previous];
                next[0] = sentinelId;
                return normalizeZoneOccupants(next);
            }

            if (isModeSentinelId(slotZeroOccupantId)) {
                const next = [...previous];
                next[0] = null;
                return normalizeZoneOccupants(next);
            }

            return previous;
        });
    }, [normalizeZoneOccupants, sealedCombinationModes, selectedModeTabElementKey]);

    const insertedModeDraggable = getDraggableById(insertedModeElementId);
    const insertedModeElementKey = normalizeElementName(insertedModeDraggable?.letter);
    const activeModeElementKey = selectedModeTabElementKey ?? (isModeTabElementKey(insertedModeElementKey) ? insertedModeElementKey : null);
    const isActiveModeSealed = activeModeElementKey !== null && sealedCombinationModes.has(activeModeElementKey);
    const isCurrentModeLocked = activeModeElementKey !== null && lockedModes.has(activeModeElementKey);
    const unlockTargetModeKey = selectedModeTabElementKey;
    const isUnlockReady = isCurrentModeLocked
        && unlockTargetModeKey !== null
        && unlockSlotOccupants.every((id) => {
            if (id === null) return false;
            const slotItem = getDraggableById(id);
            return normalizeElementName(slotItem?.letter) === unlockTargetModeKey;
        });
    const slotZeroOccupantId = zoneOccupants[0] ?? null;
    const slotZeroDraggable = getDraggableById(slotZeroOccupantId);
    const slotZeroElementKey = normalizeElementName(slotZeroDraggable?.letter);
    const sealedModeTabElementKeys = Array.from(sealedCombinationModes).filter(isModeTabElementKey);
    const activeModeElementKeyForState: string = activeModeElementKey ?? "";
    const isInsertEnabled = insertedModeElementId === null
        && !isActiveModeSealed
        && slotZeroOccupantId !== null
        && selectedModeTabElementKey !== null
        && slotZeroElementKey === selectedModeTabElementKey;
    const insertedModeState = getCombinationStationState(activeModeElementKeyForState);
    const insertedModeStateKey = insertedModeState.key;
    const activeDeferredJob = deferredJobs.find((j) => j.modeKey === insertedModeStateKey) ?? null;
    const isDeferredModeActive = insertedModeStateKey === "incubate" || insertedModeStateKey === "refine";
    const isDeferredSlotClosed = isDeferredModeActive && activeDeferredJob !== null;

    // Keep ref in sync so normalizeZoneOccupants can read the key without a forward-reference.
    insertedModeStateKeyRef.current = insertedModeStateKey;
    // Keep ref in sync so finalizeCombination can read the current mode element key.
    activeModeElementKeyRef.current = activeModeElementKey;

    // When a deferred mode (incubate/refine) becomes active and already has output elements,
    // correct their positions using offsetLeft/offsetTop traversal â€” which is NOT affected by
    // CSS transforms. getBoundingClientRect() includes the translateX(-1rem) from .is-hidden,
    // so it returns wrong coordinates while the result panel is hidden. offsetLeft/offsetTop
    // always reflect the natural layout position regardless of transforms on ancestors.
    useLayoutEffect(() => {
        if (!isDeferredModeActive) return;
        const outputIds = modeOutputElementIds[insertedModeStateKey] ?? [];
        if (outputIds.length === 0) return;

        const container = gameRef.current;
        const outputSlot = outputRef.current;
        if (!container || !outputSlot) return;

        // Walk the offsetParent chain to get container-relative coords without transforms.
        let x = 0;
        let y = 0;
        let el: HTMLElement | null = outputSlot;
        while (el && el !== container) {
            x += el.offsetLeft;
            y += el.offsetTop;
            el = el.offsetParent as HTMLElement | null;
        }
        if (el !== container) return; // offsetParent chain didn't reach the game container

        const correctedPos = {
            x: x + (outputSlot.offsetWidth - 32) / 2,
            y: y + (outputSlot.offsetHeight - 32) / 2,
        };

        const idsToCorrect = [...outputIds];
        setDraggables((prev) =>
            prev.map((d) =>
                idsToCorrect.includes(d.id) ? { ...d, initialPosition: correctedPos } : d
            )
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDeferredModeActive, insertedModeStateKey, modeOutputElementIds]);

    // Expand zoneOccupants to 3 slots when a 3-slot mode (e.g. Mix) is active; collapse back to 2 otherwise.
    useEffect(() => {
        if (combinationStationRulesEngine.usesThirdSlot(insertedModeStateKey)) {
            setZoneOccupants((prev) => {
                if (prev.length >= 3) return prev;
                return [prev[0] ?? null, prev[1] ?? null, null];
            });
        } else if (insertedModeStateKey !== "idle") {
            setZoneOccupants((prev) => {
                if (prev.length <= 2) return prev;
                return [prev[0] ?? null, prev[1] ?? null];
            });
        }
    }, [insertedModeStateKey]);

    const previewCombination = useMemo<PreviewCombination | null>(() => {
        if (insertedModeStateKey === "idle") {
            return null;
        }

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
            (occupantId): occupantId is number => occupantId !== null && !isModeSentinelId(occupantId),
        );
        const occupantItems = zoneOccupants.map((occupantId) =>
            getDraggableById(occupantId) ?? undefined,
        );

        if (occupantItems.some((item) => !item)) {
            return null;
        }

        const modePreviewContext: ModePreviewContext = {
            occupantItems,
            consumedIds,
            isModeSentinelId,
            lookupCatalogElement: (letter) =>
                elementCatalogRef.current.get(normalizeElementName(letter)),
        };

        const currentStationStateKey = insertedModeStateKey;
        const currentEnhancementStateKey: CombinationStationActionStateKey | undefined =
            currentStationStateKey === "mix" ||
            currentStationStateKey === "incubate" ||
            currentStationStateKey === "divide" ||
            currentStationStateKey === "refine"
                ? currentStationStateKey
                : undefined;
        const secondInputItem = occupantItems[1] ?? undefined;

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

            const allUnstableInputEffects = [
                ...(unstableItem.effects ?? []),
                ...(otherItem.effects ?? []),
            ];
            const unstableResolved = resolveCombinationPreviewFromEffects(
                { damage: otherItem.damage, shield: otherItem.shield, energy: otherItem.energy, effects: unstableItem.effects },
                allUnstableInputEffects,
            );

            return applyCombustPreview({
                consumedIds: withBrittleFormulaConsumedIds(consumedIds, [unstableItem, otherItem]),
                letter: `${otherItem.letter}+`,
                damage: unstableResolved.damage,
                shield: unstableResolved.shield,
                energy: unstableResolved.energy,
                enhancements: mergeEnhancements(secondInputItem?.enhancements, currentEnhancementStateKey),
                level: otherItem.level,
                description: otherItem.description,
                type1: unstableItem.type1,
                type2: unstableItem.type2,
                effects: unstableResolved.effects,
            });
        };

        // ── Mix (3-slot): handled by the rules engine. Must run before the plasma
        // rule below, which also keys off a 3-slot layout. ──
        if (combinationStationRulesEngine.usesThirdSlot(currentStationStateKey) && zoneOccupants.length === 3) {
            return combinationStationRulesEngine.buildPreview(currentStationStateKey, modePreviewContext);
        }

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

            const allPlasmaInputEffects = [
                ...(leftItem.effects ?? []),
                ...(middleItem.effects ?? []),
                ...(rightItem.effects ?? []),
            ];
            const plasmaResolved = resolveCombinationPreviewFromEffects(
                { damage: 0, energy: combinedEnergy, effects: sideEffects },
                allPlasmaInputEffects,
            );

            return applyCombustPreview({
                consumedIds: withBrittleFormulaConsumedIds(consumedIds, [leftItem, middleItem, rightItem]),
                letter: "Unstable Element",
                damage: plasmaResolved.damage,
                shield: plasmaResolved.shield,
                energy: plasmaResolved.energy,
                enhancements: mergeEnhancements(middleItem.enhancements, currentEnhancementStateKey),
                level: 2,
                description: "Unstable fusion carrying the effects of both connected elements.",
                type1: mergedTypes[0],
                type2: mergedTypes[1],
                effects: plasmaResolved.effects,
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

        // ── Per-mode 2-slot previews (Incubate / Divide / Refine / Duplicate) are
        // produced by the rules engine. Runs after the global soul+soul and unstable
        // rules above so those keep priority. ──
        return combinationStationRulesEngine.buildPreview(currentStationStateKey, modePreviewContext);
    }, [combinationStateEffectsLookup, getDraggableById, insertedModeStateKey, zoneOccupants]);

    /** Convert a PreviewCombination to the ElementDetails shape used by both tooltip types. */
    const previewToElementDetails = (pc: PreviewCombination): import("./FloatingTooltip").ElementDetails => ({
        letter: pc.letter,
        damage: pc.damage,
        shield: pc.shield,
        isDamageEnhanced: pc.isDamageEnhanced,
        baseDamageBeforeEnhance: pc.baseDamageBeforeEnhance,
        isCombusted: pc.isCombusted,
        baseDamageBeforeCombust: pc.baseDamageBeforeCombust,
        energy: pc.energy,
        baseEnergyBeforeCreation: pc.baseEnergyBeforeCreation,
        enhancements: pc.enhancements,
        description: pc.description,
        type1: pc.type1,
        type2: pc.type2,
        effects: pc.effects,
        level: pc.level,
        category: pc.category,
    });

    /** Convert a DraggableItem to the ElementDetails shape used by both tooltip types. */
    const draggableToElementDetails = (d: DraggableItem): import("./FloatingTooltip").ElementDetails => ({
        letter: d.letter,
        damage: d.damage,
        shield: d.shield,
        energy: d.energy,
        enhancements: d.enhancements,
        description: d.description,
        type1: d.type1,
        type2: d.type2,
        effects: d.effects,
        level: d.level,
        category: d.category,
    });

    /** Convert a PreviewSecondOutput to the ElementDetails shape used by both tooltip types. */
    const secondOutputToElementDetails = (so: import("./combinationTypes").PreviewSecondOutput): import("./FloatingTooltip").ElementDetails => ({
        letter: so.letter,
        damage: so.damage,
        shield: so.shield,
        energy: so.energy,
        description: so.description,
        type1: so.type1,
        type2: so.type2,
        effects: so.effects,
        level: so.level,
        category: so.category,
    });

    const canCombine = previewCombination !== null;
    const firstSlotConnectorKey: string = activeModeElementKeyForState;
    const combinationStationState = insertedModeState;
    const hasActiveCombinationState = combinationStationState.key !== "idle";
    const areBothCombinationSlotsFilled = combinationStationRulesEngine.areInputSlotsFilled(
        insertedModeStateKey,
        zoneOccupants,
    );
    const isDuplicateCombinationReady = combinationStationState.key === "duplicate"
        && areBothCombinationSlotsFilled;
    const isNonDuplicateCombinationReady = hasActiveCombinationState
        && combinationStationState.key !== "duplicate"
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

    const getOutputCenterPosition2 = useCallback((): Position | null => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const outputRect = outputRef2.current?.getBoundingClientRect();
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

        const trackModeUse = () => {
            const modeKey = activeModeElementKeyRef.current;
            if (!modeKey) return;
            const nextCount = (modeUseCountsRef.current[modeKey] ?? 0) + 1;
            modeUseCountsRef.current = { ...modeUseCountsRef.current, [modeKey]: nextCount };
            if (nextCount >= 3) {
                unsealCombinationMode(modeKey);
                modeUseCountsRef.current = { ...modeUseCountsRef.current, [modeKey]: 0 };
                setIsModeCollapsing(true);
                setModeUsesRemaining(0);
                // Store the modeKey so the slot-open effect can spawn the transformed element
                pendingModeTransformRef.current = modeKey;
            } else {
                setModeUsesRemaining(3 - nextCount);
            }
        };
        const getBrittleUses = (effect: SpellEffectConfig): number =>
            Math.max(1, Math.floor(effect.amount ?? 1));

        const formulaParticipantIds = new Set(
            zoneOccupants.filter((occupantId): occupantId is number => occupantId !== null),
        );
        const previewConsumedIdSet = new Set(previewCombination.consumedIds);
        const brittleUpdatesById = new Map<number, SpellEffectConfig[]>();
        const extraConsumedIds: number[] = [];

        draggables.forEach((draggable) => {
            if (!formulaParticipantIds.has(draggable.id) || previewConsumedIdSet.has(draggable.id)) {
                return;
            }

            const effects = draggable.effects ?? [];
            if (!effects.some((effect) => effect.kind === "brittle")) {
                return;
            }

            let shouldConsume = false;
            let updated = false;

            const nextEffects = effects.map((effect) => {
                if (effect.kind !== "brittle") {
                    return effect;
                }

                const usesAfterFormula = getBrittleUses(effect) - 1;
                if (usesAfterFormula <= 0) {
                    shouldConsume = true;
                    return effect;
                }

                updated = true;
                return {
                    ...effect,
                    amount: usesAfterFormula,
                };
            });

            if (shouldConsume) {
                extraConsumedIds.push(draggable.id);
                return;
            }

            if (updated) {
                brittleUpdatesById.set(draggable.id, nextEffects);
            }
        });

        const effectiveConsumedIds = Array.from(
            new Set([...previewCombination.consumedIds, ...extraConsumedIds]),
        );

        // â”€â”€ Deferred modes (Incubate / Refine): consume input, queue a pending job â”€â”€
        if (previewCombination.isDeferred) {
            const activeCounter = insertedModeStateKey === "incubate" ? incubateCounter : refineCounter;
            const inputId = effectiveConsumedIds[0];
            const inputDraggable = getDraggableById(inputId);
            if (!inputDraggable) return;

            const newJob: DeferredJob = {
                jobId: nextJobId.current++,
                modeKey: insertedModeStateKey as "incubate" | "refine",
                inputElement: inputDraggable,
                counter: activeCounter,
                battlesWon: 0,
            };

            setDeferredJobs((prev) => [
                ...prev.filter((j) => j.modeKey !== newJob.modeKey),
                newJob,
            ]);
            consumeElements(effectiveConsumedIds);
            setDraggables((prev) => prev.filter((d) => !effectiveConsumedIds.includes(d.id)));
            setZoneOccupants((prev) => prev.map((id) => (id !== null && effectiveConsumedIds.includes(id) ? null : id)));
            setIsDeferredShutterOpening(false);
            setIsDeferredShutterAnimating(true);
            window.setTimeout(() => setIsDeferredShutterAnimating(false), MODE_SHUTTER_CLOSE_MS);
            setIsPreviewDragging(false);
            setPreviewPosition(null);
            previewPositionRef.current = null;
            trackModeUse();
            return;
        }

        const outputPosition = getOutputCenterPosition();
        const targetPosition = spawnPosition ?? outputPosition;
        if (!targetPosition) {
            return;
        }

        // â”€â”€ Dual-output modes (Divide / Duplicate): spawn two elements â”€â”€
        if (previewCombination.secondOutput) {
            const targetPosition2 = getOutputCenterPosition2() ?? targetPosition;
            const didSpawnFromOutputSlot = !spawnPosition;

            const firstDraggable = {
                id: nextId.current++,
                letter: previewCombination.letter,
                damage: previewCombination.damage,
                shield: previewCombination.shield,
                energy: previewCombination.energy,
                enhancements: previewCombination.enhancements,
                rank: previewCombination.rank ?? 0,
                level: previewCombination.level,
                description: previewCombination.description,
                type1: previewCombination.type1,
                type2: previewCombination.type2,
                effects: previewCombination.effects,
                category: previewCombination.category,
                initialPosition: targetPosition,
            };

            const secondDraggable = {
                id: nextId.current++,
                ...previewCombination.secondOutput,
                rank: previewCombination.secondOutput.rank ?? 0,
                initialPosition: targetPosition2,
            };

            if (didSpawnFromOutputSlot) {
                setModeOutputElementIds((previous) => ({
                    ...previous,
                    [insertedModeStateKey]: [
                        ...(previous[insertedModeStateKey] ?? []),
                        firstDraggable.id,
                        secondDraggable.id,
                    ],
                }));
            }

            brittleUpdatesById.forEach((nextEffects, elementId) => {
                updateElementEffects(elementId, nextEffects);
            });

            combineElementsMultiple(effectiveConsumedIds, [firstDraggable, secondDraggable]);

            setDraggables((previous) => {
                const preserved = previous
                    .filter((draggable) => !effectiveConsumedIds.includes(draggable.id))
                    .map((draggable) => {
                        const nextEffects = brittleUpdatesById.get(draggable.id);
                        return nextEffects ? { ...draggable, effects: nextEffects } : draggable;
                    });

                return [...preserved, firstDraggable, secondDraggable];
            });

            setZoneOccupants((previous) =>
                previous.map((occupantId) =>
                    occupantId !== null && effectiveConsumedIds.includes(occupantId) ? null : occupantId,
                ),
            );
            setIsPreviewDragging(false);
            setPreviewPosition(null);
            previewPositionRef.current = null;
            trackModeUse();
            return;
        }

        // â”€â”€ Single-output (default) â”€â”€
        const newDraggable = {
            id: nextId.current,
            letter: previewCombination.letter,
            damage: previewCombination.damage,
            shield: previewCombination.shield,
            energy: previewCombination.energy,
            enhancements: previewCombination.enhancements,
            rank: previewCombination.rank ?? 0,
            level: previewCombination.level,
            description: previewCombination.description,
            type1: previewCombination.type1,
            type2: previewCombination.type2,
            effects: previewCombination.effects,
            category: previewCombination.category,
            initialPosition: targetPosition,
        };

        if (!spawnPosition) {
            setModeOutputElementIds((previous) => ({
                ...previous,
                [insertedModeStateKey]: [
                    ...(previous[insertedModeStateKey] ?? []),
                    newDraggable.id,
                ],
            }));
        }

        nextId.current += 1;

        pendingDropSpawnByIdRef.current.set(newDraggable.id, targetPosition);

        combineElements(effectiveConsumedIds, newDraggable);

        brittleUpdatesById.forEach((nextEffects, elementId) => {
            updateElementEffects(elementId, nextEffects);
        });

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
            const preserved = previous
                .filter((draggable) => !effectiveConsumedIds.includes(draggable.id))
                .map((draggable) => {
                    const nextEffects = brittleUpdatesById.get(draggable.id);
                    if (!nextEffects) {
                        return draggable;
                    }

                    return {
                        ...draggable,
                        effects: nextEffects,
                    };
                });

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
                occupantId !== null && effectiveConsumedIds.includes(occupantId)
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

        trackModeUse();
    }, [
        addDiscoveredCraftedLetter,
        combineElements,
        combineElementsMultiple,
        consumeElements,
        draggables,
        getDraggableById,
        getOutputCenterPosition,
        getOutputCenterPosition2,
        incubateCounter,
        insertedModeStateKey,
        previewCombination,
        refineCounter,
        unsealCombinationMode,
        updateElementEffects,
        zoneOccupants,
    ]);

    useEffect(() => {
        if (previewCombination) {
            return;
        }

        setIsPreviewDragging(false);
        setIsPreviewPointerDown(false);
        setIsPreviewHovered(false);
        setIsPreviewTooltipHovered(false);
        setIsPreviewTooltipGraceOpen(false);
        setIsPreviewTooltipPinned(false);
        setIsPreviewAltLockActive(false);
        clearPreviewTooltipGraceTimeout();
        setIsOutputHovered(false);
        setPreviewHomePosition(null);
        setPreviewPosition(null);
        previewPositionRef.current = null;
        previewPointerDownStartRef.current = null;
        previewDragStartedRef.current = false;
        suppressPreviewPinOnPointerUpRef.current = false;
    }, [clearPreviewTooltipGraceTimeout, previewCombination]);

    useLayoutEffect(() => {
        if (!previewCombination || isPreviewDragging) {
            return;
        }

        const syncPreviewHomePosition = () => {
            const centered = getOutputCenterPosition();
            if (centered) {
                setPreviewHomePosition(centered);
            }
        };

        syncPreviewHomePosition();

        const frameId = window.requestAnimationFrame(() => {
            syncPreviewHomePosition();
        });

        const timeoutId = window.setTimeout(() => {
            syncPreviewHomePosition();
        }, 240);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [getOutputCenterPosition, isPreviewDragging, previewCombination]);

    useLayoutEffect(() => {
        if (!previewCombination?.secondOutput || isPreviewDragging) {
            return;
        }

        const syncSecondPreviewHomePosition = () => {
            const centered2 = getOutputCenterPosition2();
            if (centered2) {
                setPreviewHomePosition2(centered2);
            }
        };

        syncSecondPreviewHomePosition();

        const frameId = window.requestAnimationFrame(() => {
            syncSecondPreviewHomePosition();
        });

        const timeoutId = window.setTimeout(() => {
            syncSecondPreviewHomePosition();
        }, 240);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [getOutputCenterPosition2, isPreviewDragging, previewCombination]);

    useEffect(() => {
        if (!isDeferredModeActive) {
            return;
        }

        if (activeDeferredJob !== null) {
            return;
        }

        const modeKey = insertedModeStateKey as "incubate" | "refine";
        if (!deferredCompletionRevealModes.has(modeKey)) {
            return;
        }

        setIsDeferredShutterOpening(true);
        const timeoutId = window.setTimeout(() => {
            setIsDeferredShutterOpening(false);
            setDeferredCompletionRevealModes((prev) => {
                const next = new Set(prev);
                next.delete(modeKey);
                return next;
            });
        }, MODE_SHUTTER_CLOSE_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [activeDeferredJob, deferredCompletionRevealModes, insertedModeStateKey, isDeferredModeActive]);

    useEffect(() => {
        if (!isPreviewPointerDown) {
            return;
        }

        const handleMove = (event: PointerEvent) => {
            if (!isPreviewDragging) {
                const origin = previewPointerDownStartRef.current;
                if (!origin) {
                    return;
                }

                const deltaX = event.clientX - origin.x;
                const deltaY = event.clientY - origin.y;
                const travelDistance = Math.hypot(deltaX, deltaY);

                if (travelDistance < PREVIEW_DRAG_START_THRESHOLD_PX) {
                    return;
                }

                setIsPreviewDragging(true);
                previewDragStartedRef.current = true;
                setIsPreviewTooltipPinned(false);
                setIsPreviewHovered(false);
                setIsPreviewTooltipHovered(false);
                setIsPreviewTooltipGraceOpen(false);
                clearPreviewTooltipGraceTimeout();
            }

            if (!isPreviewDragging) {
                return;
            }

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
            const wasDragging = previewDragStartedRef.current;
            previewDragStartedRef.current = false;
            setIsPreviewPointerDown(false);
            previewPointerDownStartRef.current = null;

            if (!wasDragging) {
                if (suppressPreviewPinOnPointerUpRef.current) {
                    suppressPreviewPinOnPointerUpRef.current = false;
                    return;
                }

                setIsPreviewTooltipPinned(true);
                setIsPreviewHovered(false);
                setIsPreviewTooltipHovered(false);
                setIsPreviewTooltipGraceOpen(false);
                clearPreviewTooltipGraceTimeout();
                return;
            }

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
    }, [clearPreviewTooltipGraceTimeout, finalizeCombination, getOutputCenterPosition, isPreviewDragging, isPreviewPointerDown, previewPointerOffset.x, previewPointerOffset.y]);

    useEffect(() => {
        if (!isPreviewTooltipPinned) {
            return;
        }

        const handleWindowPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target) {
                setIsPreviewTooltipPinned(false);
                setIsPreviewHovered(false);
                setIsPreviewTooltipHovered(false);
                setIsPreviewTooltipGraceOpen(false);
                clearPreviewTooltipGraceTimeout();
                return;
            }

            if ((event.ctrlKey || event.metaKey) && target.closest("#Draggable")) {
                return;
            }

            if (target.closest(".floating-tooltip")) {
                return;
            }

            setIsPreviewTooltipPinned(false);
            setIsPreviewHovered(false);
            setIsPreviewTooltipHovered(false);
            setIsPreviewTooltipGraceOpen(false);
            clearPreviewTooltipGraceTimeout();
        };

        window.addEventListener("pointerdown", handleWindowPointerDown, true);
        return () => {
            window.removeEventListener("pointerdown", handleWindowPointerDown, true);
        };
    }, [clearPreviewTooltipGraceTimeout, isPreviewTooltipPinned]);

    const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();

        previewDragStartedRef.current = false;

        if (isPreviewTooltipPinned) {
            suppressPreviewPinOnPointerUpRef.current = true;
            setIsPreviewTooltipPinned(false);
            setIsPreviewHovered(false);
            setIsPreviewTooltipHovered(false);
            setIsPreviewTooltipGraceOpen(false);
            clearPreviewTooltipGraceTimeout();
            setIsPreviewPointerDown(true);
            previewPointerDownStartRef.current = { x: event.clientX, y: event.clientY };
            return;
        }

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
        setIsPreviewPointerDown(true);
        previewPointerDownStartRef.current = { x: event.clientX, y: event.clientY };
        setIsPreviewTooltipGraceOpen(false);
        clearPreviewTooltipGraceTimeout();
        setIsPreviewHovered(false);
        setIsPreviewTooltipHovered(false);
        setIsPreviewAltLockActive(false);
        previewPositionRef.current = initial;
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
        if (isPreviewTooltipPinned) {
            return;
        }

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
        if (isPreviewTooltipPinned) {
            clearPreviewTooltipGraceTimeout();
            setIsPreviewTooltipGraceOpen(false);
            setIsPreviewTooltipHovered(true);
            return;
        }

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
        if (isPreviewTooltipPinned) {
            setIsPreviewTooltipHovered(false);
            return;
        }

        setIsPreviewTooltipHovered(false);

        if (isPreviewAltLockActive && (isPreviewAltHeld || previewAltHeldRef.current)) {
            return;
        }

        startPreviewTooltipGraceClose();
    };

    const isPreviewAltStickyOpen = isPreviewAltLockActive && isPreviewAltHeld;
    const isPreviewTooltipOpen = !isPreviewDragging && (
        isPreviewTooltipPinned ||
        isPreviewHovered ||
        isPreviewTooltipHovered ||
        isPreviewTooltipGraceOpen ||
        isPreviewAltStickyOpen
    );

    const handleFreeDropped = (draggableId: number, pos: Position) => {
        const slottedIds = new Set<number>([
            ...zoneOccupants.filter((x): x is number => x !== null),
            ...spellSlots.filter((x): x is number => x !== null),
            ...(createBaseSlotId !== null ? [createBaseSlotId] : []),
            ...createElemSlotIds.filter((x): x is number => x !== null),
            ...unlockSlotOccupants.filter((x): x is number => x !== null),
            ...(enhanceSlotOccupantId !== null ? [enhanceSlotOccupantId] : []),
            ...(machineSlotOccupantId !== null ? [machineSlotOccupantId] : []),
        ]);

        const withDrop = draggables.map((d) =>
            d.id === draggableId ? { ...d, initialPosition: pos } : d,
        );
        const { draggables: separated, movedIds } = separateOverlappingDraggables(withDrop, slottedIds);

        setDraggables(separated);

        // Animate bystanders that were nudged away (not the dropped element itself).
        const pushedIds = [...movedIds].filter((id) => id !== draggableId);
        if (pushedIds.length > 0) {
            setReturnHomeVersions((prev) => {
                const next = { ...prev };
                for (const id of pushedIds) next[id] = (next[id] ?? 0) + 1;
                return next;
            });
        }
    };

    const handleSnapChange = (draggableId: number, zoneIndex: number | null) => {
        // Clear from spell slots whenever this element moves
        for (let i = 0; i < spellSlots.length; i++) {
            if (spellSlots[i] === draggableId) {
                setSpellSlotElement(i, null);
                break;
            }
        }

        // Clear from create slots whenever this element moves
        setCreateBaseSlotId((prev) => (prev === draggableId ? null : prev));
        setCreateElemSlotIds((prev) => prev.map((id) => (id === draggableId ? null : id)));
        // Clear from unlock slots whenever this element moves
        setUnlockSlotOccupants((prev) => prev.map((id) => (id === draggableId ? null : id)) as [number | null, number | null, number | null]);

        // If dropping onto an unlock slot
        if (zoneIndex !== null && zoneIndex >= unlockSlotStartIndex) {
            const localIndex = zoneIndex - unlockSlotStartIndex;
            setUnlockSlotOccupants((prev) => {
                const next: [number | null, number | null, number | null] = [...prev] as [number | null, number | null, number | null];
                next[localIndex] = draggableId;
                return next;
            });
            setZoneOccupants((previous) => normalizeZoneOccupants(
                previous.map((occupantId) => (occupantId === draggableId ? null : occupantId)),
            ));
            setEnhanceSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            setMachineSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            return;
        }

        // If dropping onto a create slot
        if (zoneIndex !== null && zoneIndex >= createSlotStartIndex) {
            const localIndex = zoneIndex - createSlotStartIndex;
            if (localIndex === 0) {
                setCreateBaseSlotId(draggableId);
            } else {
                const elemIndex = localIndex - 1;
                setCreateElemSlotIds((prev) => {
                    const next = [...prev];
                    while (next.length <= elemIndex) next.push(null);
                    next[elemIndex] = draggableId;
                    return next;
                });
            }
            setZoneOccupants((previous) => normalizeZoneOccupants(
                previous.map((occupantId) => (occupantId === draggableId ? null : occupantId)),
            ));
            setEnhanceSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            setMachineSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            return;
        }

        // If dropping onto a spell slot, assign it and stop
        if (zoneIndex !== null && zoneIndex >= spellSlotStartIndex) {
            const slotLocalIndex = zoneIndex - spellSlotStartIndex;
            setSpellSlotElement(slotLocalIndex, draggableId);
            // Also clear from combination zones
            setZoneOccupants((previous) => normalizeZoneOccupants(
                previous.map((occupantId) => (occupantId === draggableId ? null : occupantId)),
            ));
            setEnhanceSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            setMachineSlotOccupantId((previous) => (previous === draggableId ? null : previous));
            return;
        }

        if (Object.values(modeOutputElementIds).some((ids) => ids?.includes(draggableId))) {
            setModeOutputElementIds((previous) => {
                const next: Partial<Record<string, number[]>> = {};
                let changed = false;
                for (const [modeKey, ids] of Object.entries(previous)) {
                    const filtered = (ids ?? []).filter((id) => id !== draggableId);
                    if (filtered.length > 0) {
                        next[modeKey] = filtered;
                    }
                    if (filtered.length !== (ids ?? []).length) {
                        changed = true;
                    }
                }
                return changed ? next : previous;
            });
        }

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

        // Fragment slots: create elem slots (localIndex > 0) only accept fragments;
        // base element slot (localIndex === 0) rejects fragments.
        if (zoneIndex >= createSlotStartIndex && zoneIndex < unlockSlotStartIndex) {
            if (enemyCardMode !== "create" || isCreatingHomunculus) return false;
            const localIndex = zoneIndex - createSlotStartIndex;
            if (localIndex === 0) {
                if (draggable.category === "fragment" || draggable.category === "spell" || draggable.category === "soul") return false;
                return createBaseSlotId === null || createBaseSlotId === draggableId;
            }
            const elemIndex = localIndex - 1;
            if (elemIndex >= elemSlotCount) return false;
            if (draggable.category !== "fragment") return false;
            const occupant = createElemSlotIds[elemIndex] ?? null;
            return occupant === null || occupant === draggableId;
        }

        // Fragments may only snap to elem slots (handled above) — reject everywhere else
        if (draggable.category === "fragment") return false;

        // Spell slots: any non-fragment element can snap to a spell slot
        if (zoneIndex >= spellSlotStartIndex && zoneIndex < createSlotStartIndex) {
            const slotLocalIndex = zoneIndex - spellSlotStartIndex;
            if (slotLocalIndex >= spellSlots.length) return false;
            return spellSlots[slotLocalIndex] === null || spellSlots[slotLocalIndex] === draggableId;
        }

        // Unlock slots: accept non-spell, non-soul, non-fragment elements
        if (zoneIndex >= unlockSlotStartIndex) {
            const localIndex = zoneIndex - unlockSlotStartIndex;
            if (localIndex >= 3) return false;
            if (!isCurrentModeLocked) return false;
            if (draggable.category === "spell" || draggable.category === "soul") return false;
            const occupant = unlockSlotOccupants[localIndex];
            return occupant === null || occupant === draggableId;
        }

        // While a mode is locked, block normal combination-slot snapping (including
        // hidden phantom layout slots) so only unlock slots can accept drops there.
        if (isCurrentModeLocked && zoneIndex < zoneOccupants.length) {
            return false;
        }

        // Block the logic panel slot while a deferred job is processing for this mode.
        if (zoneIndex === 1 && activeDeferredJob !== null) {
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

                const occupantId = zoneOccupants[zoneIndex];
        return occupantId === null || occupantId === draggableId;
    };

    const enhanceSlottedDraggable = getDraggableById(enhanceSlotOccupantId);
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

    const handleBossTransitionComplete = useCallback(() => {
        setBossIndex((prev) => prev + 1);
        setBattlesCompleted(0);
        setWarriorAnimateVersion(0); // reset so visualIndex in BossCountdown syncs to dot 0
        try { window.localStorage.setItem(BOSS_COUNTDOWN_KEY, "0"); } catch { /* ignore */ }
    }, []);

    const handleBossFight = () => {
        if (!bossEnemy) return;
        setNewChestElementIds(new Set());
        navigate("/fight", {
            state: {
                enemy: bossEnemy,
                elementPool: allElementOptions,
            },
        });
    };

    const handleFight = () => {
        if (!nextEnemy) return;

        setNewChestElementIds(new Set());

        // If the current enemy was created (homunculus) it won't be in the regular
        // enemies list. Fight it directly without advancing the regular enemy queue.
        const currentIndex = enemies.findIndex((enemy) => enemy.name === nextEnemy.name);
        if (currentIndex === -1) {
            navigate("/fight", {
                state: {
                    enemy: nextEnemy,
                    elementPool: allElementOptions,
                },
            });
            return;
        }

        // Fight the currently selected enemy and preselect the next row in order.
        const safeCurrentIndex = currentIndex;
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

    /** Build the matched homunculus row from the current create-slot elements. */
    const matchedHomunculusRow = useMemo((): HomunculusRow | null => {
        if (!createBaseSlotId || !homunculusWorkbook) return null;
        const primaryElemId = createElemSlotIds[0] ?? null;
        const baseElem = getDraggableById(createBaseSlotId);
        if (!baseElem) return null;
        const baseType = normalizeType(baseElem.type1 || baseElem.letter);
        const rowsForBase = homunculusWorkbook.filterByBaseElement(baseType);

        if (primaryElemId) {
            const elemItem = getDraggableById(primaryElemId);
            if (!elemItem) return null;
            const elemType = normalizeType(elemItem.type1 || elemItem.letter);
            return rowsForBase.find((row) => normalizeType(row.element) === elemType) ?? null;
        }

        // Support base-only recipes when no primary element is inserted.
        const baseOnlyRows = rowsForBase.filter((row) => {
            const elementType = normalizeType(row.element);
            return (
                elementType.length === 0
                || elementType === "none"
                || elementType === "base"
                || elementType === "self"
                || elementType === "solo"
                || elementType === "any"
                || elementType === "na"
                || elementType === "n/a"
                || elementType === baseType
            );
        });

        if (baseOnlyRows.length > 0) {
            return baseOnlyRows[0] ?? null;
        }

        // If there is exactly one row for this base type, allow it as base-only.
        if (rowsForBase.length === 1) {
            return rowsForBase[0] ?? null;
        }

        return null;
    }, [createBaseSlotId, createElemSlotIds, homunculusWorkbook, getDraggableById]);

    /** Stat meters shown to the right of the enemy card. */
    const homunculusFragmentBonuses = useMemo(() => {
        const bonuses = { hp: 0, def: 0, pwr: 0, spd: 0 };
        const slottedElems = createElemSlotIds
            .map((id) => getDraggableById(id))
            .filter(Boolean) as NonNullable<ReturnType<typeof getDraggableById>>[];

        slottedElems.forEach((elem) => {
            if (elem.category !== "fragment") {
                return;
            }

            const fragmentType = normalizeType(elem.type1 || elem.letter);
            if (fragmentType === "fire") {
                bonuses.pwr += Math.max(5, elem.damage ?? 0);
                return;
            }
            if (fragmentType === "water") {
                bonuses.def += Math.max(5, elem.shield ?? 0);
                return;
            }
            if (fragmentType === "earth") {
                bonuses.hp += Math.max(5, elem.shield ?? 0);
                return;
            }
            if (fragmentType === "air") {
                bonuses.spd += Math.max(5, elem.damage ?? 0);
            }
        });

        return bonuses;
    }, [createElemSlotIds, getDraggableById]);

    const homunculusMeters = useMemo(() => {
        // Fight / Consume mode: derive from the enemy's first element; fall back to 5% floor
        // for enemies that have no elements (e.g. Scarecrow).
        if (enemyCardMode === "fight" || enemyCardMode === "consume") {
            const fightElem = nextEnemy?.elements?.[0];
            if (!fightElem) return { hp: 5, def: 0, pwr: 0, exp: 5 };
            const d = fightElem.damage ?? 0;
            const s = fightElem.shield ?? 0;
            const e = fightElem.energy ?? 0;
            return {
                hp:  Math.min(100, s + d),
                def: Math.min(100, s),
                pwr: Math.min(100, d),
                exp: Math.min(100, e * 3),
            };
        }
        // Create mode: start from base element stats, then apply fragment-specific bonuses.
        const base = getDraggableById(createBaseSlotId);
        const damage = base?.damage ?? 0;
        const shield = base?.shield ?? 0;
        const energy = base?.energy ?? 0;
        const hp = shield + damage + homunculusFragmentBonuses.hp;
        const def = shield + homunculusFragmentBonuses.def;
        const pwr = damage + homunculusFragmentBonuses.pwr;
        const spd = (energy * 3) + homunculusFragmentBonuses.spd;
        return {
            hp:  Math.min(100, hp),
            def: Math.min(100, def),
            pwr: Math.min(100, pwr),
            exp: Math.min(100, spd),
        };
    }, [createBaseSlotId, createElemSlotIds, getDraggableById, enemyCardMode, nextEnemy, homunculusFragmentBonuses]);

    const handleCreate = () => {
        if (!matchedHomunculusRow || isCreatingHomunculus) return;
        const row = matchedHomunculusRow;

        const consumedIds = [createBaseSlotId, ...createElemSlotIds]
            .filter((id): id is number => id !== null);

        const hpStat = homunculusMeters.hp;
        const pwrStat = homunculusMeters.pwr;
        const defStat = homunculusMeters.def;
        const baseElem = getDraggableById(createBaseSlotId);
        const energyStat = Math.max(0, Math.round(homunculusMeters.exp / 3));

        // Compute resistances: same +25/-25 additive formula as player spell-slot resistances.
        const slottedForResist = createElemSlotIds
            .map((id) => getDraggableById(id))
            .filter(Boolean) as NonNullable<ReturnType<typeof getDraggableById>>[];
        const allCreatedElems = [baseElem, ...slottedForResist].filter((e): e is NonNullable<typeof baseElem> => Boolean(e));
        const homunculusResistances: Partial<Record<string, number>> = {};
        for (const elem of allCreatedElems) {
            const rtype = resolveResistanceElementType(elem.type1, elem.letter);
            if (rtype) {
                homunculusResistances[rtype] = (homunculusResistances[rtype] ?? 0) + 25;
                const counter = RESISTANCE_COUNTER_TYPE[rtype];
                homunculusResistances[counter] = (homunculusResistances[counter] ?? 0) - 25;
            }
        }

        const homunculusFragments: RewardElement[] = slottedForResist
            .filter((elem) => elem.category === "fragment")
            .map((elem) => ({
                letter: elem.letter,
                damage: elem.damage,
                shield: elem.shield,
                energy: elem.energy,
                enhancements: elem.enhancements,
                rank: elem.rank,
                level: elem.level,
                description: elem.description,
                type1: elem.type1,
                type2: elem.type2,
                effects: elem.effects,
                category: elem.category,
            }));

        const homunculus: Enemy = {
            name: row.name,
            // Homunculus HP/PWR/DEF come directly from the meter stats.
            hp: hpStat,
            power: pwrStat,
            souls: Number(row.extras["Souls"] ?? row.extras["souls"] ?? 1),
            description: String(row.extras["Description"] ?? row.extras["description"] ?? ""),
            sprite: `homunculus/${row.name.replace(/\s+/g, "")}`,
            weaknesses: [],
            resistances: homunculusResistances,
            elements: [{
                letter: baseElem?.letter ?? row.name,
                damage: pwrStat,
                shield: defStat,
                energy: energyStat,
                rank: 1,
                level: 1,
                description: "Homunculus attack profile",
                type1: normalizeType(baseElem?.type1 || baseElem?.letter),
                category: "element",
            }],
            baseElement: baseElem ? {
                letter: baseElem.letter,
                damage: baseElem.damage,
                shield: baseElem.shield ?? 0,
                energy: baseElem.energy ?? 0,
                rank: baseElem.rank,
                level: baseElem.level,
                description: baseElem.description,
                type1: baseElem.type1,
                type2: baseElem.type2,
                effects: baseElem.effects,
                category: baseElem.category,
            } : undefined,
            homunculusFragments,
        };

        setPendingCreatedEnemy(homunculus);
        setPendingBaseElemLetter(baseElem?.letter ?? null);
        setIsCreatingHomunculus(true);

        if (createHomunculusTimeoutRef.current !== null) {
            window.clearTimeout(createHomunculusTimeoutRef.current);
        }

        createHomunculusTimeoutRef.current = window.setTimeout(() => {
            // Consume slotted elements once forge animation is complete.
            consumeElements(consumedIds);
            setDraggables((prev) => prev.filter((d) => !consumedIds.includes(d.id)));
            setCreateBaseSlotId(null);
            setCreateElemSlotIds(Array(elemSlotCount).fill(null));

            setNextEnemy(homunculus);
            setEnemyCardMode("fight");
            setIsCreatingHomunculus(false);
            setPendingCreatedEnemy(null);
            setPendingBaseElemLetter(null);
            createHomunculusTimeoutRef.current = null;
        }, HOMUNCULUS_CREATE_ANIMATION_MS);
    };

    const handleAddElemSlot = () => {
        if (elemSlotCount >= 3) return;
        setElemSlotCount((prev) => prev + 1);
        setCreateElemSlotIds((prev) => [...prev, null]);
    };

    const handleRemoveElemSlot = () => {
        if (elemSlotCount <= 0) return;
        const removedId = createElemSlotIds[elemSlotCount - 1] ?? null;
        if (removedId !== null) {
            setReturnHomeVersions((prev) => ({ ...prev, [removedId]: (prev[removedId] ?? 0) + 1 }));
        }
        setElemSlotCount((prev) => prev - 1);
        setCreateElemSlotIds((prev) => prev.slice(0, prev.length - 1));
    };

    const STAT_ELEMENT_TYPE: Record<string, string> = {
        hp:  "earth",
        def: "water",
        pwr: "fire",
        spd: "air",
    };

    const getConsumeElementCount = (pct: number) => pct > 0 ? Math.floor(pct / 25) + 1 : 0;

    const CONSUME_ELEMENT_STAGGER_MS = 500;
    const CONSUME_ELEMENT_FLIGHT_MS = ELEMENT_FLIGHT_TRAVEL_MS;

    const launchBoostedBaseElementFlight = (template: RewardElement, damageBoost: number, shieldBoost: number) => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const cardRect = consumeCardRef.current?.getBoundingClientRect();
        if (!containerRect || !cardRect) return;

        const isFragment = template.category === "fragment";
        const spawnPos = isFragment
            ? getFragmentSpawnPosition(
                playerProgress.elements.filter((e) => e.category === "fragment").length,
              )
                        : getSpawnPosition(getElementStartCount());

        const startX = cardRect.left + cardRect.width / 2;
        const startY = cardRect.top + cardRect.height * 0.35;
        const targetX = containerRect.left + spawnPos.x + 16;
        const targetY = containerRect.top + spawnPos.y + 16;

        const flightId = elementFlightIdRef.current++;
        setElementFlightIcons((prev) => [...prev, {
            id: flightId,
            startX,
            startY,
            toX: targetX - startX,
            toY: targetY - startY,
            letter: template.letter,
            delayMs: 0,
        }]);

        const landId = window.setTimeout(() => {
            setElementFlightIcons((prev) => prev.filter((ic) => ic.id !== flightId));
            addElement({ ...template, initialPosition: spawnPos });

            if (damageBoost > 0 || shieldBoost > 0) {
                const toastId = newElementToastIdRef.current++;
                setStatBoostToasts((prev) => [...prev, { id: toastId, x: spawnPos.x, y: spawnPos.y, damageBoost, shieldBoost }]);
                window.setTimeout(() => {
                    setStatBoostToasts((prev) => prev.filter((t) => t.id !== toastId));
                }, 2600);
            }
        }, ELEMENT_FLIGHT_TRAVEL_MS);

        consumeFlightTimeoutsRef.current.push(landId);
    };

    const FRAGMENT_NAME_BY_TYPE: Record<string, string> = {
        fire: "Fire Fragment",
        water: "Water Fragment",
        earth: "Earth Fragment",
        air: "Air Fragment",
    };

    const buildFragmentRewardTemplate = (
        elementType: string,
        baseElement: RewardElement | null,
    ): RewardElement | null => {
        const fragmentName = FRAGMENT_NAME_BY_TYPE[elementType];
        if (!fragmentName) {
            return null;
        }

        const catalogEntry = allElementOptionsRef.current.find((e) => e.letter === fragmentName);
        const fallbackTemplate: RewardElement = {
            letter: fragmentName,
            damage: 0,
            shield: 0,
            energy: 1,
            rank: 1,
            level: 1,
            description: fragmentName,
            type1: elementType,
            category: "fragment",
        };

        const source = catalogEntry ?? fallbackTemplate;
        const sourceDamage = Number(baseElement?.damage ?? source.damage ?? 0) || 0;
        const sourceShield = Number(baseElement?.shield ?? source.shield ?? 0) || 0;

        return {
            ...source,
            letter: fragmentName,
            type1: elementType,
            category: "fragment",
            damage: Math.max(0, Math.round(sourceDamage * 0.5)),
            shield: Math.max(0, Math.round(sourceShield * 0.5)),
            energy: 1,
        };
    };

    const launchConsumeElementFlights = (elementType: string, count: number, baseElementCount: number) => {
        const containerRect = gameRef.current?.getBoundingClientRect();
        const cardRect = consumeCardRef.current?.getBoundingClientRect();
        if (!containerRect || !cardRect) return;

        const template = buildFragmentRewardTemplate(elementType, nextEnemy?.baseElement ?? null);
        if (!template) return;

        // Count how many fragment-category elements already exist so new ones
        // stack into their own tighter grid instead of sharing the element-start zone.
        const existingFragmentCount = playerProgress.elements.filter(
            (e) => e.category === "fragment",
        ).length;

        const startX = cardRect.left + cardRect.width / 2;
        const startY = cardRect.top + cardRect.height * 0.35;

        for (let i = 0; i < count; i++) {
            const spawnIndex = existingFragmentCount + i;
            const spawnPos = getFragmentSpawnPosition(spawnIndex);

            const targetX = containerRect.left + spawnPos.x + 16;
            const targetY = containerRect.top + spawnPos.y + 16;
            const toX = targetX - startX;
            const toY = targetY - startY;
            const delayMs = i * CONSUME_ELEMENT_STAGGER_MS;

            const flightId = elementFlightIdRef.current++;
            const flightIcon: ElementFlightIcon = {
                id: flightId,
                startX,
                startY,
                toX,
                toY,
                letter: template.letter,
                delayMs,
            };

            const launchId = window.setTimeout(() => {
                setElementFlightIcons((prev) => [...prev, flightIcon]);

                const landId = window.setTimeout(() => {
                    setElementFlightIcons((prev) => prev.filter((ic) => ic.id !== flightId));
                    pendingDropSpawnByIdRef.current.set(nextId.current, spawnPos);
                    addElement({ ...template, initialPosition: spawnPos });
                }, CONSUME_ELEMENT_FLIGHT_MS);

                consumeFlightTimeoutsRef.current.push(landId);
            }, delayMs);

            consumeFlightTimeoutsRef.current.push(launchId);
        }
    };

    const handleConsume = () => {
        if (isConsuming || isDrainShaking || !nextEnemy) return;

        // Ordered meter definitions — only ones with pct > 0 can be drained.
        const meterDefs = [
            { key: "hp",  pct: homunculusMeters.hp,  color: "#4ade80" },
            { key: "def", pct: homunculusMeters.def, color: "#60a5fa" },
            { key: "pwr", pct: homunculusMeters.pwr, color: "#fb923c" },
            { key: "spd", pct: homunculusMeters.exp, color: "#fb923c" },
        ];
        const filled = meterDefs.filter((m) => m.pct > 0);

        const drainedSoFar = consumeDrainedMeters.size;

        if (drainedSoFar < filled.length) {
            // Drain the next filled meter with a colored shake.
            const meter = filled[drainedSoFar];
            setDrainShakeColor(meter.color);
            setIsDrainShaking(true);
            setConsumeDrainedMeters((prev) => new Set([...prev, meter.key]));
            window.setTimeout(() => setIsDrainShaking(false), 700);

            // Award elements for this stat
            const elementType = STAT_ELEMENT_TYPE[meter.key];
            const count = getConsumeElementCount(meter.pct);
            if (elementType && count > 0) {
                const baseElementCount = playerProgress.elements.length;
                const combinedTripleReward = buildCombinedTripleFragmentElement(
                    elementType,
                    nextEnemy.homunculusFragments ?? [],
                    allElementOptionsRef.current,
                );

                if (combinedTripleReward) {
                    launchBoostedBaseElementFlight(combinedTripleReward, 0, 0);
                } else {
                    launchConsumeElementFlights(elementType, count, baseElementCount);
                }
            }
        } else {
            // Compute the reward element
            const savedBase = nextEnemy?.baseElement ?? null;
            let rewardTemplate: RewardElement | null = null;
            let damageBoost = 0;
            let shieldBoost = 0;
            if (savedBase) {
                damageBoost = Math.round((savedBase.damage ?? 0) * (homunculusMeters.pwr + homunculusMeters.exp) / 100);
                shieldBoost = Math.round((savedBase.shield ?? 0) * (homunculusMeters.def + homunculusMeters.hp) / 100);
                rewardTemplate = { ...savedBase, damage: (savedBase.damage ?? 0) + damageBoost, shield: (savedBase.shield ?? 0) + shieldBoost };
            } else {
                // No base element — derive fragment type from first spell slot
                const firstSlotId = spellSlots[0] ?? null;
                const firstSlotElem = firstSlotId !== null
                    ? playerProgress.elements.find((e) => e.id === firstSlotId)
                    : null;
                const slotType = firstSlotElem?.type1 ? normalizeElementName(firstSlotElem.type1) : null;
                if (slotType) {
                    rewardTemplate = buildFragmentRewardTemplate(slotType, null);
                }
                // else rewardTemplate stays null — no reward given
            }
            const finalRewardTemplate = rewardTemplate;
            const finalDamageBoost = damageBoost;
            const finalShieldBoost = shieldBoost;

            if (finalRewardTemplate) {
                // Phase 1 (0–1s): sprite shakes + burns white
                setIsConsuming(true);
                setConsumeFinaleTemplate(finalRewardTemplate);
                setConsumeFinalePhase(1);

                // Phase 2 (1–2s): sprite hides, element icon appears and shrinks to draggable size
                const phase2Id = window.setTimeout(() => {
                    setConsumeFinalePhase(2);
                }, 1000);

                // Phase 3 (2s+): clear icon, launch element flight, switch mode when it lands
                const phase3Id = window.setTimeout(() => {
                    setConsumeFinaleTemplate(null);
                    launchBoostedBaseElementFlight(finalRewardTemplate, finalDamageBoost, finalShieldBoost);
                    window.setTimeout(() => {
                        setIsConsuming(false);
                        setConsumeFinalePhase(null);
                        setConsumeDrainedMeters(new Set());
                        setEnemyCardMode("create");
                        // If a boss was just consumed, trigger the skull transition.
                        const wasBoss = battlesCompleted > BOSS_BATTLE_THRESHOLD
                            && nextEnemy !== null
                            && enemies.some((e) => e.name === nextEnemy.name);
                        if (wasBoss) {
                            setBossTransitionVersion((v) => v + 1);
                        }
                    }, ELEMENT_FLIGHT_TRAVEL_MS + 100);
                }, 2000);

                consumeFlightTimeoutsRef.current.push(phase2Id, phase3Id);
            } else {
                // No reward — simple shake-and-disappear then switch mode
                setDrainShakeColor("#ef4444");
                setIsConsuming(true);
                window.setTimeout(() => {
                    setIsConsuming(false);
                    setConsumeDrainedMeters(new Set());
                    setEnemyCardMode("create");
                    const wasBoss = battlesCompleted > BOSS_BATTLE_THRESHOLD
                        && nextEnemy !== null
                        && enemies.some((e) => e.name === nextEnemy.name);
                    if (wasBoss) {
                        setBossTransitionVersion((v) => v + 1);
                    }
                }, 2000);
            }
        }
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
                        rank: 0,
                        level: 1,
                        description: "Could be useful as a base...",
                        effects: [{ kind: "brittle", target: "self" }],
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
        const spawnPosition = getSpawnPosition(getElementStartCount());
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
                    initialPosition: spawnPosition,
                });
            } else {
                addElement({
                    ...chosenElement,
                    initialPosition: spawnPosition,
                });
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
    const slotTwoPreviewDraggable = getDraggableById(zoneOccupants[1] ?? null);
    const currentModeOutputIds = new Set(modeOutputElementIds[insertedModeStateKey] ?? []);
    const hiddenModeOutputElementIds = useMemo(() => {
        const hidden = new Set<number>();
        for (const [modeKey, ids] of Object.entries(modeOutputElementIds)) {
            if (modeKey !== insertedModeStateKey) {
                (ids ?? []).forEach((id) => hidden.add(id));
            }
        }
        return hidden;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeOutputElementIds, insertedModeStateKey]);
    const hasOutputElementInSlot = currentModeOutputIds.size > 0 || previewCombination !== null;

    const effectSignature = (effects?: SpellEffectConfig[]) =>
        JSON.stringify((effects ?? []).map((effect) => ({
            kind: effect.kind,
            amount: effect.amount ?? null,
            duration: effect.duration ?? null,
            hits: effect.hits ?? null,
            target: effect.target ?? null,
            targetType: effect.targetType ?? null,
        })));

    const changedKeys = useMemo(() => {
        if (!slotTwoPreviewDraggable || !previewCombination) return new Set<string>();
        const changed = new Set<string>();
        if (slotTwoPreviewDraggable.damage !== previewCombination.damage) changed.add("damage");
        if ((slotTwoPreviewDraggable.energy ?? 0) !== (previewCombination.energy ?? 0)) changed.add("energy");
        if (slotTwoPreviewDraggable.type1 !== previewCombination.type1) changed.add("type1");
        if (slotTwoPreviewDraggable.type2 !== previewCombination.type2) changed.add("type2");
        if (slotTwoPreviewDraggable.level !== previewCombination.level) changed.add("level");
        if (effectSignature(slotTwoPreviewDraggable.effects) !== effectSignature(previewCombination.effects)) changed.add("effects");
        if (Boolean(slotTwoPreviewDraggable.enhancements?.incubated) !== Boolean(previewCombination.enhancements?.incubated)) changed.add("enhancement-incubated");
        if (Boolean(slotTwoPreviewDraggable.enhancements?.divided) !== Boolean(previewCombination.enhancements?.divided)) changed.add("enhancement-divided");
        if (Boolean(slotTwoPreviewDraggable.enhancements?.mixed) !== Boolean(previewCombination.enhancements?.mixed)) changed.add("enhancement-mixed");
        if (Boolean(slotTwoPreviewDraggable.enhancements?.refined) !== Boolean(previewCombination.enhancements?.refined)) changed.add("enhancement-refined");
        return changed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slotTwoPreviewDraggable, previewCombination]);
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
            {statBoostToasts.map((toast) => (
                <div
                    key={toast.id}
                    className="stat-boost-toast"
                    style={{ left: toast.x + 16, top: toast.y }}
                    aria-hidden="true"
                >
                    {toast.damageBoost > 0 && (
                        <span className="stat-boost-toast-row">
                            <img src={powerIcon} className="stat-boost-toast-icon" alt="" />
                            <span>+{toast.damageBoost}</span>
                        </span>
                    )}
                    {toast.shieldBoost > 0 && (
                        <span className="stat-boost-toast-row">
                            <img src={shieldIcon} className="stat-boost-toast-icon" alt="" />
                            <span>+{toast.shieldBoost}</span>
                        </span>
                    )}
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
            {draggables
                .filter((draggable) => {
                    if (draggable.id === hiddenInsertedModeElementId) return false;
                    if (hiddenModeOutputElementIds.has(draggable.id)) return false;
                    // During create animation hide the elements that were in the create slots.
                    if (isCreatingHomunculus) {
                        if (createBaseSlotId === draggable.id) return false;
                        if (createElemSlotIds.includes(draggable.id)) return false;
                    }
                    return true;
                })
                .map((draggable) => (
                <Draggable
                    key={draggable.id}
                    id={draggable.id}
                    letter={draggable.letter}
                    damage={draggable.damage}
                    shield={draggable.shield}
                    energy={draggable.energy}
                    enhancements={draggable.enhancements}
                    description={draggable.description}
                    showTutorialCue={draggable.id === 1 && !hasSeenDragTutorial}
                    onDismissTutorialCue={handleDismissDragTutorial}
                    type1={draggable.type1}
                    type2={draggable.type2}
                    effects={draggable.effects}
                    level={draggable.level}
                    category={draggable.category}
                    containerRef={gameRef}
                    dropZoneRefs={allDropZoneRefsAll}
                    initialPosition={draggable.initialPosition}
                    onSnapChange={handleSnapChange}
                    onFreeDropped={handleFreeDropped}
                    canSnapToZone={canSnapToZone}
                    isNewFromChest={newChestElementIds.has(draggable.id)}
                    forcedSnapZone={
                        spellSlotForcedSnaps[draggable.id]
                            ?? (draggable.id === modeTransformForcedSnap?.id
                                ? { zone: 0, version: modeTransformForcedSnap.version }
                                : isPlasmaName(draggable.letter) ? plasmaForcedSnap : null)
                    }
                    returnHomeVersion={returnHomeVersions[draggable.id] ?? 0}
                    zIndexOverride={draggable.category === "fragment" ? 9100 : undefined}
                />
            ))}

            {previewCombination ? (
                <>
                    <div
                        ref={previewRef}
                        className={[
                            "drag",
                            "drag-preview",
                            previewCombination.isDeferred ? "is-deferred" : "",
                            isPreviewDragging ? "is-dragging" : "",
                            isPreviewTooltipPinned ? "is-tooltip-pinned" : "",
                            previewCombination.category === "spell" ? "is-spell" : "",
                            previewCombination.category === "spell" ? `is-spell--${previewCombination.type1 || previewCombination.type2 || "none"}` : "",
                            previewCombination.category === "weapon" ? "is-weapon" : "",
                        ].filter(Boolean).join(" ")}
                        onPointerDown={handlePreviewPointerDown}
                        onMouseEnter={handlePreviewMouseEnter}
                        onMouseLeave={handlePreviewMouseLeave}
                        style={{
                            position: "absolute",
                            top: (isPreviewDragging ? previewPosition : previewHomePosition)?.y ?? 0,
                            left: (isPreviewDragging ? previewPosition : previewHomePosition)?.x ?? 0,
                            zIndex: 9350,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            cursor: isPreviewDragging ? "grabbing" : "grab",
                            userSelect: "none",
                        }}
                    >
                        {previewCombination.isDeferred
                            ? <span className="drag-preview__deferred-label">?</span>
                            : <ElementIcon name={previewCombination.letter} />}
                    </div>
                    <PreviewOutputTooltip
                        anchorElement={previewRef.current}
                        afterDetails={previewToElementDetails(previewCombination)}
                        beforeDetails={slotTwoPreviewDraggable ? draggableToElementDetails(slotTwoPreviewDraggable) : null}
                        showComparison={Boolean(slotTwoPreviewDraggable) && (isOutputHovered || isPreviewHovered || isCombineButtonHovered)}
                        isOpen={isPreviewTooltipOpen}
                        isSelected={isPreviewTooltipPinned}
                        isInteractive={isPreviewAltHeld || isPreviewTooltipPinned}
                        onTooltipMouseEnter={handlePreviewTooltipMouseEnter}
                        onTooltipMouseLeave={handlePreviewTooltipMouseLeave}
                        className={`drag-description-popup${isPreviewTooltipPinned ? " is-pinned" : ""}`}
                        changedKeys={changedKeys}
                        typeMultipliers={typeMultipliers}
                        standaloneContent={previewCombination.isDeferred
                            ? <p className="deferred-tooltip-message">{previewCombination.description}</p>
                            : undefined}
                        comparisonAfterContent={previewCombination.isDeferred && slotTwoPreviewDraggable
                            ? (
                                <div className={`floating-tooltip__panel tooltip-theme-${(slotTwoPreviewDraggable.type1 ?? slotTwoPreviewDraggable.type2 ?? "none").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                                    <div className="tooltip-container">
                                        <div className="element-title">
                                            <div>?</div>
                                            <div className="description">{previewCombination.description}</div>
                                        </div>
                                    </div>
                                </div>
                            )
                            : undefined}
                    />
                </>
            ) : null}
            {previewCombination?.secondOutput ? (
                <>
                    <div
                        ref={previewRef2}
                        className={[
                            "drag",
                            "drag-preview",
                            previewCombination.secondOutput.category === "spell" ? "is-spell" : "",
                            previewCombination.secondOutput.category === "spell" ? `is-spell--${previewCombination.secondOutput.type1 || previewCombination.secondOutput.type2 || "none"}` : "",
                            previewCombination.secondOutput.category === "weapon" ? "is-weapon" : "",
                        ].filter(Boolean).join(" ")}
                        style={{
                            position: "absolute",
                            top: previewHomePosition2?.y ?? 0,
                            left: previewHomePosition2?.x ?? 0,
                            zIndex: 9350,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            pointerEvents: "none",
                            userSelect: "none",
                        }}
                    >
                        <ElementIcon name={previewCombination.secondOutput.letter} />
                    </div>
                    <PreviewOutputTooltip
                        anchorElement={previewRef2.current}
                        afterDetails={secondOutputToElementDetails(previewCombination.secondOutput)}
                        beforeDetails={slotTwoPreviewDraggable ? draggableToElementDetails(slotTwoPreviewDraggable) : null}
                        showComparison={Boolean(slotTwoPreviewDraggable) && (isOutputHovered2 || isCombineButtonHovered)}
                        isOpen={isOutputHovered2}
                        changedKeys={changedKeys}
                        typeMultipliers={typeMultipliers}
                    />
                </>
            ) : null}
            <div className="inventory-start-row">
                <div className="element-start" ref={elementStartRef}></div>
                <div className="fragment-start" ref={fragmentStartRef}></div>
            </div>
            <div className="game-scene-row">
                {hasActiveUpgrades ? (
                <div className="game-scene-col game-scene-col--left">
                    <div className="upgrades-panel" aria-label="Active upgrades">
                        <div className="upgrades-panel-title">Upgrades</div>
                        <ul className="upgrades-panel-list">
                            {Object.entries(typeMultipliers).map(([type, mult]) => (
                                <li key={type} className={`upgrades-panel-item type-${type}`}>
                                    <span className="upgrades-item-type">{type}</span>
                                    <span className="upgrades-item-value">Ã—{mult.toFixed(1)}</span>
                                </li>
                            ))}
                            {shieldMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-shield">
                                    <span className="upgrades-item-type">shield gain</span>
                                    <span className="upgrades-item-value">Ã—{shieldMultiplier.toFixed(1)}</span>
                                </li>
                            ) : null}
                            {soakMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-soak">
                                    <span className="upgrades-item-type">soak stacks</span>
                                    <span className="upgrades-item-value">Ã—{soakMultiplier.toFixed(1)}</span>
                                </li>
                            ) : null}
                            {burnMultiplier > 1 ? (
                                <li className="upgrades-panel-item type-burn">
                                    <span className="upgrades-item-type">burn stacks</span>
                                    <span className="upgrades-item-value">Ã—{burnMultiplier.toFixed(1)}</span>
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
                            isInsertEnabled={isInsertEnabled}
                            isDuplicateCombinationReady={isDuplicateCombinationReady}
                            isNonDuplicateCombinationReady={isNonDuplicateCombinationReady}
                            firstSlotConnectorKey={firstSlotConnectorKey}
                            hasActiveCombinationState={hasActiveCombinationState}
                            combinationStationState={combinationStationState}
                            canCombine={canCombine}
                            onCombine={handleCombine}
                            dropZoneRefA={dropZoneRefA}
                            dropZoneRefB={dropZoneRefB}
                            dropZoneRefC={dropZoneRefC}
                            outputRef={outputRef}
                            outputRef2={outputRef2}
                            hoveredInsertSlot={hoveredInsertSlot}
                            onHoverInsertSlot={setHoveredInsertSlot}
                            isCombineButtonHovered={isCombineButtonHovered}
                            onCombineButtonHoverChange={setIsCombineButtonHovered}
                            onOutputHover={setIsOutputHovered}
                            onOutputHover2={setIsOutputHovered2}
                            hasOutputElementInSlot={hasOutputElementInSlot}
                            isModeInserted={insertedModeElementId !== null || isActiveModeSealed || isModeCollapsing}
                            isModeCollapseAnimating={isModeCollapseAnimating}
                                                        modeUsesRemaining={modeUsesRemaining}
                            sealedModeElementKeys={sealedModeTabElementKeys}
                            shouldAnimateModeShutter={insertedModeElementId !== null && isModeInsertAnimating}
                            modeInsertedElementLetter={insertedModeDraggable?.letter}
                            modeInsertedElementCategory={insertedModeDraggable?.category}
                            showModeInsertedElementOverlay={insertedModeElementId !== null && isModeInsertAnimating}
                            selectedModeTabElementKey={selectedModeTabElementKey}
                            onModeTabSelect={handleModeTabSelect}
                            onInsertMode={handleInsertMode}
                            incubateCounter={incubateCounter}
                            refineCounter={refineCounter}
                            onIncubateCounterChange={setIncubateCounter}
                            onRefineCounterChange={setRefineCounter}
                            pendingJobElement={activeDeferredJob
                                ? { letter: activeDeferredJob.inputElement.letter, category: activeDeferredJob.inputElement.category }
                                : null}
                            isSlotAnimatingClose={isDeferredShutterAnimating && isDeferredSlotClosed}
                            isSlotAnimatingOpen={isDeferredShutterOpening && isDeferredModeActive && !isDeferredSlotClosed}
                            isOutputSlotClosed={isDeferredSlotClosed}
                            isOutputSlotAnimatingClose={isDeferredShutterAnimating && isDeferredSlotClosed}
                            isOutputSlotAnimatingOpen={isDeferredShutterOpening && isDeferredModeActive && !isDeferredSlotClosed}
                            lockedModes={lockedModes}
                            unlockSlotRefs={[unlockSlotRef0, unlockSlotRef1, unlockSlotRef2]}
                            unlockSlotOccupants={unlockSlotOccupants}
                            getUnlockSlotLetter={getUnlockSlotLetter}
                            isUnlockReady={isUnlockReady}
                            onUnlock={handleUnlock}
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
                    <div className="enemy-card-with-meters">
                    {enemyCardMode === "create" ? (
                        <div className="game-enemy-card game-enemy-card--create">
                            <div className="next-enemy-text">
                                <span>Homunculus Lab</span>
                            </div>
                            <div className="game-enemy-card-header">
                                <div className="game-enemy-card-name">
                                    {isCreatingHomunculus
                                        ? (pendingCreatedEnemy?.name ?? matchedHomunculusRow?.name ?? "???")
                                        : (matchedHomunculusRow?.name ?? "???")}
                                </div>
                            </div>
                            <div className="game-enemy-stage create-stage">
                                {isCreatingHomunculus && pendingCreatedEnemy ? (
                                    <div className="create-forge-animation" aria-live="polite">
                                        <EnemyStage
                                            className="create-forge-stage"
                                            enemyName={pendingCreatedEnemy.name}
                                            spritePath={pendingCreatedEnemy.sprite}
                                            enemyHealth={pendingCreatedEnemy.hp}
                                            enemyMaxHp={pendingCreatedEnemy.hp}
                                            enemyPower={pendingCreatedEnemy.power}
                                            weaknesses={pendingCreatedEnemy.weaknesses}
                                            elements={pendingCreatedEnemy.elements}
                                            souls={pendingCreatedEnemy.souls}
                                        />
                                        {pendingBaseElemLetter ? (
                                            <div className="create-forge-elem-icon" aria-hidden="true">
                                                <ElementIcon name={pendingBaseElemLetter} />
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                <div className="create-slot-layout">
                                    <div className="create-slot-group">
                                        <span className="create-slot-label">Base Element</span>
                                        <div
                                            className={`create-slot-drop-zone${createBaseSlotId ? " has-element" : ""}`}
                                            ref={createBaseSlotRef}
                                        >
                                            {!createBaseSlotId && <img className="create-slot-empty" src={slotIcon} alt="" aria-hidden="true" />}
                                        </div>
                                    </div>
                                    <div
                                        className={`create-slot-connector${createBaseSlotId && (createElemSlotIds[0] ?? null) ? " is-lit" : ""}${elemSlotCount === 0 ? " is-hidden" : ""}`}
                                    />
                                    {/* Variable element slots */}
                                    <div className={`create-elem-section${elemSlotCount === 3 ? " create-elem-section--count-3" : ""}`}>
                                        <div className={`create-elem-slots${elemSlotCount === 0 ? " is-empty" : ""}`}>
                                            {elemSlotCount === 0 ? (
                                                <div className="create-elem-slot-entry" aria-hidden="true">
                                                    <div className="create-slot-drop-zone create-elem-slot-spacer" />
                                                </div>
                                            ) : Array.from({ length: elemSlotCount }, (_, i) => {
                                                const slotRef = [createElemSlotRef0, createElemSlotRef1, createElemSlotRef2][i];
                                                const slotId = createElemSlotIds[i] ?? null;
                                                const prevSlotId = i > 0 ? (createElemSlotIds[i - 1] ?? null) : null;
                                                return (
                                                    <div key={i} className="create-elem-slot-entry">
                                                        {i > 0 && (
                                                            <div className={`create-slot-connector create-slot-connector--h${prevSlotId && slotId ? " is-lit" : ""}`} />
                                                        )}
                                                        <div
                                                            className={`create-fragment-slot${slotId ? " has-element" : ""}`}
                                                            ref={slotRef}
                                                        >
                                                            {!slotId && <img className="create-fragment-slot-empty" src={fragmentSlotIcon} alt="" aria-hidden="true" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <span className="create-slot-label">Element</span>
                                </div>
                                )}
   
                            </div>
                            <div className="game-enemy-card-footer">
                                {isCreatingHomunculus
                                    ? "Creating homunculus..."
                                    : (matchedHomunculusRow ? "" : "Insert element(s) to Begin Creation")}
                            </div>
                        </div>
                    ) : enemyCardMode === "consume" ? (
                        <div ref={consumeCardRef} className={`game-enemy-card game-enemy-card--consume${isConsuming ? " is-consuming" : ""}`}>
                            <div className="next-enemy-text">
                                <span>Consume</span>
                            </div>
                            <div className="game-enemy-card-header">
                                <div className="game-enemy-card-name">{nextEnemy?.name ?? "Unknown Enemy"}</div>
                            </div>
                            <div
                                className={[
                                    "consume-stage-wrapper",
                                    isConsuming && !consumeFinalePhase ? "is-consuming" : "",
                                    isDrainShaking && !consumeFinalePhase ? "is-drain-shaking" : "",
                                    consumeFinalePhase === 1 ? "is-consume-finale-1" : "",
                                    consumeFinalePhase === 2 ? "is-consume-finale-2" : "",
                                ].filter(Boolean).join(" ")}
                                style={{ "--consume-glow-color": drainShakeColor } as React.CSSProperties}
                            >
                                {consumeFinalePhase === 2 && consumeFinaleTemplate && (
                                    <div className="consume-finale-icon" aria-hidden="true">
                                        <ElementIcon name={consumeFinaleTemplate.letter} />
                                    </div>
                                )}
                                <EnemyStage
                                    className="game-enemy-stage consume-mode-stage"
                                    frozen
                                    enemyName={nextEnemy?.name ?? "Unknown Enemy"}
                                    spritePath={nextEnemy?.sprite ?? ""}
                                    enemyHealth={nextEnemy?.hp ?? 0}
                                    enemyMaxHp={nextEnemy?.hp ?? 0}
                                    enemyPower={nextEnemy?.power ?? 0}
                                    weaknesses={nextEnemy?.weaknesses ?? []}
                                    elements={nextEnemy?.elements ?? []}
                                    resistances={nextEnemy?.resistances}
                                    souls={nextEnemy?.souls ?? 0}
                                />
                            </div>
                            <div className="game-enemy-card-footer">Absorb this enemy's essence</div>
                        </div>
                    ) : enemyCardMode === "boss" ? (
                        <div className="game-enemy-card game-enemy-card--boss">
                            <div className="next-enemy-text">
                                <span>Boss Battle</span>
                            </div>
                            <div className="game-enemy-card-header">
                                <div className="game-enemy-card-name">{bossEnemy?.name ?? "Unknown Boss"}</div>
                            </div>
                            <EnemyStage
                                className="game-enemy-stage"
                                enemyName={bossEnemy?.name ?? "Unknown Boss"}
                                spritePath={bossEnemy?.sprite ?? ""}
                                enemyHealth={bossEnemy?.hp ?? 0}
                                enemyMaxHp={bossEnemy?.hp ?? 0}
                                enemyPower={bossEnemy?.power ?? 0}
                                weaknesses={bossEnemy?.weaknesses ?? []}
                                elements={bossEnemy?.elements ?? []}
                                resistances={bossEnemy?.resistances}
                                souls={bossEnemy?.souls ?? 0}
                            />
                            <div className="game-enemy-card-footer">Hover for details</div>
                        </div>
                    ) : (
                        <div className="game-enemy-card">
                            <div className="next-enemy-text">
                                <span>Next Enemy</span>
                            </div>
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
                                resistances={nextEnemy?.resistances}
                                souls={nextEnemy?.souls ?? 0}
                            />
                            <div className="game-enemy-card-footer">Hover for details</div>
                        </div>
                    )}
                    {/* ── Stat meters (hidden in boss mode) ───────────────── */}
                    {enemyCardMode !== "boss" ? (
                    <div className="homunculus-meters">
                        {([
                            { id: "hp",  label: "HP",  pct: homunculusMeters.hp  },
                            { id: "def", label: "DEF", pct: homunculusMeters.def },
                            { id: "pwr", label: "PWR", pct: homunculusMeters.pwr },
                            { id: "spd", label: "SPD", pct: homunculusMeters.exp },
                        ] as const).map(({ id, label, pct }) => (
                            <div key={id} className="hmeter">
                                <div className="hmeter-track">
                                    <div
                                        className={`hmeter-fill hmeter-fill--${id}`}
                                        style={{
                                            height: `${
                                                enemyCardMode === "consume" && consumeDrainedMeters.has(id)
                                                    ? 0
                                                    : pct
                                            }%`,
                                        }}
                                    />
                                </div>
                                <span className="hmeter-label">{label}</span>
                            </div>
                        ))}
                    </div>
                    ) : null}
                    </div>{/* end .enemy-card-with-meters */}
                    <div className="game-enemy-actions">
                        {enemyCardMode === "create" ? (
                            <button
                                className="create-button"
                                onClick={handleCreate}
                                disabled={!matchedHomunculusRow || isCreatingHomunculus}
                            >
                                {isCreatingHomunculus ? "CREATING..." : "CREATE"}
                            </button>
                        ) : enemyCardMode === "consume" ? (
                            <button
                                className="consume-button"
                                onClick={handleConsume}
                                disabled={isConsuming || isDrainShaking || !nextEnemy}
                            >
                                CONSUME
                            </button>
                        ) : enemyCardMode === "boss" ? (
                            <div
                                className="fight-btn-wrap"
                                data-tip={!spellSlots.some((id) => id !== null) ? "Please insert at least one element into the spell slots below" : undefined}
                            >
                                <button
                                    className="fight-button"
                                    onClick={handleBossFight}
                                    disabled={!bossEnemy || !spellSlots.some((id) => id !== null)}
                                >
                                    BATTLE!
                                </button>
                            </div>
                        ) : (
                            <div
                                className="fight-btn-wrap"
                                data-tip={!spellSlots.some((id) => id !== null) ? "Please insert at least one element into the spell slots below" : undefined}
                            >
                                <button
                                    className="fight-button"
                                    onClick={handleFight}
                                    disabled={!nextEnemy || !spellSlots.some((id) => id !== null)}
                                >
                                    FIGHT!
                                </button>
                            </div>
                        )}
                        {/* Spell Slots */}
                        <div className="spell-slots-section">
                            <div className="spell-slots-container">
                                {spellSlots.map((elementId, slotIndex) => {
                                    // Ensure refs array is long enough
                                    while (spellSlotRefs.current.length <= slotIndex) {
                                        spellSlotRefs.current.push({ current: null });
                                    }

                                    const hasElement = elementId !== null;
                                    const slottedElement = hasElement
                                        ? player.elements.find((element) => element.id === elementId) ?? null
                                        : null;
                                    const slotTypeKey = normalizeType(slottedElement?.type1)
                                        || normalizeType(slottedElement?.letter);
                                    const slotWireColor = ELEMENT_SPELL_COLORS[slotTypeKey]?.border ?? "#8ea0bb";
                                    const slotWireStyle = {
                                        ["--spell-wire-color" as string]: slotWireColor,
                                    };

                                    return (
                                        <div
                                            key={`spell-slot-${slotIndex}`}
                                            className={`spell-slot-node ${slotIndex === 0 ? "spell-slot-node--first" : ""} ${hasElement ? "has-element" : ""}`.trim()}
                                            style={slotWireStyle}
                                        >
                                            <span className={`spell-slot-wire ${hasElement ? "is-lit" : ""}`.trim()} aria-hidden="true" />
                                            <div
                                                className={`spell-slot${hasElement ? " has-element" : ""}`}
                                                ref={spellSlotRefs.current[slotIndex]}
                                            >
                                                {!hasElement && (
                                                    <img className="spell-slot-empty-text" src={slotIcon} alt="" aria-hidden="true" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="spell-slots-header">
                                <span className="spell-slots-label">SPELL SLOTS</span>
                                <div className="spell-slots-info">Add elements and spells here to use them in battle!</div>
                                {/* <button
                                    className="spell-slots-add-button"
                                    onClick={addSpellSlot}
                                    title="Add a new spell slot"
                                    aria-label="Add a new spell slot"
                                >
                                    +
                                </button> */}
                            </div>
                        </div>
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
            {ENABLE_LEVEL_UP_MODAL && pendingLevelUps.length > 0 ? (
                <LevelUpModal
                    elementLetter={pendingLevelUps[0].elementLetter}
                    elementType1={pendingLevelUps[0].elementType1}
                    elementType2={pendingLevelUps[0].elementType2}
                    elementPreview={pendingLevelUps[0].elementPreview}
                    choices={pendingLevelUps[0].choices}
                    onConfirm={() => { /* level-up modal disabled */ }}
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
            <BossCountdown
                battlesCompleted={battlesCompleted}
                animateVersion={warriorAnimateVersion}
                spritePath={enemies[bossIndex]?.sprite ?? ""}
                transitionToSprite={enemies[bossIndex + 1]?.sprite ?? ""}
                transitionVersion={bossTransitionVersion}
                onTransitionComplete={handleBossTransitionComplete}
            />
        </div>
    );
}

export default Game;
