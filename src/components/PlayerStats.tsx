import { type CSSProperties } from "react";
import "./PlayerStats.scss";
import { usePlayer, type PlayerStatuses } from "../context/PlayerContext";
import ElementIcon from "./ElementIcon";
import soulIcon from "../assets/icons/Soul.png";
import energizeIcon from "../assets/icons/Energize.png";
import {
    BURN_FIRE_BONUS_PERCENT_PER_STACK,
    FREEZE_FIRE_BONUS_PER_STACK,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
} from "../combat/statusMath";

const RESISTANCE_ORDER = ["fire", "water", "earth", "air"] as const;

type PlayerStatsProps = {
    playerName?: string;
    level: number;
    hp: number;
    maxHp?: number;
    souls: number;
    statuses?: PlayerStatuses | null;
    className?: string;
};

const PLAYER_BASE_HP = 100;

function PlayerStats({
    playerName,
    level,
    hp,
    maxHp,
    souls,
    statuses,
    className,
}: PlayerStatsProps) {
    const { maxHpMultiplier, permanentMaxHpReduction, elementalResistances } = usePlayer();
    const computedMaxHp = Math.max(1, Math.round(PLAYER_BASE_HP * maxHpMultiplier) - permanentMaxHpReduction);
    const playerMaxHp = Math.max(1, maxHp ?? computedMaxHp);
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
                    {/* <div className="player-souls-panel" aria-label={`Souls ${souls}`} title="Souls are earned from victories and persist between battles.">
                        <img src={soulIcon} alt="" aria-hidden="true" className="player-souls-icon" />
                        <div className="player-souls-copy">
                            <span className="player-souls-label">SOULS</span>
                            <span className="player-souls-value">{souls}</span>
                        </div>
                    </div> */}
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

            <div className="player-resistance-section" aria-label="Elemental resistances">
                <div className="player-resistance-header">
                    <span className="player-resistance-title">RESISTANCES</span>
                </div>
                <div className="player-resistances" aria-label="Elemental resistances">
                    {RESISTANCE_ORDER.map((element) => {
                        const value = elementalResistances[element] ?? 0;
                        const normalizedValue = Number.isFinite(value) ? Math.round(value) : 0;
                        const resistanceClass = normalizedValue > 0
                            ? "is-positive"
                            : normalizedValue < 0
                                ? "is-negative"
                                : "is-neutral";
                        const prefix = normalizedValue > 0 ? "+" : "";

                        return (
                            <div key={element} className={`player-resistance-item player-resistance-item--${element}`}>
                                <ElementIcon name={element} className="player-resistance-icon" />
                                <span className={`player-resistance-value ${resistanceClass}`}>{`${prefix}${normalizedValue}%`}</span>
                                <span className="player-resistance-tooltip">
                                    {normalizedValue >= 0
                                        ? `Reduce ${element.charAt(0).toUpperCase() + element.slice(1)} damage by ${normalizedValue}%`
                                        : `Take ${Math.abs(normalizedValue)}% more ${element.charAt(0).toUpperCase() + element.slice(1)} damage`}
                                </span>
                            </div>
                        );
                    })}
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
                                <span>Fire bonus: {statuses.burn.stacks * BURN_FIRE_BONUS_PERCENT_PER_STACK}%</span>
                                <span>Boosts fire attacks while it lasts</span>
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
