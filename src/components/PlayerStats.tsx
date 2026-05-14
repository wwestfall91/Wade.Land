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
    const activeLevelDef = levels.find((levelDef) => levelDef.level === level) ?? levels[0];
    const nextLevelDef = levels.find((levelDef) => levelDef.level > level);
    const playerMaxHp = levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1);
    const hpFillPercent = Math.max(0, Math.min(100, (hp / playerMaxHp) * 100));
    const levelStartExperience = activeLevelDef?.experience ?? 0;
    const requiredExperienceForNextLevel = nextLevelDef
        ? Math.max(1, nextLevelDef.experience - levelStartExperience)
        : 1;
    const currentExperienceForLevel = nextLevelDef
        ? Math.max(0, Math.min(requiredExperienceForNextLevel, experience - levelStartExperience))
        : requiredExperienceForNextLevel;
    const style = {
        "--xp-fill": `${normalizedFill}%`,
        "--hp-fill": `${hpFillPercent}%`,
    } as CSSProperties;
    const classes = className ? `player-stats ${className}` : "player-stats";

    return (
        <div className={classes} style={style}>
            <div className="player-stats-row player-stats-row--level">
                Level
                <span className="player-level-tooltip" role="tooltip">
                    Level {level} ({currentExperienceForLevel}/{requiredExperienceForNextLevel} XP)
                </span>
            </div>
            <div className="player-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={playerMaxHp} aria-valuenow={hp}>
                <div className="player-hp-fill" />
                <span className="player-hp-overlay">
                    <span className="player-hp-overlay-label">Health</span>
                    <span className="player-hp-overlay-value">{hp}/{playerMaxHp}</span>
                </span>
            </div>
        </div>
    );
}

export default PlayerStats;
