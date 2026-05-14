import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import PlayerStats from "../../components/PlayerStats";
import { usePlayer, type RewardElement } from "../../context/PlayerContext";
import RewardModal from "./RewardModal";

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
};

type FightLocationState = {
    enemy?: FightEnemy;
    elementPool?: RewardElement[];
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, levelFillPercent, levels, addExperience, addElement, applyEnemyAttack, resetGame } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [hoveredSpellId, setHoveredSpellId] = useState<number | null>(null);
    const [usedSpellIds, setUsedSpellIds] = useState<number[]>([]);
    const [turnMessage, setTurnMessage] = useState<string>("");
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPlayerHit, setIsPlayerHit] = useState(false);
    const [isScreenFlashing, setIsScreenFlashing] = useState(false);
    const [isCritFlashing, setIsCritFlashing] = useState(false);
    const [isCritTextVisible, setIsCritTextVisible] = useState(false);
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardElements, setRewardElements] = useState<RewardElement[]>([]);
    const preRewardXp = useRef(player.experience);
    const hasResolvedVictory = useRef(false);
    const playerHitTimeoutRef = useRef<number | null>(null);
    const screenFlashTimeoutRef = useRef<number | null>(null);

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, power: 0, experience: 0 };
    }, [location.state]);

    const elementPool = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.elementPool ?? [];
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);

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
            if (playerHitTimeoutRef.current !== null) {
                window.clearTimeout(playerHitTimeoutRef.current);
            }
            if (screenFlashTimeoutRef.current !== null) {
                window.clearTimeout(screenFlashTimeoutRef.current);
            }
        };
    }, []);

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

    const triggerEnemyAttack = () => {
        if (enemyHealth <= 0 || isGameOver) {
            return;
        }

        applyEnemyAttack(enemy.power);
        setTurnMessage(`attacks for ${enemy.power} damage`);
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

    const handleEndTurn = () => {
        if (enemyHealth <= 0 || isGameOver) {
            return;
        }

        triggerEnemyAttack();
        setUsedSpellIds([]);
    };

    const handleSlotClick = (spell: { id: number; damage: number; type1?: string; type2?: string }) => {
        if (usedSpellIds.includes(spell.id) || enemyHealth <= 0 || isGameOver) {
            return;
        }

        setFlashingSlotId(spell.id);
        // Determine if this is a critical hit
        const spellTypes = [spell.type1, spell.type2].map(normalizeType).filter(Boolean);
        const enemyWeaknesses = (enemy.weaknesses ?? []).map(normalizeType).filter(Boolean);
        const isCritical = spellTypes.some((type) => enemyWeaknesses.includes(type));
        const critDamage = isCritical ? spell.damage * 2 : spell.damage;
        const nextEnemyHealth = Math.max(0, enemyHealth - critDamage);
        setEnemyHealth(nextEnemyHealth);

        if (isCritical) {
            setIsCritFlashing(false);
            setIsCritTextVisible(false);
            window.requestAnimationFrame(() => {
                setIsCritFlashing(true);
                setIsCritTextVisible(true);
                setTimeout(() => setIsCritFlashing(false), 320);
                setTimeout(() => setIsCritTextVisible(false), 520);
            });
        }

        setUsedSpellIds((previous) => {
            if (previous.includes(spell.id)) {
                return previous;
            }

            const next = [...previous, spell.id];
            const isTurnOver = next.length >= player.elements.length;

            if (isTurnOver) {
                if (nextEnemyHealth > 0) {
                    setTurnMessage("All spell slots used. End your turn.");
                }
                return next;
            }

            return next;
        });
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
            {isScreenFlashing ? <div className="screen-hit-flash" /> : null}
            {isCritFlashing ? <div className="screen-crit-flash" /> : null}
            {isCritTextVisible ? <div className="crit-text">CRITICAL!</div> : null}
            <div className="enemy">
                <span className="enemy-name">{enemy.name}</span>
                <span className="enemy-hp">{enemyHealth} HP</span>
                <span className="enemy-power">{enemy.power} POW</span>
                <span className="enemy-experience">{enemy.experience} XP</span>
            </div>
            {turnMessage.length > 0 ? <div className="turn-message">{turnMessage}</div> : null}
            <div className="spells">
                {player.elements.map((spell) => (
                    <button
                        key={spell.id}
                        type="button"
                        className={`spell-slot ${flashingSlotId === spell.id ? "is-flashing" : ""}`}
                        disabled={usedSpellIds.includes(spell.id) || isGameOver}
                        style={getSpellSlotStyle(spell.type1, spell.type2)}
                        onMouseEnter={() => setHoveredSpellId(spell.id)}
                        onMouseLeave={() => setHoveredSpellId((current) => (current === spell.id ? null : current))}
                        onClick={() => handleSlotClick({
                            id: spell.id,
                            damage: spell.damage,
                            type1: spell.type1,
                            type2: spell.type2,
                        })}
                        onAnimationEnd={() => handleFlashEnd(spell.id)}
                    >
                        {hoveredSpellId === spell.id ? (
                            <span className="spell-hover-tooltip">Damage: {spell.damage}</span>
                        ) : null}
                        <span>{spell.letter}</span>
                        <span>{spell.damage}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className="end-turn-button"
                    onClick={handleEndTurn}
                    disabled={isGameOver || enemyHealth <= 0}
                >
                    End Turn
                </button>
            </div>

            <PlayerStats
                level={player.level}
                hp={player.hp}
                experience={player.experience}
                fillPercent={levelFillPercent}
                className={isPlayerHit ? "is-hit" : undefined}
            />
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
