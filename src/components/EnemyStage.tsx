import { useRef, useState } from "react";
import EnemyInfoSprite from "./EnemyInfoSprite";
import ElementDetailsTooltip from "./ElementDetailsTooltip";
import ElementIcon from "./ElementIcon";
import soulIcon from "../assets/icons/Soul.png";
import "./EnemyStage.scss";
import type { RewardElement } from "../context/PlayerContext";
import type { ActiveBurnStatus, ActiveFreezeStatus, ActiveSoakStatus } from "../combat/spellEffects";
import {
    BURN_DAMAGE_PER_STACK,
    FREEZE_FIRE_BONUS_PER_STACK,
    SOAK_FIRE_PENALTY_PER_STACK,
    SOAK_LIGHTNING_BONUS_PER_STACK,
} from "../combat/statusMath";

export type EnemyDamagePopup = {
    id: number;
    text: string;
    color: string;
    kind?: "default" | "burn";
};

type EnemyStageProps = {
    enemyName: string;
    spritePath: string;
    enemyHealth: number;
    enemyMaxHp: number;
    weaknesses: string[];
    elements: RewardElement[];
    souls: number;
    className?: string;
    // fight-specific optional props
    spriteRef?: React.Ref<HTMLDivElement>;
    isHitFlashing?: boolean;
    hitFlashColor?: string;
    isSteamVisible?: boolean;
    damagePopups?: EnemyDamagePopup[];
    burnStatus?: ActiveBurnStatus | null;
    soakStatus?: ActiveSoakStatus | null;
    freezeStatus?: ActiveFreezeStatus | null;
};

const toTypeClass = (value: string) =>
    `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function EnemyStage({
    enemyName,
    spritePath,
    enemyHealth,
    enemyMaxHp,
    weaknesses,
    elements,
    souls,
    className,
    spriteRef,
    isHitFlashing = false,
    hitFlashColor = "rgba(255, 255, 255, 0.6)",
    isSteamVisible = false,
    damagePopups = [],
    burnStatus = null,
    soakStatus = null,
    freezeStatus = null,
}: EnemyStageProps) {
    const [hoveredElementIndex, setHoveredElementIndex] = useState<number | null>(null);
    const elementRefs = useRef<Record<number, HTMLSpanElement | null>>({});

    return (
        <>
            <div className={`enemy-stage${className ? ` ${className}` : ""}`}>
                <div
                    ref={spriteRef}
                    className={`enemy-sprite-card ${isHitFlashing ? "is-hit-flash" : ""}`}
                    style={{ ["--enemy-hit-flash" as string]: hitFlashColor }}
                >
                    <span className="enemy-sprite-hitbox">
                        <EnemyInfoSprite enemyName={enemyName} spritePath={spritePath} />
                    </span>
                    {isSteamVisible ? (
                        <span className="enemy-steam-pop" aria-hidden="true">
                            <span className="steam-cloud steam-cloud-one" />
                            <span className="steam-cloud steam-cloud-two" />
                            <span className="steam-cloud steam-cloud-three" />
                        </span>
                    ) : null}
                    {damagePopups.map((popup) => (
                        <span
                            key={popup.id}
                            className={`enemy-damage-popup ${popup.kind === "burn" ? "enemy-damage-popup--burn" : ""}`}
                            style={{ ["--popup-color" as string]: popup.color }}
                        >
                            {popup.text}
                        </span>
                    ))}
                    {burnStatus ? (
                        <span className="enemy-burn-indicator" aria-label={`Burn ${burnStatus.stacks}`}>
                            <span className="burn-icon" role="img" aria-hidden="true">🔥</span>
                            <span className="burn-stacks">{burnStatus.stacks}</span>
                            <span className="burn-tooltip">
                                <span>Burn Stacks: {burnStatus.stacks}</span>
                                <span>Expires in: {burnStatus.remainingTurns} turns</span>
                                <span>Damage: {burnStatus.stacks * BURN_DAMAGE_PER_STACK}</span>
                                <span>Triggers at the end of each turn</span>
                            </span>
                        </span>
                    ) : null}
                    {soakStatus ? (
                        <span className="enemy-soak-indicator" aria-label={`Soak ${soakStatus.stacks}`}>
                            <span className="soak-icon" role="img" aria-hidden="true">💧</span>
                            <span className="soak-stacks">{soakStatus.stacks}</span>
                            <span className="soak-tooltip">
                                Lightning +{soakStatus.stacks * SOAK_LIGHTNING_BONUS_PER_STACK}. Fire -{soakStatus.stacks * SOAK_FIRE_PENALTY_PER_STACK}
                            </span>
                        </span>
                    ) : null}
                    {freezeStatus ? (
                        <span className="enemy-freeze-indicator" aria-label={`Freeze ${freezeStatus.stacks}`}>
                            <span className="freeze-icon" role="img" aria-hidden="true">❄</span>
                            <span className="freeze-stacks">{freezeStatus.stacks}</span>
                            <span className="freeze-tooltip">
                                Fire gains +{freezeStatus.stacks * FREEZE_FIRE_BONUS_PER_STACK} damage
                            </span>
                        </span>
                    ) : null}
                    <div className="enemy-meta-tooltip" aria-hidden="true">
                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">HP</span>
                            <span className="enemy-meta-value">{enemyHealth} / {enemyMaxHp}</span>
                        </div>
                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">Weaknesses</span>
                            <div className="enemy-meta-chip-list">
                                {weaknesses.length > 0 ? (
                                    weaknesses.map((weakness) => (
                                        <span key={weakness} className={`enemy-meta-chip ${toTypeClass(weakness)}`}>
                                            {weakness}
                                        </span>
                                    ))
                                ) : (
                                    <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                )}
                            </div>
                        </div>
                        <div className="enemy-meta-section">
                            <span className="enemy-meta-label">Elements</span>
                            <div className="enemy-meta-chip-list">
                                {elements.length > 0 ? (
                                    elements.map((element, index) => (
                                        <span
                                            key={`${element.letter}-${element.damage}-${index}`}
                                            ref={(entry) => {
                                                elementRefs.current[index] = entry;
                                            }}
                                            className="enemy-meta-chip enemy-meta-chip-attack"
                                            onMouseEnter={() => setHoveredElementIndex(index)}
                                            onMouseLeave={() => {
                                                setHoveredElementIndex((current) => (current === index ? null : current));
                                            }}
                                        >
                                            <ElementIcon name={element.letter} /> ({element.damage})
                                        </span>
                                    ))
                                ) : (
                                    <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                )}
                            </div>
                        </div>
                        <div className="enemy-meta-footer">
                            <img src={soulIcon} alt="" aria-hidden="true" className="enemy-meta-souls-icon" />
                            <span>Rewards {souls} Souls</span>
                        </div>
                    </div>
                </div>
            </div>
            {hoveredElementIndex !== null ? (() => {
                const hoveredElement = elements[hoveredElementIndex];
                if (!hoveredElement) return null;
                return (
                    <ElementDetailsTooltip
                        element={hoveredElement}
                        anchorElement={elementRefs.current[hoveredElementIndex]}
                        open
                        className="reward-element-tooltip-shell"
                    />
                );
            })() : null}
        </>
    );
}

export default EnemyStage;
