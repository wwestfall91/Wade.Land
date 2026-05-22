import { type CSSProperties } from "react";
import "./PlayerStats.scss";
import { usePlayer } from "../context/PlayerContext";
import soulIcon from "../assets/icons/Soul.png";

type PlayerStatsProps = {
    playerName?: string;
    level: number;
    hp: number;
    maxHp?: number;
    souls: number;
    className?: string;
};

function PlayerStats({
    playerName,
    level,
    hp,
    maxHp,
    souls,
    className,
}: PlayerStatsProps) {
    const { player, levels } = usePlayer();
    const playerMaxHp = levels.find((levelDef) => levelDef.level === player.level)?.hp ?? Math.max(player.hp, 1);
    const hpFillPercent = Math.max(0, Math.min(100, (hp / playerMaxHp) * 100));
    const style = {
        "--hp-fill": `${hpFillPercent}%`,
    } as CSSProperties;
    const classes = className ? `player-stats ${className}` : "player-stats";

    return (
        <div className={classes} style={style}>
            <div className="player-stats-top">
                <div className="player-identity">
                    <span className="player-name-text">{playerName?.trim().length ? playerName.trim() : "Player"}</span>
                </div>
                <div className="player-resource-group">
                    <div className="player-level-panel" aria-label={`Level ${level}`} title={`Current Level ${level}`}>
                        <span className="player-level-label">LV</span>
                        <span className="player-level-value">{level}</span>
                    </div>
                <div className="player-souls-panel" aria-label={`Souls ${souls}`} title="Souls are earned from victories and persist between battles.">
                    <img src={soulIcon} alt="" aria-hidden="true" className="player-souls-icon" />
                    <div className="player-souls-copy">
                        <span className="player-souls-label">SOULS</span>
                        <span className="player-souls-value">{souls}</span>
                    </div>
                </div>
                </div>
            </div>

            <div className="player-hp-section">
                <div className="player-hp-header">
                    <span className="player-hp-label">HEALTH</span>
                    <span className="player-hp-value">{hp}/{playerMaxHp}</span>
                </div>
                <div className="player-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={playerMaxHp} aria-valuenow={hp}>
                    <div className="player-hp-fill" />
                </div>
            </div>
        </div>
    );
}

export default PlayerStats;
