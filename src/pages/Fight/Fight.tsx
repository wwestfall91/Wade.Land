import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import {
    getPerHitSpellEffects,
    getSpellHitCount,
    type ActiveBurnStatus,
    type ActiveEnergizeStatus,
    type ActiveFreezeStatus,
    type ActiveFloatStatus,
    type ActiveSoakStatus,
    type ActiveThornsStatus,
    type SpellEffectConfig,
} from "../../combat/spellEffects";
import {
    BURN_DAMAGE_PER_STACK,
    ENERGY_PER_TURN,
    FREEZE_FIRE_BONUS_PER_STACK,
    MAX_TURN_ENERGY,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
    THORNS_REFLECT_PERCENT_PER_STACK,
    FLOAT_EARTH_REDUCTION_PERCENT_PER_STACK,
    FLOAT_LIGHTNING_BONUS_PERCENT_PER_STACK,
    getBurnTickDamage,
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

type SpellColor = {
    bg: string;
    border: string;
    text: string;
};

const SPELL_TYPE_COLORS: Record<string, SpellColor> = {
    fire: { bg: "#ffb680", border: "#d0652c", text: "#2a140a" },
    water: { bg: "#9ad6ff", border: "#3c84c4", text: "#081f33" },
    earth: { bg: "#ccb086", border: "#7d5c37", text: "#26190b" },
    air: { bg: "#dff6ff", border: "#75a4b8", text: "#0f2832" },
    lightning: { bg: "#ffe56d", border: "#b59308", text: "#332700" },
    ice: { bg: "#baf1ff", border: "#5aa8bd", text: "#0f2c34" },
    light: { bg: "#fff3bd", border: "#b59a36", text: "#312700" },
    dark: { bg: "#8d84aa", border: "#514569", text: "#faf9ff" },
    arcane: { bg: "#ffc1e4", border: "#af5f8d", text: "#2f1023" },
};

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
};

