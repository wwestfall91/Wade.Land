import { type CSSProperties } from "react";
import "./PlayerStats.scss";

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
    const normalizedFill = Math.max(0, Math.min(100, fillPercent));
    const resolvedMaxHp = Math.max(1, maxHp ?? hp);
    const hpFillPercent = Math.max(0, Math.min(100, (hp / resolvedMaxHp) * 100));
    const style = {
        "--xp-fill": `${normalizedFill}%`,
        "--hp-fill": `${hpFillPercent}%`,
    } as CSSProperties;
    const classes = className ? `player-stats ${className}` : "player-stats";

    return (
        <div className={classes} style={style}>
            <div>Level {level}</div>
            <div className="player-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={resolvedMaxHp} aria-valuenow={hp}>
                <div className="player-hp-fill" />
                <span className="player-hp-label">{hp} / {resolvedMaxHp} HP</span>
            </div>
            <div>{experience} XP</div>
        </div>
    );
}

export default PlayerStats;
