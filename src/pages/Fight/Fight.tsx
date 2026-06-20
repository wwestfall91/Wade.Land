import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import {
    getPerHitSpellEffects,
    getSpellHitCount,
    EFFECTS,
    type ActiveBurnStatus,
    type ActiveEnergizeStatus,
    type ActiveFreezeStatus,
    type ActiveFloatStatus,
    type ActiveSoakStatus,
    type ActiveThornsStatus,
    type SpellEffectConfig,
} from "../../combat/spellEffects";
import { effectFactory } from "../../combat/effectFactory";
import { effectTypeFactory } from "../../combat/effectTypeFactory";
import {
    ENERGY_PER_TURN,
    FREEZE_FIRE_BONUS_PER_STACK,
    MAX_TURN_ENERGY,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
    THORNS_REFLECT_PERCENT_PER_STACK,
    getBurnFireBonus,
    getBurnFireBonusPercent,
    getFreezeFireBonus,
    getFloatEarthReduction,
    getFloatLightningBonus,
    getSoakFirePenalty,
    getSoakLightningBonus,
    getThornsReflect,
} from "../../combat/statusMath";
import EnemyStage, { type EnemyDamagePopup } from "../../components/EnemyStage";
import ElementDetailsTooltip from "../../components/ElementDetailsTooltip";
import { usePlayer, type RewardElement } from "../../context/PlayerContext";
import FloatingTooltip from "../Game/FloatingTooltip";
import { ELEMENT_SPELL_COLORS, type ElementSpellColor } from "../../styles/elementThemes";
import ElementIcon from "../../components/ElementIcon";
import shieldIcon from "../../assets/icons/Shield.png";
import soulIcon from "../../assets/icons/Soul.png";
import energizeIcon from "../../assets/icons/Energize.png";

type EventLogEntry = {
    id: number;
    text: string;
    kind: "enemy" | "player" | "status";
    isDetail?: boolean;
};

// TURN_ENERGY constant removed — use MAX_TURN_ENERGY and ENERGY_PER_TURN from statusMath
const COMBAT_ANIMATION_SPEED_MULTIPLIER = 1.6;
const scaleCombatAnimationMs = (ms: number) => Math.max(16, Math.round(ms / COMBAT_ANIMATION_SPEED_MULTIPLIER));
const HIT_FLASH_MS = scaleCombatAnimationMs(190);
const HIT_STEP_DELAY_MS = scaleCombatAnimationMs(120);
const EFFECT_STEP_DELAY_MS = scaleCombatAnimationMs(95);
const EVENT_LOG_MAX_ENTRIES = 60;

type EnergyFlight = {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    delay: number;
    duration: number;
};

type PlayerDamagePopup = {
    id: number;
    text: string;
    kind?: "default" | "burn";
};

const wait = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, scaleCombatAnimationMs(ms));
});

const SPELL_TYPE_COLORS = ELEMENT_SPELL_COLORS;

type FightEnemy = {
    name: string;
    hp: number;
    power: number;
    souls: number;
    weaknesses?: string[];
    sprite?: string;
    elements: RewardElement[];
};

type FightLocationState = {
    enemy?: FightEnemy;
    elementPool?: RewardElement[];
};

type FightRewardState = {
    soulsGained: number;
    rewardElements: RewardElement[];
};

type GameLocationState = {
    fightReward?: FightRewardState;
    battleEnded?: boolean;
};

type CastableSpell = {
    id: number;
    letter: string;
    damage: number;
    energy?: number;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
    category?: string;
};

