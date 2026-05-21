import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import {
    getPerHitSpellEffects,
    getSpellHitCount,
    type ActiveBurnStatus,
    type ActiveFreezeStatus,
    type ActiveSoakStatus,
    type SpellEffectConfig,
} from "../../combat/spellEffects";
import {
    BURN_DAMAGE_PER_STACK,
    FREEZE_FIRE_BONUS_PER_STACK,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
    getBurnTickDamage,
    getFreezeFireBonus,
    getSoakFirePenalty,
    getSoakLightningBonus,
} from "../../combat/statusMath";
import EnemyInfoSprite from "../../components/EnemyInfoSprite";
import ElementDetailsTooltip from "../../components/ElementDetailsTooltip";
import { usePlayer, type RewardElement } from "../../context/PlayerContext";
import RewardModal from "./RewardModal";
import FloatingTooltip from "../Game/FloatingTooltip";
import ElementIcon from "../../components/ElementIcon";

type EnemyDamagePopup = {
    id: number;
    text: string;
    color: string;
    kind?: "default" | "burn";
};

type EventLogEntry = {
    id: number;
    text: string;
    kind: "enemy" | "player" | "status";
    isDetail?: boolean;
};

const HIT_FLASH_MS = 190;
const HIT_STEP_DELAY_MS = 120;
const EFFECT_STEP_DELAY_MS = 95;
const EVENT_LOG_MAX_ENTRIES = 60;
const TURN_ENERGY = 4;

const wait = (ms: number) => new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
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
    experience: number;
    weaknesses?: string[];
    sprite?: string;
    elements: RewardElement[];
};

type FightLocationState = {
    enemy?: FightEnemy;
    elementPool?: RewardElement[];
};

