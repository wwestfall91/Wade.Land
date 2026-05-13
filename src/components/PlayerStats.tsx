import { type CSSProperties } from "react";
import "./PlayerStats.scss";

type PlayerStatsProps = {
    level: number;
    hp: number;
    experience: number;
    fillPercent?: number;
    className?: string;
};

function PlayerStats({
    level,
    hp,
    experience,
    fillPercent = 0,
    className,
}: PlayerStatsProps) {
    const normalizedFill = Math.max(0, Math.min(100, fillPercent));
    const style = { "--xp-fill": `${normalizedFill}%` } as CSSProperties;
    const classes = className ? `player-stats ${className}` : "player-stats";

    return (
        <div className={classes} style={style}>
            <div>Level {level}</div>
            <div>{hp} HP</div>
            <div>{experience} XP</div>
        </div>
    );
}

export default PlayerStats;