type ComboStatus = {
    requiredType: string;
    /** Energy discount applied when a matching-type spell is cast */
    discountAmount: number;
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const {
        player,
        playerName,
        levels,
        applyEnemyAttack,
        healPlayer,
        decreaseMaxHp,
        resetGame,
        typeMultipliers,
        playerStatuses: playerStatusesFromContext,
        setPlayerStatuses: setPlayerStatusesFromContext,
        shieldMultiplier,
        soakMultiplier,
        burnMultiplier,
        maxHpMultiplier,
        permanentMaxHpReduction,
        setBattleEnergyCarryover: setBattleEnergyCarryoverFromContext,
    } = usePlayer();
    const playerStatuses = playerStatusesFromContext ?? {
        burn: null,
        soak: null,
        freeze: null,
        thorns: null,
        float: null,
        shield: 0,
        energize: null,
    };
    const setPlayerStatuses = useMemo(() => setPlayerStatusesFromContext ?? (() => undefined), [setPlayerStatusesFromContext]);
    const setBattleEnergyCarryover = useMemo(
        () => setBattleEnergyCarryoverFromContext ?? (() => undefined),
        [setBattleEnergyCarryoverFromContext],
    );
    const effectiveTypeMultipliers = typeMultipliers ?? {};
    const effectiveShieldMultiplier = shieldMultiplier ?? 1;
    const effectiveSoakMultiplier = soakMultiplier ?? 1;
    const effectiveBurnMultiplier = burnMultiplier ?? 1;
    const effectiveMaxHpMultiplier = maxHpMultiplier ?? 1;
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [hoveredSpellId, setHoveredSpellId] = useState<number | null>(null);
    const [hoveredSpellTooltipId, setHoveredSpellTooltipId] = useState<number | null>(null);
    const [spellTooltipGraceId, setSpellTooltipGraceId] = useState<number | null>(null);
    const [hoveredEnemyAttack, setHoveredEnemyAttack] = useState(false);
    const [isEnemyIntentTooltipHovered, setIsEnemyIntentTooltipHovered] = useState(false);
    const [isEnemyIntentTooltipGraceOpen, setIsEnemyIntentTooltipGraceOpen] = useState(false);
    const [remainingEnergy, setRemainingEnergy] = useState(() => ENERGY_PER_TURN);
    const [eventLogEntries, setEventLogEntries] = useState<EventLogEntry[]>([]);
    const [isBattleLogExpanded, setIsBattleLogExpanded] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPlayerHit, setIsPlayerHit] = useState(false);
    const [isScreenFlashing, setIsScreenFlashing] = useState(false);
    const [isSpellCastFlashing, setIsSpellCastFlashing] = useState(false);

    type Projectile = {
        id: number;
        letter: string;
        x: number;
        y: number;
        dx: number;
        dy: number;
        delay: number;
    };
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [spellCastFlashBackground, setSpellCastFlashBackground] = useState<string>("rgba(255, 255, 255, 0.16)");
    const [isCritFlashing, setIsCritFlashing] = useState(false);
    const [isCritTextVisible, setIsCritTextVisible] = useState(false);
    const [enemyBurnStatus, setEnemyBurnStatus] = useState<ActiveBurnStatus | null>(null);
    const [enemySoakStatus, setEnemySoakStatus] = useState<ActiveSoakStatus | null>(null);
    const [enemyFreezeStatus, setEnemyFreezeStatus] = useState<ActiveFreezeStatus | null>(null);
    const [enemyThornsStatus, setEnemyThornsStatus] = useState<ActiveThornsStatus | null>(null);
    const [enemyFloatStatus, setEnemyFloatStatus] = useState<ActiveFloatStatus | null>(null);
    const [playerBurnStatus, setPlayerBurnStatus] = useState<ActiveBurnStatus | null>(playerStatuses.burn);
    const [playerSoakStatus, setPlayerSoakStatus] = useState<ActiveSoakStatus | null>(playerStatuses.soak);
    const [playerFreezeStatus, setPlayerFreezeStatus] = useState<ActiveFreezeStatus | null>(playerStatuses.freeze);
    const [playerThornsStatus, setPlayerThornsStatus] = useState<ActiveThornsStatus | null>(playerStatuses.thorns);
    const [playerFloatStatus, setPlayerFloatStatus] = useState<ActiveFloatStatus | null>(playerStatuses.float);
    const [playerShield, setPlayerShield] = useState(playerStatuses.shield);
    const [playerComboStatus, setPlayerComboStatus] = useState<ComboStatus | null>(null);
    const [followUpStatus, setFollowUpStatus] = useState<{ letter: string; bonusPercent: number; count: number } | null>(null);
    const [playerPowerComboStatus, setPlayerPowerComboStatus] = useState<{ requiredType: string; bonusPercent: number } | null>(null);
    const [spellExponentialDamage, setSpellExponentialDamage] = useState<Record<string, number>>({});
    const [enemyShield, setEnemyShield] = useState(0);
    const [isResolvingTurn, setIsResolvingTurn] = useState(false);
    const [isEnemyTurnActive, setIsEnemyTurnActive] = useState(false);
    const [usedWeaponThisTurn, setUsedWeaponThisTurn] = useState(false);
    const [queuedEnemyAttack, setQueuedEnemyAttack] = useState<RewardElement | null>(null);
    const [isReadyingNextAttack, setIsReadyingNextAttack] = useState(false);
    const [isEnemySpriteFlashing, setIsEnemySpriteFlashing] = useState(false);
    const [isEnemySteamVisible, setIsEnemySteamVisible] = useState(false);
    const [enemySpriteFlashColor, setEnemySpriteFlashColor] = useState("rgba(255, 255, 255, 0.6)");
    const [enemyDamagePopups, setEnemyDamagePopups] = useState<EnemyDamagePopup[]>([]);
    const [isPlayerHealingFlash, setIsPlayerHealingFlash] = useState(false);
    const [isPlayerShieldFlash, setIsPlayerShieldFlash] = useState(false);
    const [isPlayerBurnHitFlash, setIsPlayerBurnHitFlash] = useState(false);
    const [isShieldExpiring, setIsShieldExpiring] = useState(false);
    const [playerDamagePopups, setPlayerDamagePopups] = useState<PlayerDamagePopup[]>([]);
    const [playerEnergizeStatus, setPlayerEnergizeStatus] = useState<ActiveEnergizeStatus | null>(playerStatuses.energize);
    const [energizeFlights, setEnergizeFlights] = useState<EnergyFlight[]>([]);
    const [leafFlights, setLeafFlights] = useState<EnergyFlight[]>([]);
    const hasResolvedVictory = useRef(false);
    const previousPlayerHpRef = useRef(player.hp);
    const previousPlayerShieldRef = useRef(playerShield);
    const playerShieldRef = useRef(playerShield);
    const enemyDamagePopupIdRef = useRef(1);
    const playerDamagePopupIdRef = useRef(1);
    const eventLogIdRef = useRef(1);
    const eventLogContainerRef = useRef<HTMLDivElement | null>(null);
    const spellSlotRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const enemyAttackMarkerRef = useRef<HTMLDivElement | null>(null);
    const enemyIntentIconRef = useRef<HTMLDivElement | null>(null);
    const enemySpriteRef = useRef<HTMLDivElement | null>(null);
    const playerHpBarRef = useRef<HTMLDivElement | null>(null);
    const playerStatusStripRef = useRef<HTMLDivElement | null>(null);
    const projectileIdRef = useRef(1);
    const pipRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const energizeDisplayRef = useRef<HTMLSpanElement | null>(null);
    const energizeFlyIdRef = useRef(1);
    const leafFlyIdRef = useRef(1);
    const remainingEnergyRef = useRef(ENERGY_PER_TURN);
    const healFlashTimeoutRef = useRef<number | null>(null);
    const shieldFlashTimeoutRef = useRef<number | null>(null);
    const playerHitTimeoutRef = useRef<number | null>(null);
    const screenFlashTimeoutRef = useRef<number | null>(null);
    const spellCastFlashTimeoutRef = useRef<number | null>(null);
    const playerBurnHitFlashTimeoutRef = useRef<number | null>(null);
    const enemySteamTimeoutRef = useRef<number | null>(null);
    const enemyIntentReadyingTimeoutRef = useRef<number | null>(null);
    const spellTooltipGraceTimeoutRef = useRef<number | null>(null);
    const enemyIntentTooltipGraceTimeoutRef = useRef<number | null>(null);

    const clearSpellTooltipGraceTimeout = () => {
        if (spellTooltipGraceTimeoutRef.current !== null) {
            window.clearTimeout(spellTooltipGraceTimeoutRef.current);
            spellTooltipGraceTimeoutRef.current = null;
        }
    };

    const clearEnemyIntentTooltipGraceTimeout = () => {
        if (enemyIntentTooltipGraceTimeoutRef.current !== null) {
            window.clearTimeout(enemyIntentTooltipGraceTimeoutRef.current);
            enemyIntentTooltipGraceTimeoutRef.current = null;
        }
    };

    const startSpellTooltipGraceClose = (spellId: number) => {
        setSpellTooltipGraceId(spellId);
        clearSpellTooltipGraceTimeout();
        spellTooltipGraceTimeoutRef.current = window.setTimeout(() => {
            setSpellTooltipGraceId((current) => (current === spellId ? null : current));
            spellTooltipGraceTimeoutRef.current = null;
        }, 250);
    };

    const startEnemyIntentTooltipGraceClose = () => {
        setIsEnemyIntentTooltipGraceOpen(true);
        clearEnemyIntentTooltipGraceTimeout();
        enemyIntentTooltipGraceTimeoutRef.current = window.setTimeout(() => {
            setIsEnemyIntentTooltipGraceOpen(false);
            enemyIntentTooltipGraceTimeoutRef.current = null;
        }, 250);
    };

    const handleSpellCardMouseEnter = (spellId: number) => {
        clearSpellTooltipGraceTimeout();
        setSpellTooltipGraceId((current) => (current === spellId ? null : current));
        setHoveredSpellId(spellId);
    };

    const handleSpellCardMouseLeave = (spellId: number) => {
        setHoveredSpellId((current) => (current === spellId ? null : current));
        startSpellTooltipGraceClose(spellId);
    };

    const handleSpellTooltipMouseEnter = (spellId: number) => {
        clearSpellTooltipGraceTimeout();
        setSpellTooltipGraceId((current) => (current === spellId ? null : current));
        setHoveredSpellTooltipId(spellId);
    };

    const handleSpellTooltipMouseLeave = (spellId: number) => {
        setHoveredSpellTooltipId((current) => (current === spellId ? null : current));
        startSpellTooltipGraceClose(spellId);
    };

    const handleEnemyIntentMouseEnter = () => {
        if (!queuedEnemyAttack) {
            return;
        }

        clearEnemyIntentTooltipGraceTimeout();
        setIsEnemyIntentTooltipGraceOpen(false);
        setHoveredEnemyAttack(true);
    };

    const handleEnemyIntentMouseLeave = () => {
        setHoveredEnemyAttack(false);
        startEnemyIntentTooltipGraceClose();
    };

    const handleEnemyIntentTooltipMouseEnter = () => {
        clearEnemyIntentTooltipGraceTimeout();
        setIsEnemyIntentTooltipGraceOpen(false);
        setIsEnemyIntentTooltipHovered(true);
    };

    const handleEnemyIntentTooltipMouseLeave = () => {
        setIsEnemyIntentTooltipHovered(false);
        startEnemyIntentTooltipGraceClose();
    };

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, power: 0, souls: 0, weaknesses: [], sprite: "", elements: [] };
    }, [location.state]);

    const elementPool = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.elementPool ?? [];
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);
    const enemyMaxHp = Math.max(1, enemy.hp);
    const enemyHpFillPercent = Math.max(0, Math.min(100, (enemyHealth / enemyMaxHp) * 100));
    const playerMaxHp = Math.max(1, Math.round((levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1)) * effectiveMaxHpMultiplier) - (permanentMaxHpReduction ?? 0));
    const displayedPlayerHp = player.hp + Math.max(0, playerShield);
    const playerHpFillPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));
    const playerShieldFillPercent = Math.max(0, Math.min(100, (Math.max(0, playerShield) / playerMaxHp) * 100));
    const playerTotalFillPercent = Math.min(100, playerHpFillPercent + playerShieldFillPercent);
    const playerShieldTailFillPercent = Math.min(playerShieldFillPercent, playerTotalFillPercent);
    const playerHealthFillPercent = Math.max(0, playerTotalFillPercent - playerShieldTailFillPercent);

    const normalizeType = (value?: string) => value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
    const formatTypeLabel = (value: string) => value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const pickEnemyAttack = () => {
        const attack = enemy.elements[Math.floor(Math.random() * enemy.elements.length)] ?? null;
        return attack
            ? {
                ...attack,
                damage: enemy.power,
            }
            : null;
    };
    const enemyWeaknesses = (enemy.weaknesses ?? []).map((weakness) => weakness.trim()).filter((weakness) => weakness.length > 0);
    const getSpellTypeList = (spell: { type1?: string; type2?: string }) =>
        [spell.type1, spell.type2].map(normalizeType).filter(Boolean);
    const getSpellEnergyComboEffect = (effects?: SpellEffectConfig[]) =>
        effects?.find((effect) => effect.kind === EFFECTS.COMBO || effect.kind === EFFECTS.ENERGY_COMBO) ?? null;
    const getSpellComboType = (effects?: SpellEffectConfig[]) =>
        getSpellEnergyComboEffect(effects)?.targetType ?? null;
    const hasCombustEffect = (effects?: SpellEffectConfig[]) =>
        Boolean(effects?.some((effect) => effect.kind === EFFECTS.EXPLODE));

    const castableSpells = useMemo(
        () => player.elements.filter((element) => {
            const category = normalizeType(element.category);
            const letter = normalizeType(element.letter);
            return category !== "soul" && letter !== "soul";
        }),
        [player.elements],
    );

    /** Passive float percent from player's owned elements (affects incoming damage). */
    const playerPassiveFloatPercent = useMemo(
        () => player.elements.reduce((total, el) => {
            const f = el.effects?.find(e => e.kind === "float");
            return f ? total + (f.amount ?? 0) : total;
        }, 0),
        [player.elements],
    );

    /** Passive float percent from enemy's elements (affects spell damage against enemy). */
    const enemyPassiveFloatPercent = useMemo(
        () => enemy.elements.reduce((total, el) => {
            const f = el.effects?.find(e => e.kind === "float");
            return f ? total + (f.amount ?? 0) : total;
        }, 0),
        [enemy.elements],
    );

    const getSpellSlotStyle = (type1?: string, type2?: string) => {
        const normalized = [type1, type2].map(normalizeType).filter(Boolean);
        if (normalized.length === 0) {
            return undefined;
        }

        const first = SPELL_TYPE_COLORS[normalized[0]];
        const second = normalized[1] ? SPELL_TYPE_COLORS[normalized[1]] : undefined;

        const fallback: ElementSpellColor = { bg: "#e9e9e9", border: "#a9a9a9", text: "#202020" };
        const primary = first ?? fallback;
        const secondary = second ?? primary;
        const background = normalized.length >= 2
            ? `linear-gradient(120deg, ${primary.bg} 0%, ${secondary.bg} 100%)`
            : primary.bg;

        return {
            ["--spell-slot-bg" as string]: background,
            ["--spell-slot-border" as string]: primary.border,
            ["--spell-slot-text" as string]: primary.text,
        } as React.CSSProperties;
    };

    const hexToRgba = (hexColor: string, alpha: number) => {
        const hex = hexColor.replace("#", "");
        if (hex.length !== 6) {
            return `rgba(255, 255, 255, ${alpha})`;
        }

        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    };

    const getSpellCastFlashBackground = (type1?: string, type2?: string) => {
        const normalized = [type1, type2].map(normalizeType).filter(Boolean);
        if (normalized.length === 0) {
            return "rgba(255, 255, 255, 0.16)";
        }

        const primary = SPELL_TYPE_COLORS[normalized[0]]?.bg ?? "#ffffff";
        const secondary = SPELL_TYPE_COLORS[normalized[1]]?.bg ?? primary;

        if (normalized.length >= 2) {
            return `linear-gradient(120deg, ${hexToRgba(primary, 0.16)} 0%, ${hexToRgba(secondary, 0.16)} 100%)`;
        }

        return hexToRgba(primary, 0.18);
    };

    const getSpellHitFlashColor = (type1?: string, type2?: string) => {
        const normalized = [type1, type2].map(normalizeType).filter(Boolean);
        const primary = normalized[0] ? SPELL_TYPE_COLORS[normalized[0]] : undefined;
        return primary?.bg ?? "#f0f0f0";
    };

    const getAbilityLogName = (spell: CastableSpell) => {
        const types = [spell.type1, spell.type2].map(normalizeType).filter(Boolean);
        const prettyTypes = types.map((type) => `${type.charAt(0).toUpperCase()}${type.slice(1)}`);
        const typeLabel = prettyTypes.length > 0 ? ` (${prettyTypes.join("/")})` : "";
        return `${spell.letter}${typeLabel}`;
    };

    const triggerEnemyHitFeedback = (
        damage: number,
        flashColor: string,
        popupText?: string,
        popupKind: EnemyDamagePopup["kind"] = "default",
    ) => {
        const popupId = enemyDamagePopupIdRef.current++;
        setEnemySpriteFlashColor(flashColor);
        setIsEnemySpriteFlashing(false);
        window.requestAnimationFrame(() => {
            setIsEnemySpriteFlashing(true);
            window.setTimeout(() => setIsEnemySpriteFlashing(false), HIT_FLASH_MS);
        });

        setEnemyDamagePopups((previous) => [
            ...previous,
            {
                id: popupId,
                text: popupText ?? `-${damage}`,
                color: flashColor,
                kind: popupKind,
            },
        ]);

        window.setTimeout(() => {
            setEnemyDamagePopups((previous) => previous.filter((popup) => popup.id !== popupId));
        }, scaleCombatAnimationMs(480));
    };

    const triggerPlayerDamagePopup = (
        damage: number,
        popupText?: string,
        popupKind: PlayerDamagePopup["kind"] = "default",
    ) => {
        if (damage <= 0) {
            return;
        }

        const popupId = playerDamagePopupIdRef.current++;
        setPlayerDamagePopups((previous) => [
            ...previous,
            {
                id: popupId,
                text: popupText ?? `-${damage}`,
                kind: popupKind,
            },
        ]);

        window.setTimeout(() => {
            setPlayerDamagePopups((previous) => previous.filter((popup) => popup.id !== popupId));
        }, scaleCombatAnimationMs(500));
    };

    const getSpellEnergyCost = (
        spell: { energy?: number; type1?: string; type2?: string },
        comboType: string | null = playerComboStatus?.requiredType ?? null,
        discountAmount: number = playerComboStatus?.discountAmount ?? 1,
    ) => {
        const baseCost = Math.max(0, spell.energy ?? 0);
        if (!comboType) {
            return baseCost;
        }

        const spellTypes = getSpellTypeList(spell);
        return spellTypes.includes(comboType) ? Math.max(0, baseCost - discountAmount) : baseCost;
    };

    const inferEventKind = (message: string): EventLogEntry["kind"] => {
        if (message.startsWith("Enemy attacks")) {
            return "enemy";
        }
        if (message.startsWith("Heals") || message.startsWith("Shield ") || message.startsWith("Hits") || message.startsWith("Critical hit") || message.startsWith("Super Effective")) {
            return "player";
        }

        return "status";
    };

    const pushEventLog = (
        message: string,
        kind: EventLogEntry["kind"] = inferEventKind(message),
        options?: { isDetail?: boolean },
    ) => {
        const trimmed = message.trim();
        if (trimmed.length === 0) {
            return;
        }

        setEventLogEntries((previous) => {
            const next = [...previous, {
                id: eventLogIdRef.current++,
                text: trimmed,
                kind,
                isDetail: options?.isDetail ?? false,
            }];
            if (next.length <= EVENT_LOG_MAX_ENTRIES) {
                return next;
            }

            return next.slice(next.length - EVENT_LOG_MAX_ENTRIES);
        });
    };

    useEffect(() => {
        const container = eventLogContainerRef.current;
        if (!container) {
            return;
        }

        container.scrollTop = container.scrollHeight;
    }, [eventLogEntries]);

    useEffect(() => {
        return () => {
            if (healFlashTimeoutRef.current !== null) {
                window.clearTimeout(healFlashTimeoutRef.current);
            }
            if (shieldFlashTimeoutRef.current !== null) {
                window.clearTimeout(shieldFlashTimeoutRef.current);
            }
            if (playerHitTimeoutRef.current !== null) {
                window.clearTimeout(playerHitTimeoutRef.current);
            }
            if (screenFlashTimeoutRef.current !== null) {
                window.clearTimeout(screenFlashTimeoutRef.current);
            }
            if (spellCastFlashTimeoutRef.current !== null) {
                window.clearTimeout(spellCastFlashTimeoutRef.current);
            }
            if (playerBurnHitFlashTimeoutRef.current !== null) {
                window.clearTimeout(playerBurnHitFlashTimeoutRef.current);
            }
            if (enemySteamTimeoutRef.current !== null) {
                window.clearTimeout(enemySteamTimeoutRef.current);
            }
            if (enemyIntentReadyingTimeoutRef.current !== null) {
                window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
            }
            clearSpellTooltipGraceTimeout();
            clearEnemyIntentTooltipGraceTimeout();
        };
    }, []);

    const triggerEnemySteamEffect = () => {
        setIsEnemySteamVisible(false);
        window.requestAnimationFrame(() => {
            setIsEnemySteamVisible(true);
            if (enemySteamTimeoutRef.current !== null) {
                window.clearTimeout(enemySteamTimeoutRef.current);
            }

            enemySteamTimeoutRef.current = window.setTimeout(() => {
                setIsEnemySteamVisible(false);
            }, scaleCombatAnimationMs(520));
        });
    };

    useEffect(() => {
        if (player.hp > previousPlayerHpRef.current) {
            setIsPlayerHealingFlash(true);
            if (healFlashTimeoutRef.current !== null) {
                window.clearTimeout(healFlashTimeoutRef.current);
            }

            healFlashTimeoutRef.current = window.setTimeout(() => {
                setIsPlayerHealingFlash(false);
            }, scaleCombatAnimationMs(420));
        }

        previousPlayerHpRef.current = player.hp;
    }, [player.hp]);

    useEffect(() => {
        playerShieldRef.current = playerShield;
        if (playerShield > previousPlayerShieldRef.current) {
            setIsPlayerShieldFlash(true);
            if (shieldFlashTimeoutRef.current !== null) {
                window.clearTimeout(shieldFlashTimeoutRef.current);
            }

            shieldFlashTimeoutRef.current = window.setTimeout(() => {
                setIsPlayerShieldFlash(false);
            }, scaleCombatAnimationMs(360));
        }

        previousPlayerShieldRef.current = playerShield;
    }, [playerShield]);

    useEffect(() => {
        if (enemyHealth <= 0 && !hasResolvedVictory.current) {
            hasResolvedVictory.current = true;
            setBattleEnergyCarryover(0);
            const shuffled = [...elementPool].sort(() => Math.random() - 0.5);
            const chosen = shuffled.slice(0, Math.min(3, shuffled.length));
            setPlayerStatuses({
                burn: playerBurnStatus,
                soak: playerSoakStatus,
                freeze: playerFreezeStatus,
                energize: playerEnergizeStatus,
                thorns: playerThornsStatus,
                float: playerFloatStatus,
                shield: 0,
            });
            navigate("/game", {
                replace: true,
                state: {
                    battleEnded: true,
                    fightReward: {
                        soulsGained: enemy.souls,
                        rewardElements: chosen,
                    },
                } as GameLocationState,
            });
        }
    }, [elementPool, enemy.souls, enemyHealth, navigate, playerBurnStatus, playerSoakStatus, playerFreezeStatus, playerEnergizeStatus, setBattleEnergyCarryover, setPlayerStatuses]);

    useEffect(() => {
        if (levels.length === 0 || enemyHealth <= 0 || player.hp > 0) {
            return;
        }

        setIsGameOver(true);
    }, [enemyHealth, levels.length, player.hp]);

    useEffect(() => {
        if (enemy.elements.length === 0) {
            setQueuedEnemyAttack(null);
            setHoveredEnemyAttack(false);
            setIsEnemyIntentTooltipHovered(false);
            setIsEnemyIntentTooltipGraceOpen(false);
            setIsReadyingNextAttack(false);
            if (enemyIntentReadyingTimeoutRef.current !== null) {
                window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
            }
            clearEnemyIntentTooltipGraceTimeout();
            return;
        }

        const initialAttack = pickEnemyAttack();
        setQueuedEnemyAttack(initialAttack);
        setHoveredEnemyAttack(false);
        setIsEnemyIntentTooltipHovered(false);
        setIsEnemyIntentTooltipGraceOpen(false);
        setIsReadyingNextAttack(false);
        clearEnemyIntentTooltipGraceTimeout();

        if (enemyIntentReadyingTimeoutRef.current !== null) {
            window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
        }

        if (initialAttack) {
            window.requestAnimationFrame(() => {
                setIsReadyingNextAttack(true);
                enemyIntentReadyingTimeoutRef.current = window.setTimeout(() => {
                    setIsReadyingNextAttack(false);
                }, scaleCombatAnimationMs(560));
            });
        }
        // Re-seed intent whenever a new enemy enters the fight.
    }, [enemy.elements, enemy.name]);

    const triggerEnemyAttack = async () => {
        if (enemyHealth <= 0 || isGameOver) {
            return;
        }

        const attack = queuedEnemyAttack ?? pickEnemyAttack();
        setHoveredEnemyAttack(false);
        setIsEnemyIntentTooltipHovered(false);
        setIsEnemyIntentTooltipGraceOpen(false);
        clearEnemyIntentTooltipGraceTimeout();
        if (!attack) {
            setQueuedEnemyAttack(null);
            return;
        }

        pushEventLog(`Enemy prepares ${attack.letter}`, "enemy", { isDetail: true });
        await wait(260);

        let simulatedPlayerHp = player.hp;
        let currentPlayerShield = playerShield;
        let currentPlayerBurn = playerBurnStatus;
        let currentPlayerSoak = playerSoakStatus;
        let currentPlayerFreeze = playerFreezeStatus;
        const currentPlayerThorns = playerThornsStatus;

        const attackTypes = [attack.type1, attack.type2].map(normalizeType).filter(Boolean);
        const isWaterAttack = attackTypes.includes("water");
        const isLightningAttack = attackTypes.includes("lightning");
        const isFireAttack = attackTypes.includes("fire");
        const isEarthAttack = attackTypes.includes("earth");
        const hitCount = getSpellHitCount(attack.effects);
        const perHitEffects = effectTypeFactory.getBattleTriggerEffects(getPerHitSpellEffects(attack.effects));
        const attackDamageBreakdown: number[] = [];
        let totalDamageTaken = 0;
        let totalPlayerBurnApplied = 0;
        let playerBurnDuration = 0;
        let totalPlayerShieldGranted = 0;
        let totalPlayerSoakApplied = 0;
        let playerSoakWasConsumed = false;
        let playerFreezeWasConsumed = false;
        let currentPlayerSoakStacks = currentPlayerSoak?.stacks ?? 0;
        let currentPlayerFreezeStacks = currentPlayerFreeze?.stacks ?? 0;
        let totalEnemyHealing = 0;
        let totalThornsReflected = 0;
        let totalPlayerFreezeSoakConvertPercent = 0;
        let convertedPlayerFreezeStacksFromEffect = 0;
        let totalPlayerSoakDuration = 0;
        let totalPlayerFreezeSoakConvertDuration = 0;
        let totalPlayerThornsApplied = 0;
        let totalPlayerThornsDuration = 0;
        let nextEnemyHealthForThorns = enemyHealth;
        const enemyAttackSource = enemyIntentIconRef.current ?? enemyAttackMarkerRef.current;
        const playerBurnStacks = currentPlayerBurn?.stacks ?? 0;

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            if (simulatedPlayerHp <= 0) {
                break;
            }

            const soakBonus = isLightningAttack ? getSoakLightningBonus(currentPlayerSoakStacks) : 0;
            const soakPenalty = isFireAttack ? getSoakFirePenalty(currentPlayerSoakStacks) : 0;
            const freezeBonus = isFireAttack ? getFreezeFireBonus(currentPlayerFreezeStacks) : 0;
            // Float is passive — use player's element-based float percent
            const floatEarthReduction = isEarthAttack ? getFloatEarthReduction(playerPassiveFloatPercent, attack.damage) : 0;
            const floatLightningBonus = isLightningAttack ? getFloatLightningBonus(playerPassiveFloatPercent, attack.damage) : 0;
            const baseHitDamage = Math.max(0, attack.damage + soakBonus - soakPenalty + freezeBonus - floatEarthReduction + floatLightningBonus);
            const burnBonus = isFireAttack ? getBurnFireBonus(playerBurnStacks, baseHitDamage) : 0;
            const bonusAdjustedDamage = baseHitDamage + burnBonus;
            const absorbedDamage = Math.min(currentPlayerShield, bonusAdjustedDamage);
            const remainingDamage = Math.max(0, bonusAdjustedDamage - absorbedDamage);

            if (absorbedDamage > 0) {
                currentPlayerShield = Math.max(0, currentPlayerShield - absorbedDamage);
                setPlayerShield(currentPlayerShield);
                pushEventLog(`Shield blocks ${absorbedDamage}`, "player");
                await wait(EFFECT_STEP_DELAY_MS);
            }

            attackDamageBreakdown.push(remainingDamage);
            if (remainingDamage > 0) {
                launchProjectileBurst(attack.letter, enemyAttackSource, playerHpBarRef.current, 1, 180);
                await wait(220);
                totalDamageTaken += remainingDamage;
                simulatedPlayerHp = Math.max(0, simulatedPlayerHp - remainingDamage);
                applyEnemyAttack(remainingDamage);
                triggerPlayerDamagePopup(remainingDamage);

                // Thorns: reflect a portion of damage back to the enemy
                const thornsStacks = currentPlayerThorns?.stacks ?? 0;
                if (thornsStacks > 0) {
                    const thornsReflect = getThornsReflect(thornsStacks, remainingDamage);
                    if (thornsReflect > 0) {
                        totalThornsReflected += thornsReflect;
                        nextEnemyHealthForThorns = Math.max(0, nextEnemyHealthForThorns - thornsReflect);
                        setEnemyHealth(nextEnemyHealthForThorns);
                        triggerEnemyHitFeedback(thornsReflect, "#44ff88", `-${thornsReflect} THORNS`);
                        await wait(EFFECT_STEP_DELAY_MS);
                    }
                }
            }

            if (isWaterAttack && currentPlayerBurn) {
                currentPlayerBurn = null;
                setPlayerBurnStatus(null);
                triggerEnemySteamEffect();
                pushEventLog("Water extinguishes burn", "status");
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if ((isFireAttack || isLightningAttack) && !playerSoakWasConsumed && currentPlayerSoakStacks > 0) {
                playerSoakWasConsumed = true;
                currentPlayerSoakStacks = 0;
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if (isFireAttack && !playerFreezeWasConsumed && currentPlayerFreezeStacks > 0) {
                playerFreezeWasConsumed = true;
                currentPlayerFreezeStacks = 0;
                await wait(EFFECT_STEP_DELAY_MS);
            }

            await wait(HIT_STEP_DELAY_MS);

            perHitEffects.forEach((effect) => {
                const delta = effectFactory.resolveEnemyAttackEffect(effect, remainingDamage);
                totalPlayerBurnApplied += delta.playerBurnApplied;
                playerBurnDuration = Math.max(playerBurnDuration, delta.playerBurnDuration);
                totalPlayerShieldGranted += delta.playerShieldGranted;
                totalEnemyHealing += delta.enemyHealing;
                totalPlayerSoakApplied += delta.playerSoakApplied;
                totalPlayerSoakDuration = Math.max(totalPlayerSoakDuration, delta.playerSoakDuration);
                totalPlayerFreezeSoakConvertPercent += delta.playerFreezeSoakConvertPercent;
                totalPlayerFreezeSoakConvertDuration = Math.max(totalPlayerFreezeSoakConvertDuration, delta.playerFreezeSoakConvertDuration);
                totalPlayerThornsApplied += delta.playerThornsApplied;
                totalPlayerThornsDuration = Math.max(totalPlayerThornsDuration, delta.playerThornsDuration);
            });

            if (simulatedPlayerHp <= 0) {
                break;
            }
        }

        const stackProjectileCount =
            Math.max(0, totalPlayerBurnApplied) +
            Math.max(0, totalPlayerSoakApplied) +
            Math.max(0, convertedPlayerFreezeStacksFromEffect);
        if (stackProjectileCount > 0 && simulatedPlayerHp > 0) {
            launchProjectileBurst(attack.letter, enemyAttackSource, playerStatusStripRef.current, stackProjectileCount, 110);
            await wait(240);
        }

        if (playerSoakWasConsumed) {
            setPlayerSoakStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (playerFreezeWasConsumed) {
            setPlayerFreezeStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        totalPlayerBurnApplied = Math.round(totalPlayerBurnApplied * effectiveBurnMultiplier);
        totalPlayerSoakApplied = Math.round(totalPlayerSoakApplied * effectiveSoakMultiplier);

        if (totalPlayerBurnApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerBurnStatus((previous) => {
                if (!previous) {
                    return {
                        kind: EFFECTS.BURN,
                        stacks: totalPlayerBurnApplied,
                        remainingTurns: playerBurnDuration,
                    };
                }

                return {
                    kind: EFFECTS.BURN,
                    stacks: previous.stacks + totalPlayerBurnApplied,
                    remainingTurns: Math.max(previous.remainingTurns, playerBurnDuration),
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerSoakApplied > 0 && simulatedPlayerHp > 0) {
            const soakRemainingTurns = totalPlayerSoakDuration > 0 ? totalPlayerSoakDuration : undefined;
            setPlayerSoakStatus((previous) => ({
                kind: EFFECTS.SOAK,
                stacks: (previous?.stacks ?? 0) + totalPlayerSoakApplied,
                remainingTurns: soakRemainingTurns ?? previous?.remainingTurns,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerShieldGranted > 0) {
            setPlayerShield((previous) => previous + totalPlayerShieldGranted);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerFreezeSoakConvertPercent > 0 && simulatedPlayerHp > 0) {
            const currentSoak = playerSoakWasConsumed ? 0 : (currentPlayerSoak?.stacks ?? 0);
            if (currentSoak > 0) {
                convertedPlayerFreezeStacksFromEffect = Math.floor(currentSoak * Math.min(100, totalPlayerFreezeSoakConvertPercent) / 100);
                if (convertedPlayerFreezeStacksFromEffect > 0) {
                    const remaining = currentSoak - convertedPlayerFreezeStacksFromEffect;
                    setPlayerSoakStatus(remaining > 0 ? { kind: EFFECTS.SOAK, stacks: remaining, remainingTurns: currentPlayerSoak?.remainingTurns } : null);
                    const freezeRemainingTurns = totalPlayerFreezeSoakConvertDuration > 0 ? totalPlayerFreezeSoakConvertDuration : undefined;
                    setPlayerFreezeStatus((prev) => ({ kind: EFFECTS.FREEZE, stacks: (prev?.stacks ?? 0) + convertedPlayerFreezeStacksFromEffect, remainingTurns: freezeRemainingTurns ?? prev?.remainingTurns }));
                    await wait(EFFECT_STEP_DELAY_MS);
                }
            }
        }

        if (totalPlayerThornsApplied > 0 && simulatedPlayerHp > 0) {
            const thornsRemainingTurns = totalPlayerThornsDuration > 0 ? totalPlayerThornsDuration : undefined;
            setPlayerThornsStatus((previous) => ({
                kind: EFFECTS.THORNS,
                stacks: (previous?.stacks ?? 0) + totalPlayerThornsApplied,
                remainingTurns: thornsRemainingTurns ?? previous?.remainingTurns,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalEnemyHealing > 0) {
            // Enemy self-heal is intentionally kept simple here; it is enough to make healing spells matter.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setEnemyHealth((previous) => Math.min(enemyMaxHp, previous + totalEnemyHealing));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        const detailLines: string[] = [];
        if (hitCount > 1) {
            detailLines.push(`Hits ${hitCount}x | ${attackDamageBreakdown.join(" + ")}`);
        }
        if (totalPlayerBurnApplied > 0) {
            detailLines.push(`Burn +${totalPlayerBurnApplied}`);
        }
        if (totalPlayerShieldGranted > 0) {
            detailLines.push(`Shield +${totalPlayerShieldGranted}`);
        }
        if (totalPlayerSoakApplied > 0) {
            detailLines.push(`Soak +${totalPlayerSoakApplied}`);
        }
        if (playerSoakWasConsumed) {
            detailLines.push("Soak consumed");
        }
        if (convertedPlayerFreezeStacksFromEffect > 0) {
            detailLines.push(`Freeze +${convertedPlayerFreezeStacksFromEffect} (from soak)`);
        }
        if (playerFreezeWasConsumed) {
            detailLines.push("Freeze consumed");
        }
        if (totalPlayerThornsApplied > 0) {
            detailLines.push(`Thorns +${totalPlayerThornsApplied}`);
        }
        if (totalThornsReflected > 0) {
            detailLines.push(`Thorns reflects ${totalThornsReflected}`);
        }

        if (detailLines.length > 0) {
            detailLines.forEach((message) => {
                pushEventLog(message, "status", { isDetail: true });
            });
        }

        if (simulatedPlayerHp <= 0) {
            setQueuedEnemyAttack(null);
            return;
        }

        const strikeMsg = totalDamageTaken > 0
            ? `${attack.letter} strikes the player for ${totalDamageTaken} damage`
            : `${attack.letter} strikes the player (absorbed)`;
        pushEventLog(strikeMsg, "enemy");

        if (playerHitTimeoutRef.current !== null) {
            window.clearTimeout(playerHitTimeoutRef.current);
        }
        setIsPlayerHit(false);
        window.requestAnimationFrame(() => {
            setIsPlayerHit(true);
            playerHitTimeoutRef.current = window.setTimeout(() => {
                setIsPlayerHit(false);
            }, scaleCombatAnimationMs(480));
        });
        if (screenFlashTimeoutRef.current !== null) {
            window.clearTimeout(screenFlashTimeoutRef.current);
        }
        setIsScreenFlashing(false);
        window.requestAnimationFrame(() => {
            setIsScreenFlashing(true);
            screenFlashTimeoutRef.current = window.setTimeout(() => {
                setIsScreenFlashing(false);
            }, scaleCombatAnimationMs(420));
        });

        if (currentPlayerBurn) {
            await wait(220);

            const nextDuration = currentPlayerBurn.remainingTurns - 1;
            currentPlayerBurn = nextDuration > 0 && simulatedPlayerHp > 0
                ? { ...currentPlayerBurn, remainingTurns: nextDuration }
                : null;
            setPlayerBurnStatus(currentPlayerBurn);

            if (simulatedPlayerHp <= 0) {
                setQueuedEnemyAttack(null);
                return;
            }
        }

        // Tick down all other player stack durations at end of enemy's attack turn
        setPlayerSoakStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });
        setPlayerFreezeStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });
        setPlayerThornsStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });

        const nextAttack = pickEnemyAttack();
        setQueuedEnemyAttack(nextAttack);
        if (nextAttack) {
            pushEventLog(`Enemy prepares ${nextAttack.letter}`, "enemy", { isDetail: true });
            setIsReadyingNextAttack(true);
            await wait(560);
            setIsReadyingNextAttack(false);
        }
    };

    const handleEndTurn = async () => {
        if (enemyHealth <= 0 || isGameOver || isResolvingTurn) {
            return;
        }

        if (playerComboStatus) {
            setPlayerComboStatus(null);
            pushEventLog("Combo fades", "status", { isDetail: true });
        }
        if (followUpStatus) {
            setFollowUpStatus(null);
        }
        if (playerPowerComboStatus) {
            setPlayerPowerComboStatus(null);
        }

        setIsResolvingTurn(true);
        setIsEnemyTurnActive(true);

        const burnAtTurnEnd = enemyBurnStatus;
        const energizeAtTurnEnd = playerEnergizeStatus;
        const energyAtTurnStart = remainingEnergy;
        let nextEnemyHealth = enemyHealth;
        if (burnAtTurnEnd && nextEnemyHealth > 0) {
            const nextDuration = burnAtTurnEnd.remainingTurns - 1;
            setEnemyBurnStatus(nextDuration > 0 && nextEnemyHealth > 0
                ? { ...burnAtTurnEnd, remainingTurns: nextDuration }
                : null);
        }

        // Tick down all other enemy stack durations at end of player's turn
        setEnemySoakStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });
        setEnemyFreezeStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });
        setEnemyThornsStatus((prev) => {
            if (!prev?.remainingTurns) return prev;
            const next = prev.remainingTurns - 1;
            return next > 0 ? { ...prev, remainingTurns: next } : null;
        });

        if (nextEnemyHealth <= 0) {
            setQueuedEnemyAttack(null);
            if (energizeAtTurnEnd) {
                launchEnergyFlights(energizeDisplayRef.current, energyAtTurnStart, energizeAtTurnEnd.stacks);
                await wait(300);
            }
            setRemainingEnergy((prev) => Math.min(MAX_TURN_ENERGY, prev + ENERGY_PER_TURN + (energizeAtTurnEnd?.stacks ?? 0)));
            if (energizeAtTurnEnd) {
                setPlayerEnergizeStatus(null);
            }
            setPlayerShield(0);
            setIsEnemyTurnActive(false);
            setUsedWeaponThisTurn(false);
            setIsResolvingTurn(false);
            return;
        }

        await triggerEnemyAttack();
        const shieldAfterAttack = playerShieldRef.current;
        if (shieldAfterAttack > 0) {
            setIsShieldExpiring(true);
            await wait(360);
            setIsShieldExpiring(false);
            pushEventLog("Shield expired", "player");
        }
        setPlayerShield(0);
        if (energizeAtTurnEnd) {
            launchEnergyFlights(energizeDisplayRef.current, energyAtTurnStart, energizeAtTurnEnd.stacks);
            await wait(300);
        }
        setRemainingEnergy((prev) => Math.min(MAX_TURN_ENERGY, prev + ENERGY_PER_TURN + (energizeAtTurnEnd?.stacks ?? 0)));
        if (energizeAtTurnEnd) {
            setPlayerEnergizeStatus(null);
        }
        setIsEnemyTurnActive(false);
        setUsedWeaponThisTurn(false);
        setIsResolvingTurn(false);
    };

    const launchProjectileBurst = async (
        letter: string,
        fromElement: HTMLElement | null,
        toElement: HTMLElement | null,
        count: number,
        delayStep = 180,
        startDelay = 0,
    ) => {
        if (!fromElement || !toElement || count <= 0) {
            return startDelay;
        }

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        const startX = fromRect.left + fromRect.width / 2;
        const startY = fromRect.top + fromRect.height / 2;
        const endX = toRect.left + toRect.width / 2;
        const endY = toRect.top + toRect.height / 2;

        const scaledDelayStep = scaleCombatAnimationMs(delayStep);
        const scaledStartDelay = scaleCombatAnimationMs(startDelay);

        const newProjectiles: Projectile[] = Array.from({ length: count }, (_, i) => ({
            id: projectileIdRef.current++,
            letter,
            x: startX,
            y: startY,
            dx: endX - startX,
            dy: endY - startY,
            delay: scaledStartDelay + i * scaledDelayStep,
        }));

        setProjectiles((prev) => [...prev, ...newProjectiles]);

        const maxDelay = scaledStartDelay + Math.max(0, count - 1) * scaledDelayStep;
        window.setTimeout(() => {
            const ids = new Set(newProjectiles.map((p) => p.id));
            setProjectiles((prev) => prev.filter((p) => !ids.has(p.id)));
        }, maxDelay + scaleCombatAnimationMs(600));

        return scaledStartDelay + count * scaledDelayStep;
    };

    const launchEnergyFlights = (fromElement: HTMLElement | null, energyBefore: number, stacks: number) => {
        if (!fromElement || stacks <= 0) return;

        const fromRect = fromElement.getBoundingClientRect();
        const startX = fromRect.left + fromRect.width / 2;
        const startY = fromRect.top + fromRect.height / 2;

        const flightDuration = scaleCombatAnimationMs(280);
        const delayStep = scaleCombatAnimationMs(100);

        // Energize stacks fill pips beyond what ENERGY_PER_TURN would fill
        const normalFillEnd = Math.min(MAX_TURN_ENERGY, energyBefore + ENERGY_PER_TURN);

        const newFlights: EnergyFlight[] = [];
        for (let i = 0; i < stacks; i++) {
            const pipIndex = normalFillEnd + i;
            if (pipIndex >= MAX_TURN_ENERGY) break;
            const pipEl = pipRefs.current[pipIndex];
            if (!pipEl) continue;

            const pipRect = pipEl.getBoundingClientRect();
            newFlights.push({
                id: energizeFlyIdRef.current++,
                x: startX,
                y: startY,
                dx: pipRect.left + pipRect.width / 2 - startX,
                dy: pipRect.top + pipRect.height / 2 - startY,
                delay: i * delayStep,
                duration: flightDuration,
            });
        }

        if (newFlights.length === 0) return;

        setEnergizeFlights((prev) => [...prev, ...newFlights]);
        const maxDelay = Math.max(0, newFlights.length - 1) * delayStep;
        window.setTimeout(() => {
            const ids = new Set(newFlights.map((f) => f.id));
            setEnergizeFlights((prev) => prev.filter((f) => !ids.has(f.id)));
        }, maxDelay + flightDuration + 200);
    };

    const launchLeafFlight = (fromElement: HTMLElement | null, toElement: HTMLElement | null) => {
        if (!fromElement || !toElement) return;

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        const flightDuration = scaleCombatAnimationMs(320);
        const flight: EnergyFlight = {
            id: leafFlyIdRef.current++,
            x: fromRect.left + fromRect.width / 2,
            y: fromRect.top + fromRect.height / 2,
            dx: toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2),
            dy: toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2),
            delay: 0,
            duration: flightDuration,
        };

        setLeafFlights((prev) => [...prev, flight]);
        window.setTimeout(() => {
            setLeafFlights((prev) => prev.filter((f) => f.id !== flight.id));
        }, flightDuration + 200);
    };

    const launchProjectiles = (spell: { letter: string; effects?: SpellEffectConfig[] }, buttonEl: HTMLButtonElement | null) => {
        const hitCount = getSpellHitCount(spell.effects);
        launchProjectileBurst(spell.letter, buttonEl, enemySpriteRef.current, hitCount, 180);
    };

    const getSpellDamageForCastPreview = (
        spell: CastableSpell,
        spellEnergyCost: number,
        spellTypes: string[],
    ) => {
        const preMod = effectFactory.resolvePreHitDamage(
            effectTypeFactory.getBattleTriggerEffects(spell.effects ?? []),
            {
                spellEnergyCost,
                playerCurrentHp: player.hp,
                playerMaxHp,
                playerShield,
            },
        );

        const exponentialBonus = spellExponentialDamage[spell.letter] ?? 0;
        const followUpBonus = followUpStatus?.letter === spell.letter
            ? 1 + (followUpStatus.bonusPercent / 100) * followUpStatus.count
            : 1;
        const powerComboBonusMultiplier = (playerPowerComboStatus && spellTypes.includes(playerPowerComboStatus.requiredType))
            ? 1 + playerPowerComboStatus.bonusPercent / 100
            : 1;

        return Math.round(
            (spell.damage + exponentialBonus) * preMod.multiplier * followUpBonus * powerComboBonusMultiplier,
        ) + preMod.flatBonus;
    };

    const handleSlotClick = async (spell: CastableSpell) => {
        const activeComboType = playerComboStatus?.requiredType ?? null;
        const spellTypes = getSpellTypeList(spell);
        const spellComboType = getSpellComboType(spell.effects);
        const comboMatches = Boolean(activeComboType && spellTypes.includes(activeComboType));
        const spellEnergyCost = getSpellEnergyCost(spell, activeComboType);
        const isCombustSpell = hasCombustEffect(spell.effects);

        // One-time cast effects (not per-hit): look up directly from spell.effects
        const exhaustEffect = spell.effects?.find(e => e.kind === "exhaust");
        const squishyEffect = spell.effects?.find(e => e.kind === "squishy");
        const consumeEffect = spell.effects?.find(e => e.kind === "consume");
        const exponentialEffect = spell.effects?.find(e => e.kind === "exponential");
        const followUpEffect = spell.effects?.find(e => e.kind === "follow_up");
        const powerComboEffect = spell.effects?.find(e => e.kind === "power_combo");
        const combustSpellEffect = spell.effects?.find(e => e.kind === "explode");

        const spellDamageForCast = getSpellDamageForCastPreview(spell, spellEnergyCost, spellTypes);
        const isWeapon = spell.category?.toLowerCase() === "weapon";
        if (
            enemyHealth <= 0 ||
            isGameOver ||
            isResolvingTurn ||
            remainingEnergy < spellEnergyCost ||
            (isWeapon && usedWeaponThisTurn)
        ) {
            return;
        }

        setIsResolvingTurn(true);
        if (isWeapon) {
            setUsedWeaponThisTurn(true);
        }
        setRemainingEnergy((previous) => Math.max(0, previous - spellEnergyCost));

        setSpellCastFlashBackground(getSpellCastFlashBackground(spell.type1, spell.type2));
        setIsSpellCastFlashing(false);
        window.requestAnimationFrame(() => {
            setIsSpellCastFlashing(true);
            if (spellCastFlashTimeoutRef.current !== null) {
                window.clearTimeout(spellCastFlashTimeoutRef.current);
            }
            spellCastFlashTimeoutRef.current = window.setTimeout(() => {
                setIsSpellCastFlashing(false);
            }, scaleCombatAnimationMs(190));
        });

        setFlashingSlotId(spell.id);
        const enemyWeaknesses = (enemy.weaknesses ?? []).map(normalizeType).filter(Boolean);
        const isWaterSpell = spellTypes.includes("water");
        const isLightningSpell = spellTypes.includes("lightning");
        const isFireSpell = spellTypes.includes("fire");
        const isIceSpell = spellTypes.includes("ice");
        const isEarthSpell = spellTypes.includes("earth");
        const abilityName = getAbilityLogName(spell);
        const hitFlashColor = getSpellHitFlashColor(spell.type1, spell.type2);
        const hitCount = getSpellHitCount(spell.effects);
        const perHitEffects = effectTypeFactory.getBattleTriggerEffects(getPerHitSpellEffects(spell.effects));
        let remainingSoakStacks = enemySoakStatus?.stacks ?? 0;
        let remainingFreezeStacks = enemyFreezeStatus?.stacks ?? 0;

        let totalDamage = 0;
        let totalHealing = 0;
        let totalBurnApplied = 0;
        let totalShieldGranted = 0;
        let burnDuration = 0;
        let hadCriticalHit = false;
        let nextEnemyHealth = enemyHealth;
        const hitDamageBreakdown: number[] = [];
        let burnedWasExtinguished = false;
        let totalSoakApplied = 0;
        let totalSoakDuration = 0;
        let soakWasConsumed = false;
        let freezeWasConsumed = false;
        let consumedFreezeStacks = 0;
        let totalEnergizeApplied = 0;
        /** Accumulated % of enemy soak stacks to convert to freeze (from freeze effects) */
        let totalEnemyFreezeSoakConvertPercent = 0;
        let totalEnemyFreezeSoakConvertDuration = 0;
        let convertedFreezeStacksFromEffect = 0;
        let totalEnemyThornsApplied = 0;
        let totalEnemyThornsDuration = 0;
        let enemyFreezeWasConsumed = false;
        let consumedEnemyFreezeStacks = 0;
        let remainingEnemyFreezeStacks = enemyFreezeStatus?.stacks ?? 0;
        let comboWasConsumed = false;
        let comboWasBroken = false;

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            if (nextEnemyHealth <= 0) {
                break;
            }

            const isCritical = spellTypes.some((type) => enemyWeaknesses.includes(type));
            hadCriticalHit ||= isCritical;
            const soakBonus = isLightningSpell ? getSoakLightningBonus(remainingSoakStacks) : 0;
            const soakPenalty = isFireSpell ? getSoakFirePenalty(remainingSoakStacks) : 0;
            const freezeBonus = isFireSpell ? getFreezeFireBonus(remainingFreezeStacks) : 0;
            const spellTypeMultiplier = Math.max(
                ...spellTypes.map((t) => effectiveTypeMultipliers[t] ?? 1),
                1,
            );
            const scaledSpellDamage = Math.round(spellDamageForCast * spellTypeMultiplier);
            // Float is passive — use enemy's element-based float percent
            const enemyFloatEarthReduction = isEarthSpell ? getFloatEarthReduction(enemyPassiveFloatPercent, scaledSpellDamage) : 0;
            const enemyFloatLightningBonus = isLightningSpell ? getFloatLightningBonus(enemyPassiveFloatPercent, scaledSpellDamage) : 0;
            const baseHitDamage = Math.max(0, scaledSpellDamage + soakBonus - soakPenalty + freezeBonus - enemyFloatEarthReduction + enemyFloatLightningBonus);
            const burnBonus = isFireSpell ? getBurnFireBonus(enemyBurnStatus?.stacks ?? 0, baseHitDamage) : 0;
            const hitDamageBeforeCrit = baseHitDamage + burnBonus;
            const hitDamage = isCritical ? hitDamageBeforeCrit * 2 : hitDamageBeforeCrit;
            hitDamageBreakdown.push(hitDamage);
            totalDamage += hitDamage;
            nextEnemyHealth = Math.max(0, nextEnemyHealth - hitDamage);
            setEnemyHealth(nextEnemyHealth);
            triggerEnemyHitFeedback(hitDamage, hitFlashColor);

            if (isWaterSpell && !burnedWasExtinguished && enemyBurnStatus) {
                setEnemyBurnStatus(null);
                burnedWasExtinguished = true;
                triggerEnemySteamEffect();
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if ((isFireSpell || isLightningSpell) && !soakWasConsumed && remainingSoakStacks > 0) {
                soakWasConsumed = true;
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if (isFireSpell && !freezeWasConsumed && remainingFreezeStacks > 0) {
                consumedFreezeStacks = remainingFreezeStacks;
                freezeWasConsumed = true;
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if (isCritical && !isCritTextVisible) {
                setIsCritFlashing(false);
                setIsCritTextVisible(false);
                window.requestAnimationFrame(() => {
                    setIsCritFlashing(true);
                    setIsCritTextVisible(true);
                    setTimeout(() => setIsCritFlashing(false), scaleCombatAnimationMs(320));
                    setTimeout(() => setIsCritTextVisible(false), scaleCombatAnimationMs(520));
                });
            }

            await wait(HIT_STEP_DELAY_MS);

            perHitEffects.forEach((effect) => {
                const delta = effectFactory.resolvePlayerAttackEffect(effect, hitDamage);
                if (delta.playerHealing > 0) {
                    healPlayer(delta.playerHealing);
                    totalHealing += delta.playerHealing;
                }

                totalBurnApplied += delta.enemyBurnApplied;
                burnDuration = Math.max(burnDuration, delta.enemyBurnDuration);
                totalShieldGranted += delta.playerShieldGranted;
                totalSoakApplied += delta.enemySoakApplied;
                totalSoakDuration = Math.max(totalSoakDuration, delta.enemySoakDuration);
                totalEnergizeApplied += delta.playerEnergizeApplied;
                totalEnemyFreezeSoakConvertPercent += delta.enemyFreezeSoakConvertPercent;
                totalEnemyFreezeSoakConvertDuration = Math.max(totalEnemyFreezeSoakConvertDuration, delta.enemyFreezeSoakConvertDuration);
                totalEnemyThornsApplied += delta.enemyThornsApplied;
                totalEnemyThornsDuration = Math.max(totalEnemyThornsDuration, delta.enemyThornsDuration);
                // exhaust / squishy / consume / exponential / follow_up / power_combo
                // are one-time cast effects, not accumulated per hit.
            });

            if (perHitEffects.length > 0) {
                await wait(EFFECT_STEP_DELAY_MS);
            }

            if (hitIndex < hitCount - 1) {
                await wait(HIT_STEP_DELAY_MS);
            }
        }

        if (nextEnemyHealth > 0 && totalBurnApplied > 0) {
            setEnemyBurnStatus((previous) => {
                if (!previous) {
                    return {
                        kind: EFFECTS.BURN,
                        stacks: totalBurnApplied,
                        remainingTurns: burnDuration,
                    };
                }

                return {
                    kind: EFFECTS.BURN,
                    stacks: previous.stacks + totalBurnApplied,
                    remainingTurns: Math.max(previous.remainingTurns, burnDuration),
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (soakWasConsumed) {
            setEnemySoakStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (freezeWasConsumed) {
            setEnemyFreezeStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (nextEnemyHealth > 0 && totalSoakApplied > 0) {
            const soakRemainingTurns = totalSoakDuration > 0 ? totalSoakDuration : undefined;
            setEnemySoakStatus((previous) => ({
                kind: EFFECTS.SOAK,
                stacks: (previous?.stacks ?? 0) + totalSoakApplied,
                remainingTurns: soakRemainingTurns ?? previous?.remainingTurns,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        // Freeze effect: convert X% of current enemy soak stacks into freeze stacks
        if (nextEnemyHealth > 0 && totalEnemyFreezeSoakConvertPercent > 0) {
            const currentSoak = soakWasConsumed ? 0 : (enemySoakStatus?.stacks ?? 0);
            if (currentSoak > 0) {
                convertedFreezeStacksFromEffect = Math.floor(currentSoak * Math.min(100, totalEnemyFreezeSoakConvertPercent) / 100);
                if (convertedFreezeStacksFromEffect > 0) {
                    const remaining = currentSoak - convertedFreezeStacksFromEffect;
                    setEnemySoakStatus(remaining > 0 ? { kind: EFFECTS.SOAK, stacks: remaining, remainingTurns: enemySoakStatus?.remainingTurns } : null);
                    const freezeRemainingTurns = totalEnemyFreezeSoakConvertDuration > 0 ? totalEnemyFreezeSoakConvertDuration : undefined;
                    setEnemyFreezeStatus((prev) => ({ kind: EFFECTS.FREEZE, stacks: (prev?.stacks ?? 0) + convertedFreezeStacksFromEffect, remainingTurns: freezeRemainingTurns ?? prev?.remainingTurns }));
                    await wait(EFFECT_STEP_DELAY_MS);
                }
            }
        }

        if (nextEnemyHealth > 0 && totalEnemyThornsApplied > 0) {
            const thornsRemainingTurns = totalEnemyThornsDuration > 0 ? totalEnemyThornsDuration : undefined;
            setEnemyThornsStatus((previous) => ({
                kind: EFFECTS.THORNS,
                stacks: (previous?.stacks ?? 0) + totalEnemyThornsApplied,
                remainingTurns: thornsRemainingTurns ?? previous?.remainingTurns,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalShieldGranted > 0) {
            setPlayerShield((previous) => previous + Math.round(totalShieldGranted * effectiveShieldMultiplier));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalEnergizeApplied > 0) {
            setPlayerEnergizeStatus((previous) => {
                if (!previous) {
                    return { kind: EFFECTS.ENERGIZE, stacks: totalEnergizeApplied };
                }

                return { kind: EFFECTS.ENERGIZE, stacks: previous.stacks + totalEnergizeApplied };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        let combustRecoilDamage = 0;
        if (isCombustSpell) {
            const combustRecoilPercent = (combustSpellEffect?.amount ?? 10) / 100;
            combustRecoilDamage = Math.max(0, Math.round(spellDamageForCast * combustRecoilPercent));
            if (combustRecoilDamage > 0) {
                applyEnemyAttack(combustRecoilDamage);
                triggerPlayerDamagePopup(combustRecoilDamage, `-${combustRecoilDamage} COMBUST`);
                await wait(EFFECT_STEP_DELAY_MS);
            }
        }

        if (activeComboType) {
            const comboDiscount = playerComboStatus?.discountAmount ?? 1;
            if (comboMatches) {
                comboWasConsumed = true;
                pushEventLog(`Combo used: ${formatTypeLabel(activeComboType)} attack costs -${comboDiscount} energy`, "status", { isDetail: true });
            } else if (!spellComboType) {
                comboWasBroken = true;
                pushEventLog("Combo fades", "status", { isDetail: true });
            }
        }

        if (spellComboType) {
            const spellEnergyComboEffect = getSpellEnergyComboEffect(spell.effects);
            const discountAmt = Math.max(1, spellEnergyComboEffect?.amount ?? 1);
            setPlayerComboStatus({ requiredType: spellComboType, discountAmount: discountAmt });
            pushEventLog(`Combo primed: next ${formatTypeLabel(spellComboType)} attack costs -${discountAmt} energy`, "status", { isDetail: true });
        } else if (comboWasConsumed || comboWasBroken) {
            setPlayerComboStatus(null);
        }

        pushEventLog(`${abilityName} deals ${totalDamage} damage`, "player");

        const effectMessages: string[] = [];
        if (hitCount > 1) {
            effectMessages.push(`Hits ${hitCount}x | ${hitDamageBreakdown.join(" + ")}`);
        }
        if (totalHealing > 0) {
            effectMessages.push(`Heals ${totalHealing}`);
        }
        if (totalShieldGranted > 0) {
            effectMessages.push(`Shield +${totalShieldGranted}`);
        }
        if (totalBurnApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Burn +${totalBurnApplied}`);
        }
        if (totalSoakApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Soak +${totalSoakApplied}`);
        }
        if (totalEnergizeApplied > 0) {
            effectMessages.push(`Energize +${totalEnergizeApplied}`);
        }
        if (convertedFreezeStacksFromEffect > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Freeze +${convertedFreezeStacksFromEffect} (from soak)`);
        }
        if (totalEnemyThornsApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Thorns +${totalEnemyThornsApplied}`);
        }
        if (combustRecoilDamage > 0) {
            effectMessages.push(`Combust recoil ${combustRecoilDamage}`);
        }
        if (soakWasConsumed) {
            effectMessages.push("Soak evaporates");
        }
        if (freezeWasConsumed) {
            effectMessages.push("Freeze consumed");
        }
        if (burnedWasExtinguished) {
            effectMessages.push("Burn extinguished");
        }
        if (hadCriticalHit) {
            effectMessages.push("Super Effective");
        }

        // One-time self-effects applied once per cast
        if (exhaustEffect && (exhaustEffect.amount ?? 0) > 0) {
            const energyAfterSpend = Math.max(0, remainingEnergy - spellEnergyCost);
            const energyToRemove = Math.floor(energyAfterSpend * (exhaustEffect.amount ?? 0) / 100);
            if (energyToRemove > 0) {
                setRemainingEnergy(prev => Math.max(0, prev - energyToRemove));
                effectMessages.push(`Exhaust -${energyToRemove} energy`);
            }
        }
        if (squishyEffect && (squishyEffect.amount ?? 0) > 0) {
            const shieldToRemove = Math.floor(playerShield * (squishyEffect.amount ?? 0) / 100);
            if (shieldToRemove > 0) {
                setPlayerShield(prev => Math.max(0, prev - shieldToRemove));
                effectMessages.push(`Squishy -${shieldToRemove} shield`);
            }
        }
        if (consumeEffect && (consumeEffect.amount ?? 0) > 0) {
            decreaseMaxHp(consumeEffect.amount ?? 0);
            effectMessages.push(`Consume -${consumeEffect.amount} max HP`);
        }
        if (exponentialEffect && (exponentialEffect.amount ?? 0) > 0 && nextEnemyHealth > 0) {
            const bonusDamage = Math.round(spell.damage * (exponentialEffect.amount ?? 10) / 100);
            if (bonusDamage > 0) {
                setSpellExponentialDamage(prev => ({ ...prev, [spell.letter]: (prev[spell.letter] ?? 0) + bonusDamage }));
                effectMessages.push(`Exponential +${bonusDamage} permanent damage`);
            }
        }

        // Follow-up state: track consecutive casts of the same spell
        if (followUpEffect) {
            if (followUpStatus?.letter === spell.letter) {
                setFollowUpStatus(prev => prev ? { ...prev, count: prev.count + 1 } : null);
                effectMessages.push(`Follow-up x${(followUpStatus.count ?? 0) + 1}`);
            } else {
                setFollowUpStatus({ letter: spell.letter, bonusPercent: followUpEffect.amount ?? 50, count: 1 });
            }
        } else {
            setFollowUpStatus(null);
        }

        // Power-combo state
        if (playerPowerComboStatus && spellTypes.includes(playerPowerComboStatus.requiredType)) {
            effectMessages.push(`Power combo +${playerPowerComboStatus.bonusPercent}%`);
            setPlayerPowerComboStatus(null);
        }
        if (powerComboEffect?.targetType) {
            setPlayerPowerComboStatus({ requiredType: powerComboEffect.targetType, bonusPercent: powerComboEffect.amount ?? 50 });
            effectMessages.push(`Power combo primed: ${formatTypeLabel(powerComboEffect.targetType)} +${powerComboEffect.amount ?? 50}%`);
        }

        if (effectMessages.length > 0) {
            effectMessages.forEach((message) => {
                pushEventLog(message, inferEventKind(message), { isDetail: true });
            });
        }

        setIsResolvingTurn(false);
    };

    const handleFlashEnd = (slotId: number) => {
        if (flashingSlotId === slotId) {
            setFlashingSlotId(null);
        }
    };

    const isEnemyIntentTooltipOpen =
        hoveredEnemyAttack || isEnemyIntentTooltipHovered || isEnemyIntentTooltipGraceOpen;
    const isEnemyIntentTooltipClosing =
        isEnemyIntentTooltipGraceOpen && !hoveredEnemyAttack && !isEnemyIntentTooltipHovered;

    const handlePlayAgain = () => {
        resetGame();
        navigate("/game", {
            replace: true,
            state: {
                battleEnded: true,
            } as GameLocationState,
        });
    };

    return (
        <div id="Fight" className={isScreenFlashing ? "is-screen-shaking" : undefined}>
            {isSpellCastFlashing ? (
                <div
                    className="screen-spell-flash"
                    style={{ ["--spell-cast-flash-bg" as string]: spellCastFlashBackground }}
                />
            ) : null}
            {isScreenFlashing ? <div className="screen-hit-flash" /> : null}
            {isCritFlashing ? <div className="screen-crit-flash" /> : null}
            {isCritTextVisible ? <div className="crit-text">SUPER EFFECTIVE!</div> : null}

            {/* ─── Arena wrapper ─── */}
            <div className="fight-arena">

            {/* ─── Enemy Zone ─── */}
            <div className="enemy-zone">
                <div className="enemy-header">
                    <span className="enemy-name">{enemy.name}</span>
                </div>
                <div className="enemy-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={enemyMaxHp} aria-valuenow={enemyHealth}>
                    <div className="enemy-hp-fill" style={{ width: `${enemyHpFillPercent}%` }} />
                    <span className="enemy-hp-label">{enemyHealth} / {enemyMaxHp} HP</span>
                </div>
                <div className="enemy-stage-row">
                    <div className="enemy-stage-shell">
                        <EnemyStage
                            spriteRef={enemySpriteRef}
                            enemyName={enemy.name}
                            spritePath={enemy.sprite ?? ""}
                            enemyHealth={enemyHealth}
                            enemyMaxHp={enemyMaxHp}
                            enemyPower={enemy.power}
                            weaknesses={enemyWeaknesses}
                            elements={enemy.elements}
                            souls={enemy.souls}
                            isHitFlashing={isEnemySpriteFlashing}
                            hitFlashColor={enemySpriteFlashColor}
                            isSteamVisible={isEnemySteamVisible}
                            damagePopups={enemyDamagePopups}
                            burnStatus={enemyBurnStatus}
                            soakStatus={enemySoakStatus}
                            freezeStatus={enemyFreezeStatus}
                        />
                    </div>

                    {/* Intent badge — pinned to the right side of centered sprite */}
                    <div
                        ref={enemyAttackMarkerRef}
                        className={`enemy-intent-badge ${queuedEnemyAttack ? "" : "is-hidden"} ${isReadyingNextAttack ? "is-readying" : ""}`}
                        aria-label={queuedEnemyAttack ? `Enemy intends to attack with ${queuedEnemyAttack.letter}` : "Enemy attack not yet queued"}
                        aria-hidden={!queuedEnemyAttack}
                        onMouseEnter={handleEnemyIntentMouseEnter}
                        onMouseLeave={handleEnemyIntentMouseLeave}
                    >
                        <div ref={enemyIntentIconRef} className="enemy-intent-icon">
                            {queuedEnemyAttack ? (
                                <ElementIcon name={queuedEnemyAttack.letter} className="enemy-attack-marker-icon" />
                            ) : "?"}
                        </div>
                        <div className="enemy-intent-damage">
                            {queuedEnemyAttack
                                ? (() => {
                                    const baseDamage = Number(queuedEnemyAttack.damage ?? 0);
                                    return baseDamage + (
                                        getSpellTypeList(queuedEnemyAttack).includes("fire")
                                            ? getBurnFireBonus(playerBurnStatus?.stacks ?? 0, baseDamage)
                                            : 0
                                    );
                                })()
                                : "?"}
                        </div>
                        <div className="enemy-intent-label">NEXT ATTACK</div>
                    </div>
                </div>
                {queuedEnemyAttack ? (
                    <ElementDetailsTooltip
                            element={{
                                ...queuedEnemyAttack,
                                damage: (() => {
                                    const baseDamage = Number(queuedEnemyAttack.damage ?? 0);
                                    return baseDamage + (
                                        getSpellTypeList(queuedEnemyAttack).includes("fire")
                                            ? getBurnFireBonus(playerBurnStatus?.stacks ?? 0, baseDamage)
                                            : 0
                                    );
                                })(),
                            }}
                        anchorElement={enemyIntentIconRef.current ?? enemyAttackMarkerRef.current}
                        open={isEnemyIntentTooltipOpen && Boolean(enemyIntentIconRef.current ?? enemyAttackMarkerRef.current)}
                        className={`reward-element-tooltip-shell${isEnemyIntentTooltipClosing ? " is-closing" : ""}`}
                        clampHorizontal={false}
                        interactive
                        onTooltipMouseEnter={handleEnemyIntentTooltipMouseEnter}
                        onTooltipMouseLeave={handleEnemyIntentTooltipMouseLeave}
                    />
                ) : null}
            </div>{/* end .enemy-zone */}

            {/* ─── Spell Hand ─── */}
            <div className="spell-hand">
                <div className="spell-hand-scroll">
                    {castableSpells.map((spell) => (
                        (() => {
                            const activeComboType = playerComboStatus?.requiredType ?? null;
                            const spellTypes = getSpellTypeList(spell);
                            const comboReady = Boolean(activeComboType && spellTypes.includes(activeComboType));
                            const isFireSpell = spellTypes.includes("fire");
                            const displayedEnergyCost = getSpellEnergyCost(spell, activeComboType);
                            const isCombustSpell = hasCombustEffect(spell.effects);
                            const displayedDamage = getSpellDamageForCastPreview(spell, displayedEnergyCost, spellTypes);
                            const spellTypeMultiplier = Math.max(
                                ...spellTypes.map((t) => effectiveTypeMultipliers[normalizeType(t)] ?? 1),
                                1,
                            );
                            const baseDisplayedDamage = Math.round(displayedDamage * spellTypeMultiplier);
                            const burnBonusDamage = isFireSpell ? getBurnFireBonus(enemyBurnStatus?.stacks ?? 0, baseDisplayedDamage) : 0;
                            const totalDisplayedDamage = baseDisplayedDamage + burnBonusDamage;
                            const canAffordSpell = remainingEnergy >= displayedEnergyCost;
                            const isWeapon = spell.category?.toLowerCase() === "weapon";
                            const isSpellCardHovered = hoveredSpellId === spell.id;
                            const isSpellTooltipHovered = hoveredSpellTooltipId === spell.id;
                            const isSpellTooltipGraceOpen = spellTooltipGraceId === spell.id;
                            const isSpellTooltipOpen = isSpellCardHovered || isSpellTooltipHovered || isSpellTooltipGraceOpen;
                            const isSpellTooltipClosing = isSpellTooltipGraceOpen && !isSpellCardHovered && !isSpellTooltipHovered;

                            return (
                        <button
                            key={spell.id}
                            ref={(element) => {
                                spellSlotRefs.current[spell.id] = element;
                            }}
                            type="button"
                            className={`spell-card ${flashingSlotId === spell.id ? "is-flashing" : ""} ${comboReady ? "is-combo-ready" : ""} ${(!isGameOver && !isResolvingTurn && !canAffordSpell) ? "is-unaffordable" : ""} ${(isWeapon && usedWeaponThisTurn) ? "is-used" : ""}`}
                            disabled={
                                isGameOver ||
                                isResolvingTurn ||
                                !canAffordSpell ||
                                (isWeapon && usedWeaponThisTurn)
                            }
                            style={getSpellSlotStyle(spell.type1, spell.type2)}
                            onMouseEnter={() => handleSpellCardMouseEnter(spell.id)}
                            onMouseLeave={() => handleSpellCardMouseLeave(spell.id)}
                            onClick={(e) => {
                                const clickTarget = e.target as Node | null;
                                if (!clickTarget || !e.currentTarget.contains(clickTarget)) {
                                    return;
                                }

                                const btn = e.currentTarget as HTMLButtonElement;
                                launchProjectiles(
                                    { letter: spell.letter, effects: spell.effects },
                                    btn,
                                );
                                if ([spell.type1, spell.type2].map(normalizeType).includes("leaf")) {
                                    launchLeafFlight(btn, energizeDisplayRef.current);
                                }
                                handleSlotClick({
                                    id: spell.id,
                                    letter: spell.letter,
                                    damage: spell.damage,
                                    energy: spell.energy,
                                    type1: spell.type1,
                                    type2: spell.type2,
                                    effects: spell.effects,
                                    category: spell.category,
                                });
                            }}
                            onAnimationEnd={() => handleFlashEnd(spell.id)}
                        >
                            <FloatingTooltip
                                anchorElement={spellSlotRefs.current[spell.id]}
                                open={isSpellTooltipOpen}
                                className={`drag-description-popup${isSpellTooltipClosing ? " is-closing" : ""}`}
                                interactive
                                onTooltipMouseEnter={() => handleSpellTooltipMouseEnter(spell.id)}
                                onTooltipMouseLeave={() => handleSpellTooltipMouseLeave(spell.id)}
                                clampHorizontal={false}
                                typeMultipliers={effectiveTypeMultipliers}
                                elementDetails={{
                                    letter: spell.letter,
                                    damage: totalDisplayedDamage,
                                    energy: spell.energy,
                                    description: spell.description,
                                    type1: spell.type1,
                                    type2: spell.type2,
                                    effects: spell.effects,
                                    level: spell.level,
                                    category: spell.category,
                                }}
                            />
                            <span className={`spell-card-energy${comboReady ? " is-combo-discounted" : ""}`}>{displayedEnergyCost}</span>
                            <div className="spell-card-icon">
                                <ElementIcon name={spell.letter} />
                            </div>
                            <div className="spell-card-name">{spell.letter}</div>
                            <div className="spell-card-damage">
                                {totalDisplayedDamage}
                                {isCombustSpell ? (
                                    <span className="spell-card-power-tooltip" role="tooltip">
                                        {(() => {
                                            const cEffect = spell.effects?.find(e => e.kind === "explode");
                                            return <span>{`Combust: deals ${cEffect?.amount ?? 10}% of damage as self-damage on use`}</span>;
                                        })()}
                                    </span>
                                ) : null}
                            </div>
                        </button>
                            );
                        })()
                    ))}
                </div>
            </div>

            {/* ─── Player HUD ─── */}
            <div className="player-hud">
                <div className="player-hud-left">
                    {playerName.trim().length > 0 ? <div className="player-name-banner">{playerName.trim()}</div> : null}
                    <div ref={playerStatusStripRef} className="player-status-strip" aria-label="Player status effects">
                        <span
                            className={`player-status-badge player-status-badge--burn ${playerBurnStatus ? "" : "is-hidden"}`}
                            aria-label={playerBurnStatus ? `Burn ${playerBurnStatus.stacks}` : undefined}
                            aria-hidden={!playerBurnStatus}
                        >
                            <span className="player-status-icon" aria-hidden="true">🔥</span>
                            <span className="player-status-count">{playerBurnStatus?.stacks ?? ""}</span>
                            <span className="player-status-description">
                                Fire +{getBurnFireBonusPercent(playerBurnStatus?.stacks ?? 0)}% | {playerBurnStatus?.remainingTurns ?? 0} turns
                            </span>
                        </span>
                        <span
                            className={`player-status-badge player-status-badge--soak ${playerSoakStatus ? "" : "is-hidden"}`}
                            aria-label={playerSoakStatus ? `Soak ${playerSoakStatus.stacks}` : undefined}
                            aria-hidden={!playerSoakStatus}
                        >
                            <span className="player-status-icon" aria-hidden="true">💧</span>
                            <span className="player-status-count">{playerSoakStatus?.stacks ?? ""}</span>
                            <span className="player-status-description">
                                Lightning +{(playerSoakStatus?.stacks ?? 0) * SOAK_LIGHTNING_BONUS_PER_STACK} | Fire -{(playerSoakStatus?.stacks ?? 0) * SOAK_FIRE_PENALTY_PER_STACK}
                            </span>
                        </span>
                    <span
                        className={`player-status-badge player-status-badge--freeze ${playerFreezeStatus ? "" : "is-hidden"}`}
                        aria-label={playerFreezeStatus ? `Freeze ${playerFreezeStatus.stacks}` : undefined}
                        aria-hidden={!playerFreezeStatus}
                    >
                        <span className="player-status-icon" aria-hidden="true">❄</span>
                        <span className="player-status-count">{playerFreezeStatus?.stacks ?? ""}</span>
                        <span className="player-status-description">
                            Fire +{(playerFreezeStatus?.stacks ?? 0) * FREEZE_FIRE_BONUS_PER_STACK} damage
                        </span>
                    </span>
                    <span
                        ref={energizeDisplayRef}
                        className={`player-status-badge player-status-badge--energize ${playerEnergizeStatus ? "" : "is-hidden"}`}
                        aria-label={playerEnergizeStatus ? `Energize ${playerEnergizeStatus.stacks}` : undefined}
                        aria-hidden={!playerEnergizeStatus}
                    >
                        <span className="player-status-icon" aria-hidden="true"><img src={energizeIcon} alt="" style={{ width: "0.85rem", height: "0.85rem", objectFit: "contain" }} /></span>
                        <span className="player-status-count">{playerEnergizeStatus?.stacks ?? ""}</span>
                        <span className="player-status-description">
                            Next turn +{playerEnergizeStatus?.stacks ?? 0} energy
                        </span>
                    </span>
                    </div>
                </div>
                <div className="player-hud-center">
                    <div className="player-hp-row">
                        {playerShield > 0 ? (
                            <span
                                className={`player-shield-badge${isShieldExpiring ? " is-expiring" : ""}`}
                                style={{ backgroundImage: `url(${shieldIcon})` }}
                                aria-label={`Shield ${playerShield}`}
                            >
                                <span className="player-shield-value">{playerShield}</span>
                                <span className="player-shield-tooltip">You have {playerShield} shield this turn</span>
                            </span>
                        ) : null}
                        <div
                            ref={playerHpBarRef}
                            className={`player-hp-bar ${playerShield > 0 ? "has-shield" : ""} ${isPlayerHealingFlash ? "is-healing" : ""} ${isPlayerShieldFlash ? "is-shield-gain" : ""} ${isPlayerBurnHitFlash ? "is-burn-hit" : ""}`}
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={playerMaxHp}
                            aria-valuenow={displayedPlayerHp}
                        >
                            <div
                                className="player-hp-fill player-hp-fill--health"
                                style={{ width: `${playerHealthFillPercent}%` }}
                            />
                            <div
                                className="player-hp-fill player-hp-fill--shield"
                                style={{
                                    left: `${playerHealthFillPercent}%`,
                                    width: `${playerShieldTailFillPercent}%`,
                                }}
                            />
                            {playerDamagePopups.map((popup, index) => (
                                <span
                                    key={popup.id}
                                    className={`player-damage-popup ${popup.kind === "burn" ? "player-damage-popup--burn" : ""}`}
                                    style={{
                                        ["--player-popup-offset" as string]: `${index * 0.58}rem`,
                                        ["--player-popup-left" as string]: `${Math.max(4, Math.min(96, playerHealthFillPercent))}%`,
                                    }}
                                >
                                    {popup.text}
                                </span>
                            ))}
                            <span className={`player-hp-label ${playerShield > 0 ? "has-shield" : ""}`}>
                                {displayedPlayerHp} / {playerMaxHp} HP
                            </span>
                        </div>
                    </div>
                </div>
                <div className="player-hud-right">
                    <button
                        type="button"
                        className="end-turn-button"
                        onClick={handleEndTurn}
                        disabled={isGameOver || enemyHealth <= 0 || isResolvingTurn}
                    >
                        End Turn
                    </button>
                </div>
            </div>{/* end .player-hud */}

            {/* ─── Energy Row ─── */}
            <div className="energy-row" aria-live="polite" aria-label={`Turn energy ${remainingEnergy} out of ${MAX_TURN_ENERGY}`}>
                <span className="energy-row-label">{isEnemyTurnActive ? "ENEMY TURN" : "ENERGY"}</span>
                <div className="energy-pips">
                    {Array.from({ length: MAX_TURN_ENERGY }).map((_, i) => (
                        <span
                            key={i}
                            ref={(el) => { pipRefs.current[i] = el; }}
                            className={`energy-pip ${i < remainingEnergy ? "is-active" : "is-spent"}`}
                            aria-hidden="true"
                        />
                    ))}
                </div>
                <span className="energy-row-count">{remainingEnergy}/{MAX_TURN_ENERGY}</span>
            </div>
            </div>{/* end .fight-arena */}

            <aside className={`event-log-panel${isBattleLogExpanded ? " is-expanded" : " is-collapsed"}`} aria-label="Fight event log">
                <button
                    type="button"
                    className="event-log-title"
                    onClick={() => setIsBattleLogExpanded((current) => !current)}
                    aria-expanded={isBattleLogExpanded}
                    aria-controls="fight-battle-log-list"
                >
                    <span>BATTLE LOG</span>
                    <span className="event-log-title-toggle" aria-hidden="true">{isBattleLogExpanded ? "-" : "+"}</span>
                </button>
                {isBattleLogExpanded ? (
                    <div id="fight-battle-log-list" className="event-log-list" ref={eventLogContainerRef} aria-live="polite">
                        {eventLogEntries.length === 0 ? (
                            <p className="event-log-empty">Actions will appear here.</p>
                        ) : (
                            eventLogEntries.map((entry) => (
                                <p
                                    key={entry.id}
                                    className={`event-log-entry event-log-entry--${entry.kind}${entry.isDetail ? " event-log-entry--detail" : ""}`}
                                >
                                    <span className={`event-log-tag event-log-tag--${entry.kind}`}>
                                        {entry.kind}
                                    </span>
                                    <span className="event-log-text">{entry.text}</span>
                                </p>
                            ))
                        )}
                    </div>
                ) : null}
            </aside>

            {isGameOver ? (
                <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
                    <div className="game-over-modal">
                        <h2 id="game-over-title">Game Over</h2>
                        <p>You were defeated by {enemy.name}.</p>
                        <button type="button" onClick={handlePlayAgain}>Play again</button>
                    </div>
                </div>
            ) : null}
            {projectiles.length > 0
                ? createPortal(
                    <>
                        {projectiles.map((proj) => (
                            <span
                                key={proj.id}
                                className="spell-projectile"
                                aria-hidden="true"
                                style={{
                                    left: proj.x,
                                    top: proj.y,
                                    ["--proj-dx" as string]: `${proj.dx}px`,
                                    ["--proj-dy" as string]: `${proj.dy}px`,
                                    animationDelay: `${proj.delay}ms`,
                                }}
                            >
                                <ElementIcon name={proj.letter} />
                            </span>
                        ))}
                    </>,
                    document.body,
                )
                : null}
            {energizeFlights.length > 0
                ? createPortal(
                    <>
                        {energizeFlights.map((flight) => (
                            <span
                                key={flight.id}
                                className="energize-flight"
                                aria-hidden="true"
                                style={{
                                    left: flight.x,
                                    top: flight.y,
                                    ["--proj-dx" as string]: `${flight.dx}px`,
                                    ["--proj-dy" as string]: `${flight.dy}px`,
                                    animationDelay: `${flight.delay}ms`,
                                    animationDuration: `${flight.duration}ms`,
                                }}
                            >
                                <img src={energizeIcon} alt="" />
                            </span>
                        ))}
                    </>,
                    document.body,
                )
                : null
            }
        </div>
    );
}

export default Fight;