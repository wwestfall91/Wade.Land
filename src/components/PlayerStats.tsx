import React, { type CSSProperties } from "react";
import "./PlayerStats.scss";
import { usePlayer, type PlayerStatuses } from "../context/PlayerContext";
import soulIcon from "../assets/icons/Soul.png";
import potionIcon from "../assets/icons/Potion.png";
import energizeIcon from "../assets/icons/Energize.png";
import {
    BURN_DAMAGE_PER_STACK,
    FREEZE_FIRE_BONUS_PER_STACK,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
} from "../combat/statusMath";

type PlayerStatsProps = {
    playerName?: string;
    level: number;
    hp: number;
    maxHp?: number;
    souls: number;
    potionCount: number;
    potionFillPercent: number;
    onPotionClick?: () => void;
    isPotionUnavailableFeedback?: boolean;
    isPotionBrewedFlash?: boolean;
    statuses?: PlayerStatuses | null;
    className?: string;
};

function PlayerStats({
    playerName,
    level,
    hp,
    maxHp,
    souls,
    potionCount,
    potionFillPercent,
    onPotionClick,
    isPotionUnavailableFeedback,
    isPotionBrewedFlash,
    statuses,
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
                    <button
                        type="button"
                        className={`player-potion-panel${isPotionUnavailableFeedback ? " is-unavailable" : ""}${isPotionBrewedFlash ? " is-brew-flash" : ""}`}
                        aria-label={`Potions ${potionCount}. Potion charge ${Math.round(potionFillPercent)} percent`}
                        title={potionCount > 0 ? "Use potion to restore full health" : "Create Water-type elements to brew a potion"}
                        onClick={onPotionClick}
                        style={{ "--potion-fill": `${Math.max(0, Math.min(100, potionFillPercent))}%` } as React.CSSProperties}
                    >
                        <img src={potionIcon} alt="" aria-hidden="true" className="player-potion-icon" />
                        <div className="player-potion-copy">
                            <span className="player-potion-label">POTION</span>
                            <span className="player-potion-count">{potionCount}</span>
                        </div>
                    </button>
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
            {statuses && (statuses.burn || statuses.soak || statuses.freeze || statuses.energize || statuses.shield > 0) ? (
                <div className="player-status-strip" aria-label="Active status effects">
                    {statuses.burn ? (
                        <span className="player-status-badge player-status-badge--burn" aria-label={`Burn ${statuses.burn.stacks}`}>
                            <span className="player-status-icon" aria-hidden="true">🔥</span>
                            <span className="player-status-count">{statuses.burn.stacks}</span>
                            <span className="player-status-tooltip">
                                <span>Burn Stacks: {statuses.burn.stacks}</span>
                                <span>Expires in: {statuses.burn.remainingTurns} turns</span>
                                <span>Damage: {statuses.burn.stacks * BURN_DAMAGE_PER_STACK}</span>
                            </span>
                        </span>
                    ) : null}
                    {statuses.soak ? (
                        <span className="player-status-badge player-status-badge--soak" aria-label={`Soak ${statuses.soak.stacks}`}>
                            <span className="player-status-icon" aria-hidden="true">💧</span>
                            <span className="player-status-count">{statuses.soak.stacks}</span>
                            <span className="player-status-tooltip">
                                <span>Soak Stacks: {statuses.soak.stacks}</span>
                                <span>Lightning +{statuses.soak.stacks * SOAK_LIGHTNING_BONUS_PER_STACK}</span>
                                <span>Fire -{statuses.soak.stacks * SOAK_FIRE_PENALTY_PER_STACK}</span>
                            </span>
                        </span>
                    ) : null}
                    {statuses.freeze ? (
                        <span className="player-status-badge player-status-badge--freeze" aria-label={`Freeze ${statuses.freeze.stacks}`}>
                            <span className="player-status-icon" aria-hidden="true">❄</span>
                            <span className="player-status-count">{statuses.freeze.stacks}</span>
                            <span className="player-status-tooltip">
                                <span>Freeze Stacks: {statuses.freeze.stacks}</span>
                                <span>Fire gains +{statuses.freeze.stacks * FREEZE_FIRE_BONUS_PER_STACK} damage</span>
                            </span>
                        </span>
                    ) : null}
                    {statuses.energize ? (
                        <span className="player-status-badge player-status-badge--energize" aria-label={`Energize ${statuses.energize.stacks}`}>
                            <span className="player-status-icon" aria-hidden="true"><img src={energizeIcon} alt="" style={{ width: "0.85rem", height: "0.85rem", objectFit: "contain" }} /></span>
                            <span className="player-status-count">{statuses.energize.stacks}</span>
                            <span className="player-status-tooltip">
                                <span>Energize Stacks: {statuses.energize.stacks}</span>
                                <span>Next turn: +{statuses.energize.stacks} energy</span>
                            </span>
                        </span>
                    ) : null}
                    {statuses.shield > 0 ? (
                        <span className="player-status-badge player-status-badge--shield" aria-label={`Shield ${statuses.shield}`}>
                            <span className="player-status-icon" aria-hidden="true">🛡</span>
                            <span className="player-status-count">{statuses.shield}</span>
                            <span className="player-status-tooltip">
                                <span>Shield: {statuses.shield}</span>
                            </span>
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default PlayerStats;
