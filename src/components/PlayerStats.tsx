import { type CSSProperties } from "react";
import "./PlayerStats.scss";
import { usePlayer } from "../context/PlayerContext";

type PlayerStatsProps = {
    level: number;
    hp: number;
    maxHp?: number;
    experience: number;
    fillPercent?: number;
    className?: string;
};

function PlayerStats({
    level,
    hp,
    maxHp,
    experience,
    fillPercent = 0,
    className,
}: PlayerStatsProps) {
    const { player, levels } = usePlayer();
    const normalizedFill = Math.max(0, Math.min(100, fillPercent));
    const playerMaxHp = levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1);
    const hpFillPercent = Math.max(0, Math.min(100, (hp / playerMaxHp) * 100));
    const style = {
        "--xp-fill": `${normalizedFill}%`,
        "--hp-fill": `${hpFillPercent}%`,
    } as CSSProperties;
    const classes = className ? `player-stats ${className}` : "player-stats";

    return (
        <div className={classes} style={style}>
            <div>Level {level}</div>
            <div className="player-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={playerMaxHp} aria-valuenow={hp}>
                <div className="player-hp-fill" />
                <span className="player-hp-label">{hp} / {playerMaxHp} HP</span>
            </div>
            <div>{experience} XP</div>
        </div>
    );
}

export default PlayerStats;