type HardenedSpellState = {
    phase: "preparing" | "ready";
    baseDamage: number;
    readyDamage: number;
    consumedEnergy: number;
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, playerName, levels, applyEnemyAttack, healPlayer, resetGame, typeMultipliers, playerStatuses, setPlayerStatuses, shieldMultiplier, soakMultiplier, burnMultiplier, maxHpMultiplier, battleEnergyCarryover, setBattleEnergyCarryover } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [hoveredSpellId, setHoveredSpellId] = useState<number | null>(null);
    const [hoveredSpellTooltipId, setHoveredSpellTooltipId] = useState<number | null>(null);
    const [spellTooltipGraceId, setSpellTooltipGraceId] = useState<number | null>(null);
    const [hoveredEnemyAttack, setHoveredEnemyAttack] = useState(false);
    const [isEnemyIntentTooltipHovered, setIsEnemyIntentTooltipHovered] = useState(false);
    const [isEnemyIntentTooltipGraceOpen, setIsEnemyIntentTooltipGraceOpen] = useState(false);
    const [remainingEnergy, setRemainingEnergy] = useState(() => Math.min(MAX_TURN_ENERGY, ENERGY_PER_TURN + battleEnergyCarryover));
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
    const [hardenedSpellStates, setHardenedSpellStates] = useState<Record<number, HardenedSpellState>>({});
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
    const playerMaxHp = Math.round((levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1)) * maxHpMultiplier);
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
    const getSpellComboType = (effects?: SpellEffectConfig[]) =>
        effects?.find((effect) => effect.kind === "combo")?.targetType ?? null;
    const hasHardenedEffect = (effects?: SpellEffectConfig[]) =>
        Boolean(effects?.some((effect) => effect.kind === "hardened"));

    useEffect(() => {
        setHardenedSpellStates((previous) => {
            const next: Record<number, HardenedSpellState> = {};

            player.elements.forEach((spell) => {
                if (!hasHardenedEffect(spell.effects)) {
                    return;
                }

                const existing = previous[spell.id];
                if (existing?.phase === "ready") {
                    next[spell.id] = existing;
                    return;
                }

                next[spell.id] = {
                    phase: "preparing",
                    baseDamage: spell.damage,
                    readyDamage: spell.damage,
                    consumedEnergy: 0,
                };
            });

            return next;
        });
    }, [player.elements]);

    const getSpellSlotStyle = (type1?: string, type2?: string) => {
        const normalized = [type1, type2].map(normalizeType).filter(Boolean);
        if (normalized.length === 0) {
            return undefined;
        }

        const first = SPELL_TYPE_COLORS[normalized[0]];
        const second = normalized[1] ? SPELL_TYPE_COLORS[normalized[1]] : undefined;

        const fallback: SpellColor = { bg: "#e9e9e9", border: "#a9a9a9", text: "#202020" };
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

    const triggerPlayerBurnHitFlash = () => {
        setIsPlayerBurnHitFlash(false);
        window.requestAnimationFrame(() => {
            setIsPlayerBurnHitFlash(true);
            if (playerBurnHitFlashTimeoutRef.current !== null) {
                window.clearTimeout(playerBurnHitFlashTimeoutRef.current);
            }

            playerBurnHitFlashTimeoutRef.current = window.setTimeout(() => {
                setIsPlayerBurnHitFlash(false);
            }, scaleCombatAnimationMs(320));
        });
    };

    const getSpellEnergyCost = (spell: { energy?: number; type1?: string; type2?: string }, comboType: string | null = playerComboStatus?.requiredType ?? null) => {
        const baseCost = Math.max(0, spell.energy ?? 0);
        if (!comboType) {
            return baseCost;
        }

        const spellTypes = getSpellTypeList(spell);
        return spellTypes.includes(comboType) ? Math.max(0, baseCost - 1) : baseCost;
    };

    const inferEventKind = (message: string): EventLogEntry["kind"] => {
        if (message.startsWith("Enemy attacks")) {
            return "enemy";
        }
        if (message.startsWith("Heals") || message.startsWith("Shield ") || message.startsWith("Hits") || message.startsWith("Critical hit")) {
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
            setBattleEnergyCarryover(Math.min(MAX_TURN_ENERGY, remainingEnergy));
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
    }, [elementPool, enemy.souls, enemyHealth, navigate, playerBurnStatus, playerSoakStatus, playerFreezeStatus, playerEnergizeStatus, remainingEnergy, setBattleEnergyCarryover, setPlayerStatuses]);

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
        const currentPlayerFloat = playerFloatStatus;

        const attackTypes = [attack.type1, attack.type2].map(normalizeType).filter(Boolean);
        const isWaterAttack = attackTypes.includes("water");
        const isLightningAttack = attackTypes.includes("lightning");
        const isFireAttack = attackTypes.includes("fire");
        const isIceAttack = attackTypes.includes("ice");
        const isEarthAttack = attackTypes.includes("earth");
        const hitCount = getSpellHitCount(attack.effects);
        const perHitEffects = getPerHitSpellEffects(attack.effects);
        const attackDamageBreakdown: number[] = [];
        let totalDamageTaken = 0;
        let totalPlayerBurnApplied = 0;
        let playerBurnDuration = 0;
        let totalPlayerShieldGranted = 0;
        let totalPlayerSoakApplied = 0;
        let playerSoakWasConsumed = false;
        let playerSoakWasFrozen = false;
        let playerFreezeWasConsumed = false;
        let convertedPlayerFreezeStacks = 0;
        let currentPlayerSoakStacks = currentPlayerSoak?.stacks ?? 0;
        let currentPlayerFreezeStacks = currentPlayerFreeze?.stacks ?? 0;
        let totalEnemyHealing = 0;
        let totalThornsReflected = 0;
        let totalPlayerFreezeApplied = 0;
        let totalPlayerThornsApplied = 0;
        let totalPlayerFloatApplied = 0;
        let nextEnemyHealthForThorns = enemyHealth;
        const enemyAttackSource = enemyIntentIconRef.current ?? enemyAttackMarkerRef.current;

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            if (simulatedPlayerHp <= 0) {
                break;
            }

            const soakBonus = isLightningAttack ? getSoakLightningBonus(currentPlayerSoakStacks) : 0;
            const soakPenalty = isFireAttack ? getSoakFirePenalty(currentPlayerSoakStacks) : 0;
            const freezeBonus = isFireAttack ? getFreezeFireBonus(currentPlayerFreezeStacks) : 0;
            const floatStacks = currentPlayerFloat?.stacks ?? 0;
            const floatEarthReduction = isEarthAttack ? getFloatEarthReduction(floatStacks, attack.damage) : 0;
            const floatLightningBonus = isLightningAttack ? getFloatLightningBonus(floatStacks, attack.damage) : 0;
            const baseHitDamage = Math.max(0, attack.damage + soakBonus - soakPenalty + freezeBonus - floatEarthReduction + floatLightningBonus);
            const absorbedDamage = Math.min(currentPlayerShield, baseHitDamage);
            const remainingDamage = Math.max(0, baseHitDamage - absorbedDamage);

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

            if (isIceAttack && !playerSoakWasFrozen && currentPlayerSoakStacks > 0) {
                convertedPlayerFreezeStacks = currentPlayerSoakStacks;
                playerSoakWasFrozen = true;
                currentPlayerSoakStacks = 0;
                await wait(EFFECT_STEP_DELAY_MS);
            } else if ((isFireAttack || isLightningAttack) && !playerSoakWasConsumed && currentPlayerSoakStacks > 0) {
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
                switch (effect.kind) {
                    case "heal": {
                        const amount = Math.max(0, effect.amount ?? 0);
                        if (amount > 0 && effect.target === "enemy") {
                            totalPlayerBurnApplied += 0;
                            // Enemy-target heal is applied after the loop as player healing.
                        }
                        break;
                    }
                    case "burn": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        const duration = Math.max(1, effect.duration ?? 1);
                        totalPlayerBurnApplied += amount;
                        playerBurnDuration = Math.max(playerBurnDuration, duration);
                        break;
                    }
                    case "shield": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        totalPlayerShieldGranted += amount;
                        break;
                    }
                    case "lifesteal": {
                        if (effect.target !== "self") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        const multiplier = amount > 1 ? amount / 100 : amount;
                        const healing = Math.max(0, Math.round(remainingDamage * multiplier));
                        if (healing > 0) {
                            totalEnemyHealing += healing;
                        }
                        break;
                    }
                    case "soak": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        totalPlayerSoakApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "freeze": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        totalPlayerFreezeApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "thorns": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        totalPlayerThornsApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "float": {
                        if (effect.target !== "enemy") {
                            return;
                        }

                        totalPlayerFloatApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    default:
                        break;
                }
            });

            if (simulatedPlayerHp <= 0) {
                break;
            }
        }

        const stackProjectileCount =
            Math.max(0, totalPlayerBurnApplied) +
            Math.max(0, totalPlayerSoakApplied) +
            Math.max(0, convertedPlayerFreezeStacks);
        if (stackProjectileCount > 0 && simulatedPlayerHp > 0) {
            launchProjectileBurst(attack.letter, enemyAttackSource, playerStatusStripRef.current, stackProjectileCount, 110);
            await wait(240);
        }

        if (playerSoakWasFrozen) {
            setPlayerSoakStatus(null);
            setPlayerFreezeStatus((previous) => {
                if (!previous) {
                    return { kind: "freeze", stacks: convertedPlayerFreezeStacks };
                }

                return {
                    kind: "freeze",
                    stacks: previous.stacks + convertedPlayerFreezeStacks,
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        } else if (playerSoakWasConsumed) {
            setPlayerSoakStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (playerFreezeWasConsumed) {
            setPlayerFreezeStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        totalPlayerBurnApplied = Math.round(totalPlayerBurnApplied * burnMultiplier);
        totalPlayerSoakApplied = Math.round(totalPlayerSoakApplied * soakMultiplier);

        if (totalPlayerBurnApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerBurnStatus((previous) => {
                if (!previous) {
                    return {
                        kind: "burn",
                        stacks: totalPlayerBurnApplied,
                        remainingTurns: playerBurnDuration,
                    };
                }

                return {
                    kind: "burn",
                    stacks: previous.stacks + totalPlayerBurnApplied,
                    remainingTurns: Math.max(previous.remainingTurns, playerBurnDuration),
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerSoakApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerSoakStatus((previous) => {
                if (!previous) {
                    return {
                        kind: "soak",
                        stacks: totalPlayerSoakApplied,
                    };
                }

                return {
                    kind: "soak",
                    stacks: previous.stacks + totalPlayerSoakApplied,
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerShieldGranted > 0) {
            setPlayerShield((previous) => previous + totalPlayerShieldGranted);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerFreezeApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerFreezeStatus((previous) => {
                if (!previous) {
                    return { kind: "freeze", stacks: totalPlayerFreezeApplied };
                }
                return { kind: "freeze", stacks: previous.stacks + totalPlayerFreezeApplied };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerThornsApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerThornsStatus((previous) => {
                if (!previous) {
                    return { kind: "thorns", stacks: totalPlayerThornsApplied };
                }
                return { kind: "thorns", stacks: previous.stacks + totalPlayerThornsApplied };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalPlayerFloatApplied > 0 && simulatedPlayerHp > 0) {
            setPlayerFloatStatus((previous) => {
                if (!previous) {
                    return { kind: "float", stacks: totalPlayerFloatApplied };
                }
                return { kind: "float", stacks: previous.stacks + totalPlayerFloatApplied };
            });
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
        if (playerSoakWasFrozen) {
            detailLines.push(`Freeze +${convertedPlayerFreezeStacks}`);
        }
        if (playerFreezeWasConsumed) {
            detailLines.push("Freeze consumed");
        }
        if (totalPlayerFreezeApplied > 0) {
            detailLines.push(`Freeze +${totalPlayerFreezeApplied}`);
        }
        if (totalPlayerThornsApplied > 0) {
            detailLines.push(`Thorns +${totalPlayerThornsApplied}`);
        }
        if (totalPlayerFloatApplied > 0) {
            detailLines.push(`Float +${totalPlayerFloatApplied}`);
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

            const burnDamage = getBurnTickDamage(currentPlayerBurn.stacks);
            if (burnDamage > 0) {
                simulatedPlayerHp = Math.max(0, simulatedPlayerHp - burnDamage);
                applyEnemyAttack(burnDamage);
                triggerPlayerDamagePopup(burnDamage, `-${burnDamage}`, "burn");
                triggerPlayerBurnHitFlash();
                pushEventLog(`Burn deals ${burnDamage} damage (${currentPlayerBurn.stacks} stack${currentPlayerBurn.stacks === 1 ? "" : "s"})`, "status");
                await wait(EFFECT_STEP_DELAY_MS);
            }

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

        setIsResolvingTurn(true);
        setIsEnemyTurnActive(true);

        const burnAtTurnEnd = enemyBurnStatus;
        const energizeAtTurnEnd = playerEnergizeStatus;
        const energyAtTurnStart = remainingEnergy;
        let nextEnemyHealth = enemyHealth;
        if (burnAtTurnEnd && nextEnemyHealth > 0) {
            const burnDamage = getBurnTickDamage(burnAtTurnEnd.stacks);
            if (burnDamage > 0) {
                nextEnemyHealth = Math.max(0, nextEnemyHealth - burnDamage);
                setEnemyHealth(nextEnemyHealth);
                triggerEnemyHitFeedback(burnDamage, "#ff8f44", `-${burnDamage} BURN`, "burn");
                pushEventLog(
                    `Enemy burn deals ${burnDamage} damage (${burnAtTurnEnd.stacks} stack${burnAtTurnEnd.stacks === 1 ? "" : "s"})`,
                    "status",
                );
                await wait(240);
            }

            const nextDuration = burnAtTurnEnd.remainingTurns - 1;
            setEnemyBurnStatus(nextDuration > 0 && nextEnemyHealth > 0
                ? { ...burnAtTurnEnd, remainingTurns: nextDuration }
                : null);
        }

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

    const handleSlotClick = async (spell: CastableSpell) => {
        const activeComboType = playerComboStatus?.requiredType ?? null;
        const spellTypes = getSpellTypeList(spell);
        const spellComboType = getSpellComboType(spell.effects);
        const comboMatches = Boolean(activeComboType && spellTypes.includes(activeComboType));
        const spellEnergyCost = getSpellEnergyCost(spell, activeComboType);
        const hardenedState = hardenedSpellStates[spell.id];
        const isHardenedSpell = hasHardenedEffect(spell.effects);
        const isHardenedPreparing = isHardenedSpell && (hardenedState?.phase ?? "preparing") === "preparing";
        const spellDamageForCast = isHardenedSpell && hardenedState?.phase === "ready"
            ? hardenedState.readyDamage
            : spell.damage;
        const isWeapon = spell.category?.toLowerCase() === "weapon";
        if (
            enemyHealth <= 0 ||
            isGameOver ||
            isResolvingTurn ||
            (!isHardenedPreparing && remainingEnergy < spellEnergyCost) ||
            (isWeapon && usedWeaponThisTurn)
        ) {
            return;
        }

        setIsResolvingTurn(true);
        if (isWeapon) {
            setUsedWeaponThisTurn(true);
        }
        const energySpent = isHardenedPreparing ? remainingEnergy : spellEnergyCost;
        setRemainingEnergy((previous) => Math.max(0, previous - energySpent));

        if (isHardenedPreparing) {
            const readyDamage = Math.max(0, Math.round(spell.damage * (1 + energySpent * 0.5)));
            setHardenedSpellStates((previous) => ({
                ...previous,
                [spell.id]: {
                    phase: "ready",
                    baseDamage: spell.damage,
                    readyDamage,
                    consumedEnergy: energySpent,
                },
            }));
            pushEventLog(`${spell.letter} hardens: ${spell.damage} -> ${readyDamage} (${energySpent} energy)`, "status");
            setIsResolvingTurn(false);
            return;
        }

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
        const perHitEffects = getPerHitSpellEffects(spell.effects);
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
        let soakWasConsumed = false;
        let soakWasFrozen = false;
        let convertedFreezeStacks = 0;
        let freezeWasConsumed = false;
        let consumedFreezeStacks = 0;
        let totalEnergizeApplied = 0;
        let totalEnemyFreezeApplied = 0;
        let totalEnemyThornsApplied = 0;
        let totalEnemyFloatApplied = 0;
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
            const enemyFloatStacks = enemyFloatStatus?.stacks ?? 0;
            const spellTypeMultiplier = Math.max(
                ...spellTypes.map((t) => typeMultipliers[t] ?? 1),
                1,
            );
            const scaledSpellDamage = Math.round(spellDamageForCast * spellTypeMultiplier);
            const enemyFloatEarthReduction = isEarthSpell ? getFloatEarthReduction(enemyFloatStacks, scaledSpellDamage) : 0;
            const enemyFloatLightningBonus = isLightningSpell ? getFloatLightningBonus(enemyFloatStacks, scaledSpellDamage) : 0;
            const baseHitDamage = Math.max(0, scaledSpellDamage + soakBonus - soakPenalty + freezeBonus - enemyFloatEarthReduction + enemyFloatLightningBonus);
            const hitDamage = isCritical ? baseHitDamage * 2 : baseHitDamage;
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

            if (isIceSpell && !soakWasFrozen && remainingSoakStacks > 0) {
                convertedFreezeStacks = remainingSoakStacks;
                soakWasFrozen = true;
                await wait(EFFECT_STEP_DELAY_MS);
            } else if ((isFireSpell || isLightningSpell) && !soakWasConsumed && remainingSoakStacks > 0) {
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
                switch (effect.kind) {
                    case "heal": {
                        if (effect.target === "enemy") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        if (amount > 0) {
                            healPlayer(amount);
                            totalHealing += amount;
                        }
                        break;
                    }
                    case "burn": {
                        if (effect.target === "self") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        const duration = Math.max(1, effect.duration ?? 1);
                        totalBurnApplied += amount;
                        burnDuration = Math.max(burnDuration, duration);
                        break;
                    }
                    case "shield": {
                        if (effect.target === "enemy") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        totalShieldGranted += amount;
                        break;
                    }
                    case "lifesteal": {
                        if (effect.target === "enemy") {
                            return;
                        }

                        const amount = Math.max(0, effect.amount ?? 0);
                        const multiplier = amount > 1 ? amount / 100 : amount;
                        const healing = Math.max(0, Math.round(hitDamage * multiplier));
                        if (healing > 0) {
                            healPlayer(healing);
                            totalHealing += healing;
                        }
                        break;
                    }
                    case "soak": {
                        if (effect.target === "self") {
                            return;
                        }

                        totalSoakApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "energize": {
                        if (effect.target === "enemy") {
                            return;
                        }

                        totalEnergizeApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "freeze": {
                        // freeze targeting the enemy: if they have soak, convert it; otherwise apply directly
                        if (effect.target === "self") {
                            return;
                        }

                        totalEnemyFreezeApplied += Math.max(1, effect.amount ?? 1);
                        break;
                    }
                    case "thorns": {
                        // thorns targeting self = buff the player; targeting enemy = debuff the enemy
                        if (effect.target === "enemy") {
                            totalEnemyThornsApplied += Math.max(1, effect.amount ?? 1);
                        }
                        break;
                    }
                    case "float": {
                        if (effect.target === "enemy") {
                            totalEnemyFloatApplied += Math.max(1, effect.amount ?? 1);
                        }
                        break;
                    }
                    default:
                        break;
                }
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
                        kind: "burn",
                        stacks: totalBurnApplied,
                        remainingTurns: burnDuration,
                    };
                }

                return {
                    kind: "burn",
                    stacks: previous.stacks + totalBurnApplied,
                    remainingTurns: Math.max(previous.remainingTurns, burnDuration),
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (soakWasFrozen) {
            setEnemySoakStatus(null);
            setEnemyFreezeStatus((previous) => {
                if (!previous) {
                    return { kind: "freeze", stacks: convertedFreezeStacks };
                }

                return {
                    kind: "freeze",
                    stacks: previous.stacks + convertedFreezeStacks,
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        } else if (soakWasConsumed) {
            setEnemySoakStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (freezeWasConsumed) {
            setEnemyFreezeStatus(null);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (nextEnemyHealth > 0 && totalSoakApplied > 0) {
            setEnemySoakStatus((previous) => {
                if (!previous) {
                    return {
                        kind: "soak",
                        stacks: totalSoakApplied,
                    };
                }

                return {
                    kind: "soak",
                    stacks: previous.stacks + totalSoakApplied,
                };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        // Freeze effect: convert enemy soak to freeze first, then add any remaining
        if (nextEnemyHealth > 0 && totalEnemyFreezeApplied > 0) {
            const currentSoakStacks = enemySoakStatus?.stacks ?? 0;
            if (currentSoakStacks > 0) {
                setEnemySoakStatus(null);
                setEnemyFreezeStatus((previous) => ({
                    kind: "freeze",
                    stacks: (previous?.stacks ?? 0) + currentSoakStacks + totalEnemyFreezeApplied,
                }));
            } else {
                setEnemyFreezeStatus((previous) => ({
                    kind: "freeze",
                    stacks: (previous?.stacks ?? 0) + totalEnemyFreezeApplied,
                }));
            }
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (nextEnemyHealth > 0 && totalEnemyThornsApplied > 0) {
            setEnemyThornsStatus((previous) => ({
                kind: "thorns",
                stacks: (previous?.stacks ?? 0) + totalEnemyThornsApplied,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (nextEnemyHealth > 0 && totalEnemyFloatApplied > 0) {
            setEnemyFloatStatus((previous) => ({
                kind: "float",
                stacks: (previous?.stacks ?? 0) + totalEnemyFloatApplied,
            }));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalShieldGranted > 0) {
            setPlayerShield((previous) => previous + Math.round(totalShieldGranted * shieldMultiplier));
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (totalEnergizeApplied > 0) {
            setPlayerEnergizeStatus((previous) => {
                if (!previous) {
                    return { kind: "energize", stacks: totalEnergizeApplied };
                }

                return { kind: "energize", stacks: previous.stacks + totalEnergizeApplied };
            });
            await wait(EFFECT_STEP_DELAY_MS);
        }

        if (activeComboType) {
            if (comboMatches) {
                comboWasConsumed = true;
                pushEventLog(`Combo used: ${formatTypeLabel(activeComboType)} attack costs -1 energy`, "status", { isDetail: true });
            } else if (!spellComboType) {
                comboWasBroken = true;
                pushEventLog("Combo fades", "status", { isDetail: true });
            }
        }

        if (spellComboType) {
            setPlayerComboStatus({ requiredType: spellComboType });
            pushEventLog(`Combo primed: next ${formatTypeLabel(spellComboType)} attack costs -1 energy`, "status", { isDetail: true });
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
        if (totalEnemyFreezeApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Freeze +${totalEnemyFreezeApplied}`);
        }
        if (totalEnemyThornsApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Thorns +${totalEnemyThornsApplied}`);
        }
        if (totalEnemyFloatApplied > 0 && nextEnemyHealth > 0) {
            effectMessages.push(`Float +${totalEnemyFloatApplied}`);
        }
        if (soakWasConsumed) {
            effectMessages.push("Soak evaporates");
        }
        if (soakWasFrozen) {
            effectMessages.push(`Freeze +${convertedFreezeStacks}`);
        }
        if (freezeWasConsumed) {
            effectMessages.push(`Freeze consumed`);
        }
        if (burnedWasExtinguished) {
            effectMessages.push("Burn extinguished");
        }
        if (hadCriticalHit) {
            effectMessages.push("Critical hit");
        }

        if (effectMessages.length > 0) {
            effectMessages.forEach((message) => {
                pushEventLog(message, inferEventKind(message), { isDetail: true });
            });
        }

        if (isHardenedSpell && hardenedState?.phase === "ready") {
            setHardenedSpellStates((previous) => ({
                ...previous,
                [spell.id]: {
                    phase: "preparing",
                    baseDamage: spell.damage,
                    readyDamage: spell.damage,
                    consumedEnergy: 0,
                },
            }));
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
            {isCritTextVisible ? <div className="crit-text">CRITICAL!</div> : null}

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
                <EnemyStage
                    spriteRef={enemySpriteRef}
                    enemyName={enemy.name}
                    spritePath={enemy.sprite ?? ""}
                    enemyHealth={enemyHealth}
                    enemyMaxHp={enemyMaxHp}
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
                {queuedEnemyAttack ? (
                    <ElementDetailsTooltip
                        element={queuedEnemyAttack}
                        anchorElement={enemyIntentIconRef.current ?? enemyAttackMarkerRef.current}
                        open={isEnemyIntentTooltipOpen && Boolean(enemyIntentIconRef.current ?? enemyAttackMarkerRef.current)}
                        className={`reward-element-tooltip-shell${isEnemyIntentTooltipClosing ? " is-closing" : ""}`}
                        clampHorizontal={false}
                        interactive
                        onTooltipMouseEnter={handleEnemyIntentTooltipMouseEnter}
                        onTooltipMouseLeave={handleEnemyIntentTooltipMouseLeave}
                    />
                ) : null}

                {/* Intent badge — always visible next to sprite */}
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
                    <div className="enemy-intent-damage">{queuedEnemyAttack?.damage ?? "?"}</div>
                    <div className="enemy-intent-label">NEXT ATTACK</div>
                </div>
            </div>{/* end .enemy-zone */}

            {/* ─── Spell Hand ─── */}
            <div className="spell-hand">
                <div className="spell-hand-scroll">
                    {player.elements.map((spell) => (
                        (() => {
                            const activeComboType = playerComboStatus?.requiredType ?? null;
                            const spellTypes = getSpellTypeList(spell);
                            const comboReady = Boolean(activeComboType && spellTypes.includes(activeComboType));
                            const displayedEnergyCost = getSpellEnergyCost(spell, activeComboType);
                            const hardenedState = hardenedSpellStates[spell.id];
                            const isHardenedSpell = hasHardenedEffect(spell.effects);
                            const isHardenedPreparing = isHardenedSpell && (hardenedState?.phase ?? "preparing") === "preparing";
                            const isHardenedReady = isHardenedSpell && hardenedState?.phase === "ready";
                            const displayedDamage = hasHardenedEffect(spell.effects) && hardenedState?.phase === "ready"
                                ? hardenedState.readyDamage
                                : spell.damage;
                            const canAffordSpell = isHardenedPreparing ? true : remainingEnergy >= displayedEnergyCost;
                            const hardenedBoostPercent = Math.max(0, (hardenedState?.consumedEnergy ?? 0) * 50);
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
                            className={`spell-card ${flashingSlotId === spell.id ? "is-flashing" : ""} ${comboReady ? "is-combo-ready" : ""} ${(!isGameOver && !isResolvingTurn && !canAffordSpell) ? "is-unaffordable" : ""} ${(isWeapon && usedWeaponThisTurn) ? "is-used" : ""} ${isHardenedReady ? "is-hardened-ready" : ""}`}
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
                                typeMultipliers={typeMultipliers}
                                elementDetails={{
                                    letter: spell.letter,
                                    damage: displayedDamage,
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
                            <div className={`spell-card-damage${isHardenedReady ? " is-hardened-ready" : ""}`}>
                                {Math.round(displayedDamage * Math.max(
                                    ...[spell.type1, spell.type2]
                                        .filter((t): t is string => Boolean(t?.trim()))
                                        .map(t => typeMultipliers[normalizeType(t)] ?? 1),
                                    1,
                                ))}
                                {isHardenedReady && hardenedState ? (
                                    <span className="spell-card-power-tooltip" role="tooltip">
                                        <span>{`${hardenedState.baseDamage} -> ${hardenedState.readyDamage}`}</span>
                                        <span>{`${hardenedState.consumedEnergy} energy consumed increased power by ${hardenedBoostPercent}%`}</span>
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
                            <span className="player-status-tooltip">
                                <span>Burn Stacks: {playerBurnStatus?.stacks ?? 0}</span>
                                <span>Expires in: {playerBurnStatus?.remainingTurns ?? 0} turns</span>
                                <span>Damage: {(playerBurnStatus?.stacks ?? 0) * BURN_DAMAGE_PER_STACK}</span>
                            </span>
                        </span>
                        <span
                            className={`player-status-badge player-status-badge--soak ${playerSoakStatus ? "" : "is-hidden"}`}
                            aria-label={playerSoakStatus ? `Soak ${playerSoakStatus.stacks}` : undefined}
                            aria-hidden={!playerSoakStatus}
                        >
                            <span className="player-status-icon" aria-hidden="true">💧</span>
                            <span className="player-status-count">{playerSoakStatus?.stacks ?? ""}</span>
                            <span className="player-status-tooltip">
                                <span>Soak Stacks: {playerSoakStatus?.stacks ?? 0}</span>
                                <span>Lightning +{(playerSoakStatus?.stacks ?? 0) * SOAK_LIGHTNING_BONUS_PER_STACK}</span>
                                <span>Fire -{(playerSoakStatus?.stacks ?? 0) * SOAK_FIRE_PENALTY_PER_STACK}</span>
                        </span>
                    </span>
                    <span
                        className={`player-status-badge player-status-badge--freeze ${playerFreezeStatus ? "" : "is-hidden"}`}
                        aria-label={playerFreezeStatus ? `Freeze ${playerFreezeStatus.stacks}` : undefined}
                        aria-hidden={!playerFreezeStatus}
                    >
                        <span className="player-status-icon" aria-hidden="true">❄</span>
                        <span className="player-status-count">{playerFreezeStatus?.stacks ?? ""}</span>
                        <span className="player-status-tooltip">
                            <span>Freeze Stacks: {playerFreezeStatus?.stacks ?? 0}</span>
                            <span>Fire gains +{(playerFreezeStatus?.stacks ?? 0) * FREEZE_FIRE_BONUS_PER_STACK} damage</span>
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
                        <span className="player-status-tooltip">
                            <span>Energize Stacks: {playerEnergizeStatus?.stacks ?? 0}</span>
                            <span>Next turn: +{playerEnergizeStatus?.stacks ?? 0} energy</span>
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
                <span className="energy-row-label">{isEnemyTurnActive ? "ENEMY TURN" : "YOUR TURN"}</span>
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