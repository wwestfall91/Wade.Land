import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import "./Fight.scss";

type FightSpell = {
    id: number;
    letter: string;
    damage: number;
};

type FightEnemy = {
    name: string;
    hp: number;
    experience: number;
};

type FightPlayer = {
    level: number;
    hp: number;
    experience: number;
};

type FightLocationState = {
    spells?: FightSpell[];
    enemy?: FightEnemy;
    player?: FightPlayer;
};

function Fight() {
    const location = useLocation();
    const navigate = useNavigate();
    const [flashingSlotId, setFlashingSlotId] = useState<number | null>(null);

    const { spells, enemy, player } = useMemo(() => {
        const state = location.state as FightLocationState | null;
        return {
            spells: state?.spells ?? [],
            enemy: state?.enemy ?? { name: "Unknown", hp: 0, experience: 0 },
            player: state?.player ?? { level: 1, hp: 0, experience: 0 },
        };
    }, [location.state]);

    const [enemyHealth, setEnemyHealth] = useState(() => enemy.hp);

    useEffect(() => {
        if (enemyHealth <= 0) {
            navigate("/game", {
                state: {
                    playerExperience: player.experience + enemy.experience,
                    restoredSpells: spells,
                },
            });
        }
    }, [enemy.experience, enemyHealth, navigate, player.experience, spells]);

    const handleSlotClick = (spell: FightSpell) => {
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
            <div className="player">
                <span className="player-level">Level {player.level}</span>
                <span className="player-hp">{player.hp} HP</span>
                <span className="player-experience">{player.experience} XP</span>
            </div>

            <div className="enemy">
                <span className="enemy-name">{enemy.name}</span>
                <span className="enemy-hp">{enemyHealth} HP</span>
                <span className="enemy-experience">{enemy.experience} XP</span>
            </div>
            <div className="spells">
                {spells.map((spell) => (
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
        </div>
    );
}

export default Fight;
