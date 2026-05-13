import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";
import PlayerStats from "../../components/PlayerStats";
import { usePlayer } from "../../context/PlayerContext";

type FightEnemy = {
    name: string;
    hp: number;
    experience: number;
};

type FightLocationState = {
    enemy?: FightEnemy;
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const { player, levelFillPercent, addExperience } = usePlayer();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);
    const hasResolvedVictory = useRef(false);

    const enemy = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return state?.enemy ?? { name: "Unknown", hp: 0, experience: 0 };
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);

    useEffect(() => {
        if (enemyHealth <= 0 && !hasResolvedVictory.current) {
            hasResolvedVictory.current = true;
            addExperience(enemy.experience);
            navigate("/game", {
                replace: true,
            });
        }
    }, [addExperience, enemy.experience, enemyHealth, navigate]);

    const handleSlotClick = (spell: { id: number; damage: number }) => {
        setFlashingSlotId(spell.id);
        setEnemyHealth((previousHealth) => Math.max(0, previousHealth - spell.damage));
    };

    const handleFlashEnd = (slotId: number) => {
        if (flashingSlotId === slotId) {
            setFlashingSlotId(null);
        }
    };

    return (
        <div id="Fight">
            <div className="enemy">
                <span className="enemy-name">{enemy.name}</span>
                <span className="enemy-hp">{enemyHealth} HP</span>
                <span className="enemy-experience">{enemy.experience} XP</span>
            </div>
            <div className="spells">
                {player.elements.map((spell) => (
                    <button
                        key={spell.id}
                        type="button"
                        className={`spell-slot ${flashingSlotId === spell.id ? "is-flashing" : ""}`}
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
            />
        </div>
    );
}

export default Fight;