type CastableSpell = {
    id: number;
    letter: string;
    damage: number;
    energy?: number;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, playerName, levels, addExperience, addElement, applyEnemyAttack, healPlayer, resetGame } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [hoveredSpellId, setHoveredSpellId] = useState<number | null>(null);
    const [hoveredEnemyAttack, setHoveredEnemyAttack] = useState(false);
    const [hoveredEnemyMetaElementIndex, setHoveredEnemyMetaElementIndex] = useState<number | null>(null);
    const [usedSpellIds, setUsedSpellIds] = useState<number[]>([]);
    const [remainingEnergy, setRemainingEnergy] = useState(TURN_ENERGY);
    const [eventLogEntries, setEventLogEntries] = useState<EventLogEntry[]>([]);
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
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardElements, setRewardElements] = useState<RewardElement[]>([]);
    const [enemyBurnStatus, setEnemyBurnStatus] = useState<ActiveBurnStatus | null>(null);
    const [enemySoakStatus, setEnemySoakStatus] = useState<ActiveSoakStatus | null>(null);
    const [enemyFreezeStatus, setEnemyFreezeStatus] = useState<ActiveFreezeStatus | null>(null);
    const [playerBurnStatus, setPlayerBurnStatus] = useState<ActiveBurnStatus | null>(null);
    const [playerSoakStatus, setPlayerSoakStatus] = useState<ActiveSoakStatus | null>(null);
    const [playerFreezeStatus, setPlayerFreezeStatus] = useState<ActiveFreezeStatus | null>(null);
    const [playerShield, setPlayerShield] = useState(0);
    const [enemyShield, setEnemyShield] = useState(0);
    const [isResolvingTurn, setIsResolvingTurn] = useState(false);
    const [queuedEnemyAttack, setQueuedEnemyAttack] = useState<RewardElement | null>(null);
    const [isReadyingNextAttack, setIsReadyingNextAttack] = useState(false);
    const [isEnemySpriteFlashing, setIsEnemySpriteFlashing] = useState(false);
    const [isEnemySteamVisible, setIsEnemySteamVisible] = useState(false);
    const [enemySpriteFlashColor, setEnemySpriteFlashColor] = useState("rgba(255, 255, 255, 0.6)");
    const [enemyDamagePopups, setEnemyDamagePopups] = useState<EnemyDamagePopup[]>([]);
    const [isPlayerHealingFlash, setIsPlayerHealingFlash] = useState(false);
    const [isPlayerShieldFlash, setIsPlayerShieldFlash] = useState(false);
    const preRewardXp = useRef(player.experience);
    const hasResolvedVictory = useRef(false);
    const previousPlayerHpRef = useRef(player.hp);
    const previousPlayerShieldRef = useRef(playerShield);
    const enemyDamagePopupIdRef = useRef(1);
    const eventLogIdRef = useRef(1);
    const eventLogContainerRef = useRef<HTMLDivElement | null>(null);
    const spellSlotRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const enemyAttackMarkerRef = useRef<HTMLDivElement | null>(null);
    const enemyIntentIconRef = useRef<HTMLDivElement | null>(null);
    const enemySpriteRef = useRef<HTMLDivElement | null>(null);
    const playerHpBarRef = useRef<HTMLDivElement | null>(null);
    const playerStatusStripRef = useRef<HTMLDivElement | null>(null);
    const projectileIdRef = useRef(1);
    const enemyMetaElementRefs = useRef<Record<number, HTMLSpanElement | null>>({});
    const healFlashTimeoutRef = useRef<number | null>(null);
    const shieldFlashTimeoutRef = useRef<number | null>(null);
    const playerHitTimeoutRef = useRef<number | null>(null);
    const screenFlashTimeoutRef = useRef<number | null>(null);
    const spellCastFlashTimeoutRef = useRef<number | null>(null);
    const enemySteamTimeoutRef = useRef<number | null>(null);
    const enemyIntentReadyingTimeoutRef = useRef<number | null>(null);

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, experience: 0, weaknesses: [], sprite: "", elements: [] };
    }, [location.state]);

    const elementPool = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.elementPool ?? [];
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);
    const enemyMaxHp = Math.max(1, enemy.hp);
    const enemyHpFillPercent = Math.max(0, Math.min(100, (enemyHealth / enemyMaxHp) * 100));
    const playerMaxHp = levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1);
    const displayedPlayerHp = player.hp + Math.max(0, playerShield);
    const playerHpFillPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));
    const playerShieldFillPercent = Math.max(0, Math.min(100, (Math.max(0, playerShield) / playerMaxHp) * 100));
    const playerTotalFillPercent = Math.min(100, playerHpFillPercent + playerShieldFillPercent);
    const playerShieldTailFillPercent = Math.min(playerShieldFillPercent, playerTotalFillPercent);
    const playerHealthFillPercent = Math.max(0, playerTotalFillPercent - playerShieldTailFillPercent);

    const normalizeType = (value?: string) => value?.trim().toLowerCase() ?? "";
    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const pickEnemyAttack = () => enemy.elements[Math.floor(Math.random() * enemy.elements.length)] ?? null;
    const enemyWeaknesses = (enemy.weaknesses ?? []).map((weakness) => weakness.trim()).filter((weakness) => weakness.length > 0);

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
        }, 480);
    };

    const getSpellEnergyCost = (spell: { energy?: number }) => Math.max(0, spell.energy ?? 0);

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
            if (enemySteamTimeoutRef.current !== null) {
                window.clearTimeout(enemySteamTimeoutRef.current);
            }
            if (enemyIntentReadyingTimeoutRef.current !== null) {
                window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
            }
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
            }, 520);
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
            }, 420);
        }

        previousPlayerHpRef.current = player.hp;
    }, [player.hp]);

    useEffect(() => {
        if (playerShield > previousPlayerShieldRef.current) {
            setIsPlayerShieldFlash(true);
            if (shieldFlashTimeoutRef.current !== null) {
                window.clearTimeout(shieldFlashTimeoutRef.current);
            }

            shieldFlashTimeoutRef.current = window.setTimeout(() => {
                setIsPlayerShieldFlash(false);
            }, 360);
        }

        previousPlayerShieldRef.current = playerShield;
    }, [playerShield]);

    useEffect(() => {
        if (enemyHealth <= 0 && !hasResolvedVictory.current) {
            hasResolvedVictory.current = true;
            const shuffled = [...elementPool].sort(() => Math.random() - 0.5);
            const chosen = shuffled.slice(0, Math.min(3, shuffled.length));
            setRewardElements(chosen);
            setShowRewardModal(true);
        }
    }, [elementPool, enemyHealth]);

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
            setIsReadyingNextAttack(false);
            if (enemyIntentReadyingTimeoutRef.current !== null) {
                window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
            }
            return;
        }

        const initialAttack = pickEnemyAttack();
        setQueuedEnemyAttack(initialAttack);
        setHoveredEnemyAttack(false);
        setIsReadyingNextAttack(false);

        if (enemyIntentReadyingTimeoutRef.current !== null) {
            window.clearTimeout(enemyIntentReadyingTimeoutRef.current);
        }

        if (initialAttack) {
            window.requestAnimationFrame(() => {
                setIsReadyingNextAttack(true);
                enemyIntentReadyingTimeoutRef.current = window.setTimeout(() => {
                    setIsReadyingNextAttack(false);
                }, 560);
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

        if (currentPlayerBurn) {
            const burnDamage = getBurnTickDamage(currentPlayerBurn.stacks);
            if (burnDamage > 0) {
                simulatedPlayerHp = Math.max(0, simulatedPlayerHp - burnDamage);
                applyEnemyAttack(burnDamage);
                pushEventLog(`Burn deals ${burnDamage} damage (${currentPlayerBurn.stacks} stack${currentPlayerBurn.stacks === 1 ? "" : "s"})`, "status");
                await wait(EFFECT_STEP_DELAY_MS);
            }

            const nextDuration = currentPlayerBurn.remainingTurns - 1;
            currentPlayerBurn = nextDuration > 0
                ? { ...currentPlayerBurn, remainingTurns: nextDuration }
                : null;
            setPlayerBurnStatus(currentPlayerBurn);

            if (simulatedPlayerHp <= 0) {
                setQueuedEnemyAttack(null);
                return;
            }
        }

        const attackTypes = [attack.type1, attack.type2].map(normalizeType).filter(Boolean);
        const isWaterAttack = attackTypes.includes("water");
        const isLightningAttack = attackTypes.includes("lightning");
        const isFireAttack = attackTypes.includes("fire");
        const isIceAttack = attackTypes.includes("ice");
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
        const enemyAttackSource = enemyIntentIconRef.current ?? enemyAttackMarkerRef.current;

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            if (simulatedPlayerHp <= 0) {
                break;
            }

            const soakBonus = isLightningAttack ? getSoakLightningBonus(currentPlayerSoakStacks) : 0;
            const soakPenalty = isFireAttack ? getSoakFirePenalty(currentPlayerSoakStacks) : 0;
            const freezeBonus = isFireAttack ? getFreezeFireBonus(currentPlayerFreezeStacks) : 0;
            const baseHitDamage = Math.max(0, attack.damage + soakBonus - soakPenalty + freezeBonus);
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
            }, 480);
        });
        if (screenFlashTimeoutRef.current !== null) {
            window.clearTimeout(screenFlashTimeoutRef.current);
        }
        setIsScreenFlashing(false);
        window.requestAnimationFrame(() => {
            setIsScreenFlashing(true);
            screenFlashTimeoutRef.current = window.setTimeout(() => {
                setIsScreenFlashing(false);
            }, 420);
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

        setIsResolvingTurn(true);

        const burnAtTurnEnd = enemyBurnStatus;
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
            setUsedSpellIds([]);
            setRemainingEnergy(TURN_ENERGY);
            setIsResolvingTurn(false);
            return;
        }

        await triggerEnemyAttack();
        setUsedSpellIds([]);
        setRemainingEnergy(TURN_ENERGY);
        setIsResolvingTurn(false);
    };

    const launchProjectileBurst = (
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

        const newProjectiles: Projectile[] = Array.from({ length: count }, (_, i) => ({
            id: projectileIdRef.current++,
            letter,
            x: startX,
            y: startY,
            dx: endX - startX,
            dy: endY - startY,
            delay: startDelay + i * delayStep,
        }));

        setProjectiles((prev) => [...prev, ...newProjectiles]);

        const maxDelay = startDelay + Math.max(0, count - 1) * delayStep;
        window.setTimeout(() => {
            const ids = new Set(newProjectiles.map((p) => p.id));
            setProjectiles((prev) => prev.filter((p) => !ids.has(p.id)));
        }, maxDelay + 600);

        return startDelay + count * delayStep;
    };

    const launchProjectiles = (spell: { letter: string; effects?: SpellEffectConfig[] }, buttonEl: HTMLButtonElement | null) => {
        const hitCount = getSpellHitCount(spell.effects);
        launchProjectileBurst(spell.letter, buttonEl, enemySpriteRef.current, hitCount, 180);
    };

    const handleSlotClick = async (spell: CastableSpell) => {
        const spellEnergyCost = getSpellEnergyCost(spell);
        if (
            usedSpellIds.includes(spell.id) ||
            enemyHealth <= 0 ||
            isGameOver ||
            isResolvingTurn ||
            remainingEnergy <= 0 ||
            remainingEnergy < spellEnergyCost
        ) {
            return;
        }

        setIsResolvingTurn(true);
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
            }, 190);
        });

        setFlashingSlotId(spell.id);
        const spellTypes = [spell.type1, spell.type2].map(normalizeType).filter(Boolean);
        const enemyWeaknesses = (enemy.weaknesses ?? []).map(normalizeType).filter(Boolean);
        const isWaterSpell = spellTypes.includes("water");
        const isLightningSpell = spellTypes.includes("lightning");
        const isFireSpell = spellTypes.includes("fire");
        const isIceSpell = spellTypes.includes("ice");
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

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
            if (nextEnemyHealth <= 0) {
                break;
            }

            const isCritical = spellTypes.some((type) => enemyWeaknesses.includes(type));
            hadCriticalHit ||= isCritical;
            const soakBonus = isLightningSpell ? getSoakLightningBonus(remainingSoakStacks) : 0;
            const soakPenalty = isFireSpell ? getSoakFirePenalty(remainingSoakStacks) : 0;
            const freezeBonus = isFireSpell ? getFreezeFireBonus(remainingFreezeStacks) : 0;
            const baseHitDamage = Math.max(0, spell.damage + soakBonus - soakPenalty + freezeBonus);
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
                    setTimeout(() => setIsCritFlashing(false), 320);
                    setTimeout(() => setIsCritTextVisible(false), 520);
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

        if (totalShieldGranted > 0) {
            setPlayerShield((previous) => previous + totalShieldGranted);
            await wait(EFFECT_STEP_DELAY_MS);
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

        let isTurnOver = false;
        setUsedSpellIds((previous) => {
            if (previous.includes(spell.id)) {
                return previous;
            }

            const next = [...previous, spell.id];
            isTurnOver = next.length >= player.elements.length;

            return next;
        });

        if (isTurnOver) {
            if (nextEnemyHealth > 0) {
                pushEventLog("All spell slots used", "status");
            }
        } else if (effectMessages.length > 0) {
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

    const handlePlayAgain = () => {
        resetGame();
        navigate("/game", {
            replace: true,
        });
    };

    const handleReturnHome = (selectedElement: RewardElement) => {
        addExperience(enemy.experience);
        addElement(selectedElement);
        navigate("/game", {
            replace: true,
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
                <div className="enemy-stage">
                <div
                    ref={enemySpriteRef}
                    className={`enemy-sprite-card ${isEnemySpriteFlashing ? "is-hit-flash" : ""}`}
                    style={{ ["--enemy-hit-flash" as string]: enemySpriteFlashColor }}
                >
                    <span className="enemy-sprite-hitbox">
                        <EnemyInfoSprite enemyName={enemy.name} spritePath={enemy.sprite ?? ""} />
                    </span>
                    {isEnemySteamVisible ? (
                        <span className="enemy-steam-pop" aria-hidden="true">
                            <span className="steam-cloud steam-cloud-one" />
                            <span className="steam-cloud steam-cloud-two" />
                            <span className="steam-cloud steam-cloud-three" />
                        </span>
                    ) : null}
                    {enemyDamagePopups.map((popup) => (
                        <span
                            key={popup.id}
                            className={`enemy-damage-popup ${popup.kind === "burn" ? "enemy-damage-popup--burn" : ""}`}
                            style={{ ["--popup-color" as string]: popup.color }}
                        >
                            {popup.text}
                        </span>
                    ))}
                    {enemyBurnStatus ? (
                        <span className="enemy-burn-indicator" aria-label={`Burn ${enemyBurnStatus.stacks}`}>
                            <span className="burn-icon" role="img" aria-hidden="true">🔥</span>
                            <span className="burn-stacks">{enemyBurnStatus.stacks}</span>
                            <span className="burn-tooltip">
                                <span>Burn Stacks: {enemyBurnStatus.stacks}</span>
                                <span>Expires in: {enemyBurnStatus.remainingTurns} turns</span>
                                <span>Damage: {enemyBurnStatus.stacks * BURN_DAMAGE_PER_STACK}</span>
                                <span>Triggers at the end of each turn</span>
                                
                            </span>
                        </span>
                    ) : null}
                    {enemySoakStatus ? (
                        <span className="enemy-soak-indicator" aria-label={`Soak ${enemySoakStatus.stacks}`}>
                            <span className="soak-icon" role="img" aria-hidden="true">💧</span>
                            <span className="soak-stacks">{enemySoakStatus.stacks}</span>
                            <span className="soak-tooltip">
                                Lightning +{enemySoakStatus.stacks * SOAK_LIGHTNING_BONUS_PER_STACK}. Fire -{enemySoakStatus.stacks * SOAK_FIRE_PENALTY_PER_STACK}
                            </span>
                        </span>
                    ) : null}
                    {enemyFreezeStatus ? (
                        <span className="enemy-freeze-indicator" aria-label={`Freeze ${enemyFreezeStatus.stacks}`}>
                            <span className="freeze-icon" role="img" aria-hidden="true">❄</span>
                            <span className="freeze-stacks">{enemyFreezeStatus.stacks}</span>
                            <span className="freeze-tooltip">
                                Fire gains +{enemyFreezeStatus.stacks * FREEZE_FIRE_BONUS_PER_STACK} damage
                            </span>
                        </span>
                    ) : null}
                    <div className="enemy-meta-tooltip" aria-hidden="true">
                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">HP</span>
                            <span className="enemy-meta-value">{enemyHealth} / {enemyMaxHp}</span>
                        </div>

                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">Weaknesses</span>
                            <div className="enemy-meta-chip-list">
                                {enemyWeaknesses.length > 0 ? (
                                    enemyWeaknesses.map((weakness) => (
                                        <span key={weakness} className={`enemy-meta-chip ${toTypeClass(weakness)}`}>
                                            {weakness}
                                        </span>
                                    ))
                                ) : (
                                    <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                )}
                            </div>
                        </div>

                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">Elements</span>
                            <div className="enemy-meta-chip-list">
                                {enemy.elements.length > 0 ? (
                                    enemy.elements.map((element, index) => (
                                        <span
                                            key={`${element.letter}-${element.damage}-${index}`}
                                            ref={(entry) => {
                                                enemyMetaElementRefs.current[index] = entry;
                                            }}
                                            className="enemy-meta-chip enemy-meta-chip-attack"
                                            onMouseEnter={() => setHoveredEnemyMetaElementIndex(index)}
                                            onMouseLeave={() => {
                                                setHoveredEnemyMetaElementIndex((current) => (current === index ? null : current));
                                            }}
                                        >
                                            <ElementIcon name={element.letter} /> ({element.damage})
                                        </span>
                                    ))
                                ) : (
                                    <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                )}
                            </div>
                        </div>

                        <div className="enemy-meta-footer">Rewards {enemy.experience} XP</div>
                    </div>
                </div>
                </div>{/* end .enemy-stage */}
                {hoveredEnemyMetaElementIndex !== null ? (() => {
                    const hoveredElement = enemy.elements[hoveredEnemyMetaElementIndex];
                    if (!hoveredElement) {
                        return null;
                    }
                    return (
                        <ElementDetailsTooltip
                            element={hoveredElement}
                            anchorElement={enemyMetaElementRefs.current[hoveredEnemyMetaElementIndex]}
                            open
                            className="reward-element-tooltip-shell"
                        />
                    );
                })() : null}
                {queuedEnemyAttack ? (
                    <ElementDetailsTooltip
                        element={queuedEnemyAttack}
                        anchorElement={enemyIntentIconRef.current ?? enemyAttackMarkerRef.current}
                        open={hoveredEnemyAttack && Boolean(enemyIntentIconRef.current ?? enemyAttackMarkerRef.current)}
                        className="reward-element-tooltip-shell"
                        clampHorizontal={false}
                    />
                ) : null}

                {/* Intent badge — always visible next to sprite */}
                <div
                    ref={enemyAttackMarkerRef}
                    className={`enemy-intent-badge ${queuedEnemyAttack ? "" : "is-hidden"} ${isReadyingNextAttack ? "is-readying" : ""}`}
                    aria-label={queuedEnemyAttack ? `Enemy intends to attack with ${queuedEnemyAttack.letter}` : "Enemy attack not yet queued"}
                    aria-hidden={!queuedEnemyAttack}
                    onMouseEnter={() => { if (queuedEnemyAttack) setHoveredEnemyAttack(true); }}
                    onMouseLeave={() => setHoveredEnemyAttack(false)}
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

            {/* ─── Energy Row ─── */}
            <div className="energy-row" aria-live="polite" aria-label={`Turn energy ${remainingEnergy} out of ${TURN_ENERGY}`}>
                <span className="energy-row-label">{isResolvingTurn ? "ENEMY TURN" : "YOUR TURN"}</span>
                <div className="energy-pips">
                    {Array.from({ length: TURN_ENERGY }).map((_, i) => (
                        <span
                            key={i}
                            className={`energy-pip ${i < remainingEnergy ? "is-active" : "is-spent"}`}
                            aria-hidden="true"
                        />
                    ))}
                </div>
                <span className="energy-row-count">{remainingEnergy}/{TURN_ENERGY}</span>
            </div>

            {/* ─── Spell Hand ─── */}
            <div className="spell-hand">
                <div className="spell-hand-scroll">
                    {player.elements.map((spell) => (
                        <button
                            key={spell.id}
                            ref={(element) => {
                                spellSlotRefs.current[spell.id] = element;
                            }}
                            type="button"
                            className={`spell-card ${flashingSlotId === spell.id ? "is-flashing" : ""} ${usedSpellIds.includes(spell.id) ? "is-used" : ""} ${(!usedSpellIds.includes(spell.id) && !isGameOver && !isResolvingTurn && remainingEnergy < getSpellEnergyCost(spell)) ? "is-unaffordable" : ""}`}
                            disabled={
                                usedSpellIds.includes(spell.id) ||
                                isGameOver ||
                                isResolvingTurn ||
                                remainingEnergy <= 0 ||
                                remainingEnergy < getSpellEnergyCost(spell)
                            }
                            style={getSpellSlotStyle(spell.type1, spell.type2)}
                            onMouseEnter={() => setHoveredSpellId(spell.id)}
                            onMouseLeave={() => setHoveredSpellId((current) => (current === spell.id ? null : current))}
                            onClick={(e) => {
                                launchProjectiles(
                                    { letter: spell.letter, effects: spell.effects },
                                    e.currentTarget as HTMLButtonElement,
                                );
                                handleSlotClick({
                                    id: spell.id,
                                    letter: spell.letter,
                                    damage: spell.damage,
                                    energy: spell.energy,
                                    type1: spell.type1,
                                    type2: spell.type2,
                                    effects: spell.effects,
                                });
                            }}
                            onAnimationEnd={() => handleFlashEnd(spell.id)}
                        >
                            <FloatingTooltip
                                anchorElement={spellSlotRefs.current[spell.id]}
                                open={hoveredSpellId === spell.id}
                                className="drag-description-popup"
                                clampHorizontal={false}
                                elementDetails={{
                                    letter: spell.letter,
                                    damage: spell.damage,
                                    energy: spell.energy,
                                    description: spell.description,
                                    type1: spell.type1,
                                    type2: spell.type2,
                                    effects: spell.effects,
                                    level: spell.level,
                                }}
                            />
                            <span className="spell-card-energy">{getSpellEnergyCost(spell)}</span>
                            <div className="spell-card-icon">
                                <ElementIcon name={spell.letter} />
                            </div>
                            <div className="spell-card-name">{spell.letter}</div>
                            <div className="spell-card-damage">{spell.damage}</div>
                        </button>
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
                    </div>
                </div>
                <div className="player-hud-center">
                    <div className="player-hp-row">
                        {playerShield > 0 ? (
                            <span className="player-shield-badge">
                                🛡 {playerShield}
                                <span className="player-shield-tooltip">You have {playerShield} shield</span>
                            </span>
                        ) : null}
                        <div
                            ref={playerHpBarRef}
                            className={`player-hp-bar ${playerShield > 0 ? "has-shield" : ""} ${isPlayerHealingFlash ? "is-healing" : ""} ${isPlayerShieldFlash ? "is-shield-gain" : ""}`}
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
            </div>{/* end .fight-arena */}

            <aside className="event-log-panel" aria-live="polite" aria-label="Fight event log">
                <h3 className="event-log-title">Battle Log</h3>
                <div className="event-log-list" ref={eventLogContainerRef}>
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
            {showRewardModal ? (
                <RewardModal
                    xpGained={enemy.experience}
                    currentXp={preRewardXp.current}
                    levels={levels}
                    rewardElements={rewardElements}
                    onConfirm={handleReturnHome}
                />
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
        </div>
    );
}

export default Fight;
