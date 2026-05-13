import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import PlayerStats from "../../components/PlayerStats";
import { usePlayer } from "../../context/PlayerContext";

type FightEnemy = {
    name: string;
    hp: number;
    power: number;
    experience: number;
};

type FightLocationState = {
    enemy?: FightEnemy;
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, levelFillPercent, levels, addExperience, applyEnemyAttack, resetGame } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const [usedSpellIds, setUsedSpellIds] = useState<number[]>([]);
    const [turnMessage, setTurnMessage] = useState<string>("");
    const [isGameOver, setIsGameOver] = useState(false);
    const [isPlayerHit, setIsPlayerHit] = useState(false);
    const [isScreenFlashing, setIsScreenFlashing] = useState(false);
    const hasResolvedVictory = useRef(false);
    const playerHitTimeoutRef = useRef<number | null>(null);
    const screenFlashTimeoutRef = useRef<number | null>(null);

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, power: 0, experience: 0 };
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);

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
            addExperience(enemy.experience);
            navigate("/game", {
                replace: true,
            });
        }
    }, [addExperience, enemy.experience, enemyHealth, navigate]);

    useEffect(() => {
        if (levels.length === 0 || enemyHealth <= 0 || player.hp > 0) {
            return;
        }

        setIsGameOver(true);
    }, [enemyHealth, levels.length, player.hp]);

    const handleSlotClick = (spell: { id: number; damage: number }) => {
        if (usedSpellIds.includes(spell.id) || enemyHealth <= 0 || isGameOver) {
            return;
        }

        setFlashingSlotId(spell.id);
        const nextEnemyHealth = Math.max(0, enemyHealth - spell.damage);
        setEnemyHealth(nextEnemyHealth);

        setUsedSpellIds((previous) => {
            if (previous.includes(spell.id)) {
                return previous;
            }

            const next = [...previous, spell.id];
            const isTurnOver = next.length >= player.elements.length;

            if (isTurnOver) {
                if (nextEnemyHealth > 0) {
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
                }
                return [];
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

    return (
        <div id="Fight" className={isScreenFlashing ? "is-screen-shaking" : undefined}>
            {isScreenFlashing ? <div className="screen-hit-flash" /> : null}
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
                        onClick={() => handleSlotClick(spell)}
                        onAnimationEnd={() => handleFlashEnd(spell.id)}
                    >
                        <span>{spell.letter}</span>
                        <span>{spell.damage}</span>
                    </button>
                ))}
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
        </div>
    );
}

export default Fight;
