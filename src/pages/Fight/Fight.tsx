import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import {
    getPerHitSpellEffects,
    getSpellHitCount,
    type ActiveBurnStatus,
    type ActiveSoakStatus,
    type SpellEffectConfig,
} from "../../combat/spellEffects";
import EnemyInfoSprite from "../../components/EnemyInfoSprite";
import { usePlayer, type RewardElement } from "../../context/PlayerContext";
import RewardModal from "./RewardModal";

type EnemyDamagePopup = {
    id: number;
    text: string;
    color: string;
};

type ActiveFreezeStatus = {
    kind: "freeze";
    stacks: number;
};

const HIT_FLASH_MS = 190;
const HIT_STEP_DELAY_MS = 120;
const EFFECT_STEP_DELAY_MS = 95;
const BURN_DAMAGE_PER_STACK = 5;
const SOAK_LIGHTNING_BONUS_PER_STACK = 3;
const SOAK_FIRE_PENALTY_PER_STACK = 3;
const FREEZE_FIRE_BONUS_PER_STACK = 10;

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
    power: number;
    experience: number;
    weaknesses?: string[];
    sprite?: string;
};

type FightLocationState = {
    enemy?: FightEnemy;
    elementPool?: RewardElement[];
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, levels, addExperience, addElement, applyEnemyAttack, healPlayer, resetGame } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [hoveredSpellId, setHoveredSpellId] = useState<number | null>(null);
    const [usedSpellIds, setUsedSpellIds] = useState<number[]>([]);
    const [turnMessage, setTurnMessage] = useState<string>("");
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPlayerHit, setIsPlayerHit] = useState(false);
    const [isScreenFlashing, setIsScreenFlashing] = useState(false);
    const [isSpellCastFlashing, setIsSpellCastFlashing] = useState(false);
    const [spellCastFlashBackground, setSpellCastFlashBackground] = useState<string>("rgba(255, 255, 255, 0.16)");
    const [isCritFlashing, setIsCritFlashing] = useState(false);
    const [isCritTextVisible, setIsCritTextVisible] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardElements, setRewardElements] = useState<RewardElement[]>([]);
    const [enemyBurnStatus, setEnemyBurnStatus] = useState<ActiveBurnStatus | null>(null);
    const [enemySoakStatus, setEnemySoakStatus] = useState<ActiveSoakStatus | null>(null);
    const [enemyFreezeStatus, setEnemyFreezeStatus] = useState<ActiveFreezeStatus | null>(null);
    const [playerShield, setPlayerShield] = useState(0);
    const [isResolvingTurn, setIsResolvingTurn] = useState(false);
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
    const healFlashTimeoutRef = useRef<number | null>(null);
    const shieldFlashTimeoutRef = useRef<number | null>(null);
    const playerHitTimeoutRef = useRef<number | null>(null);
    const screenFlashTimeoutRef = useRef<number | null>(null);
    const spellCastFlashTimeoutRef = useRef<number | null>(null);
    const enemySteamTimeoutRef = useRef<number | null>(null);

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, power: 0, experience: 0 };
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

    const triggerEnemyHitFeedback = (damage: number, flashColor: string) => {
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
                text: `-${damage}`,
                color: flashColor,
            },
        ]);

        window.setTimeout(() => {
            setEnemyDamagePopups((previous) => previous.filter((popup) => popup.id !== popupId));
        }, 480);
    };

    const getSpellTooltipLines = (spell: { damage: number; effects?: SpellEffectConfig[] }) => {
        const lines = [`Damage: ${spell.damage}`];
        const effects = spell.effects ?? [];

        const multiHit = effects.find((effect) => effect.kind === "multi_hit");
        if (multiHit?.hits && multiHit.hits > 1) {
            lines.push(`Hits: ${multiHit.hits}x`);
        }

        effects.forEach((effect) => {
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

    useEffect(() => {
        if (turnMessage.length === 0) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setTurnMessage("");
        }, 3000);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [turnMessage]);

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

    const triggerEnemyAttack = async () => {
        if (enemyHealth <= 0 || isGameOver) {
            return;
        }

        const turnMessages: string[] = [];
        let nextEnemyHealth = enemyHealth;

        if (enemyBurnStatus) {
            const burnDamage = Math.max(0, enemyBurnStatus.stacks * BURN_DAMAGE_PER_STACK);
            if (burnDamage > 0) {
                nextEnemyHealth = Math.max(0, nextEnemyHealth - burnDamage);
                setEnemyHealth(nextEnemyHealth);
                triggerEnemyHitFeedback(burnDamage, "#ff9b57");
                turnMessages.push(`Burn deals ${burnDamage} damage`);
                await wait(EFFECT_STEP_DELAY_MS);
            }

            const nextDuration = enemyBurnStatus.remainingTurns - 1;
            setEnemyBurnStatus(nextDuration > 0
                ? { ...enemyBurnStatus, remainingTurns: nextDuration }
                : null);

            if (nextEnemyHealth <= 0) {
                setTurnMessage(turnMessages.join(". "));
                return;
            }
        }

        const absorbedDamage = Math.min(playerShield, enemy.power);
        const remainingDamage = Math.max(0, enemy.power - absorbedDamage);

        if (absorbedDamage > 0) {
            setPlayerShield((previous) => Math.max(0, previous - absorbedDamage));
            turnMessages.push(`Shield blocks ${absorbedDamage}`);
            await wait(EFFECT_STEP_DELAY_MS);
        }

        applyEnemyAttack(remainingDamage);
        turnMessages.push(`Enemy attacks for ${remainingDamage} damage`);
        setTurnMessage(turnMessages.join(". "));
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
    };

    const handleEndTurn = async () => {
        if (enemyHealth <= 0 || isGameOver || isResolvingTurn) {
            return;
        }

        setIsResolvingTurn(true);
        await triggerEnemyAttack();
        setUsedSpellIds([]);
        setIsResolvingTurn(false);
    };

    const handleSlotClick = async (spell: { id: number; damage: number; type1?: string; type2?: string; effects?: SpellEffectConfig[] }) => {
        if (usedSpellIds.includes(spell.id) || enemyHealth <= 0 || isGameOver || isResolvingTurn) {
            return;
        }

        setIsResolvingTurn(true);

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
            const soakBonus = isLightningSpell ? remainingSoakStacks * SOAK_LIGHTNING_BONUS_PER_STACK : 0;
            const soakPenalty = isFireSpell ? remainingSoakStacks * SOAK_FIRE_PENALTY_PER_STACK : 0;
            const freezeBonus = isFireSpell ? remainingFreezeStacks * FREEZE_FIRE_BONUS_PER_STACK : 0;
            const baseHitDamage = Math.max(0, spell.damage + soakBonus - soakPenalty + freezeBonus);
            const hitDamage = isCritical ? baseHitDamage * 2 : baseHitDamage;
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

        const effectMessages: string[] = [];
        if (hitCount > 1) {
            effectMessages.push(`Hits ${hitCount}x`);
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
            effectMessages.push("Soak reset");
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
                setTurnMessage("All spell slots used");
            }
        } else if (effectMessages.length > 0) {
            setTurnMessage(effectMessages.join(". "));
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
            <div className="enemy">
                <div
                    className={`turn-message ${turnMessage.length > 0 ? "is-visible" : ""}`}
                    aria-live="polite"
                >
                    {turnMessage.length > 0 ? turnMessage : " "}
                </div>
                <span className="enemy-name">{enemy.name}</span>
                <div className="enemy-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={enemyMaxHp} aria-valuenow={enemyHealth}>
                    <div className="enemy-hp-fill" style={{ width: `${enemyHpFillPercent}%` }} />
                    <span className="enemy-hp-label">{enemyHealth} / {enemyMaxHp} HP</span>
                </div>
                <div
                    className={`enemy-sprite-card ${isEnemySpriteFlashing ? "is-hit-flash" : ""}`}
                    style={{ ["--enemy-hit-flash" as string]: enemySpriteFlashColor }}
                >
                    <EnemyInfoSprite enemyName={enemy.name} spritePath={enemy.sprite ?? ""} />
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
                            className="enemy-damage-popup"
                            style={{ ["--popup-color" as string]: popup.color }}
                        >
                            {popup.text}
                        </span>
                    ))}
                    {enemyBurnStatus ? (
                        <span className="enemy-burn-indicator" aria-label={`Burn ${enemyBurnStatus.stacks}`}>
                            <span className="burn-icon" role="img" aria-hidden="true">🔥</span>
                            <span className="burn-stacks">{enemyBurnStatus.stacks}</span>
                            <span className="burn-tooltip">Burn expires in {enemyBurnStatus.remainingTurns} turns</span>
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
                        <span>{enemy.power} POW</span>
                        <span>{enemy.experience} XP</span>
                    </div>
                </div>
            </div>
            <div className="spells">
                {player.elements.map((spell) => (
                    <button
                        key={spell.id}
                        type="button"
                        className={`spell-slot ${flashingSlotId === spell.id ? "is-flashing" : ""}`}
                        disabled={usedSpellIds.includes(spell.id) || isGameOver || isResolvingTurn}
                        style={getSpellSlotStyle(spell.type1, spell.type2)}
                        onMouseEnter={() => setHoveredSpellId(spell.id)}
                        onMouseLeave={() => setHoveredSpellId((current) => (current === spell.id ? null : current))}
                        onClick={() => handleSlotClick({
                            id: spell.id,
                            damage: spell.damage,
                            type1: spell.type1,
                            type2: spell.type2,
                            effects: spell.effects,
                        })}
                        onAnimationEnd={() => handleFlashEnd(spell.id)}
                    >
                        {hoveredSpellId === spell.id ? (
                            <span className="spell-hover-tooltip">
                                {getSpellTooltipLines(spell).map((line) => (
                                    <span key={line} className={`spell-hover-tooltip-line effect-chip ${getEffectChipClass(line)}`}>
                                        {line}
                                    </span>
                                ))}
                            </span>
                        ) : null}
                        <span>{spell.letter}</span>
                        <span>{spell.damage}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className="end-turn-button"
                    onClick={handleEndTurn}
                    disabled={isGameOver || enemyHealth <= 0 || isResolvingTurn}
                >
                    End Turn
                </button>
            </div>
            <div className="player-hp-wrap">
                {playerShield > 0 ? (
                    <span className="player-shield-badge">
                        {playerShield}
                        <span className="player-shield-tooltip">You have {playerShield} shield</span>
                    </span>
                ) : null}
                <div
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
        </div>
    );
}

export default Fight;
