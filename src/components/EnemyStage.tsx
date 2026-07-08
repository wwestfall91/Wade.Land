import { useEffect, useRef, useState } from "react";
import EnemyInfoSprite from "./EnemyInfoSprite";
import ElementDetailsTooltip from "./ElementDetailsTooltip";
import ElementIcon from "./ElementIcon";
import "./EnemyStage.scss";
import type { RewardElement } from "../context/PlayerContext";
import type { ActiveBurnStatus, ActiveFreezeStatus, ActiveSoakStatus } from "../combat/spellEffects";
import {
    BURN_FIRE_BONUS_PERCENT_PER_STACK,
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
    enemyPower?: number;
    weaknesses: string[];
    elements: RewardElement[];
    souls: number;
    resistances?: Partial<Record<string, number>>;
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
    /** Freeze the sprite on its current frame (renders a canvas snapshot). */
    frozen?: boolean;
};

function EnemyStage({
    enemyName,
    spritePath,
    enemyHealth,
    enemyMaxHp,
    enemyPower,
    weaknesses,
    elements,
    souls,
    resistances,
    className,
    spriteRef,
    isHitFlashing = false,
    hitFlashColor = "rgba(255, 255, 255, 0.6)",
    isSteamVisible = false,
    damagePopups = [],
    burnStatus = null,
    soakStatus = null,
    freezeStatus = null,
    frozen = false,
}: EnemyStageProps) {
    const enemyHpFillPercent = Math.max(0, Math.min(100, (enemyHealth / Math.max(1, enemyMaxHp)) * 100));
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [isEnemyStageHovered, setIsEnemyStageHovered] = useState(false);
    const [hoveredElementIndex, setHoveredElementIndex] = useState<number | null>(null);
    const [isElementChipHovered, setIsElementChipHovered] = useState(false);
    const [isElementTooltipHovered, setIsElementTooltipHovered] = useState(false);
    const [isElementTooltipGraceOpen, setIsElementTooltipGraceOpen] = useState(false);
    const elementRefs = useRef<Record<number, HTMLSpanElement | null>>({});
    const elementTooltipGraceTimeoutRef = useRef<number | null>(null);

    const clearElementTooltipGraceTimeout = () => {
        if (elementTooltipGraceTimeoutRef.current !== null) {
            window.clearTimeout(elementTooltipGraceTimeoutRef.current);
            elementTooltipGraceTimeoutRef.current = null;
        }
    };

    const startElementTooltipGraceClose = () => {
        setIsElementTooltipGraceOpen(true);
        clearElementTooltipGraceTimeout();
        elementTooltipGraceTimeoutRef.current = window.setTimeout(() => {
            setIsElementTooltipGraceOpen(false);
            setHoveredElementIndex(null);
            elementTooltipGraceTimeoutRef.current = null;
        }, 250);
    };

    useEffect(() => () => {
        clearElementTooltipGraceTimeout();
    }, []);

    useEffect(() => {
        if (hoveredElementIndex === null) {
            return;
        }

        if (!elements[hoveredElementIndex]) {
            setHoveredElementIndex(null);
            setIsElementChipHovered(false);
            setIsElementTooltipHovered(false);
            setIsElementTooltipGraceOpen(false);
            clearElementTooltipGraceTimeout();
        }
    }, [elements, hoveredElementIndex]);

    const handleElementChipMouseEnter = (index: number) => {
        clearElementTooltipGraceTimeout();
        setIsElementTooltipGraceOpen(false);
        setHoveredElementIndex(index);
        setIsElementChipHovered(true);
    };

    const handleElementChipMouseLeave = () => {
        setIsElementChipHovered(false);
        startElementTooltipGraceClose();
    };

    const handleElementTooltipMouseEnter = () => {
        clearElementTooltipGraceTimeout();
        setIsElementTooltipGraceOpen(false);
        setIsElementTooltipHovered(true);
    };

    const handleElementTooltipMouseLeave = () => {
        setIsElementTooltipHovered(false);
        startElementTooltipGraceClose();
    };

    const isElementTooltipOpen =
        hoveredElementIndex !== null && (isElementChipHovered || isElementTooltipHovered || isElementTooltipGraceOpen);
    const isElementTooltipClosing = isElementTooltipGraceOpen && !isElementChipHovered && !isElementTooltipHovered;

    useEffect(() => {
        const stageElement = stageRef.current;
        const tooltipHostElement = stageElement?.closest(".game-enemy-card, .enemy-zone");
        if (!tooltipHostElement) {
            return;
        }

        const lockClassName = "is-enemy-sub-tooltip-active";
        const hoverClassName = "is-enemy-stage-hovered";
        if (isEnemyStageHovered) {
            tooltipHostElement.classList.add(hoverClassName);
        } else {
            tooltipHostElement.classList.remove(hoverClassName);
        }
        if (isElementTooltipOpen) {
            tooltipHostElement.classList.add(lockClassName);
        } else {
            tooltipHostElement.classList.remove(lockClassName);
        }

        return () => {
            tooltipHostElement.classList.remove(lockClassName);
            tooltipHostElement.classList.remove(hoverClassName);
        };
    }, [isElementTooltipOpen, isEnemyStageHovered]);

    return (
        <>
            <div
                ref={stageRef}
                className={`enemy-stage${className ? ` ${className}` : ""}`}
                onMouseEnter={() => {
                    setIsEnemyStageHovered(true);
                }}
                onMouseLeave={() => {
                    setIsEnemyStageHovered(false);
                }}
            >
                <div
                    ref={spriteRef}
                    className={`enemy-sprite-card ${isHitFlashing ? "is-hit-flash" : ""}`}
                    style={{ ["--enemy-hit-flash" as string]: hitFlashColor }}
                >
                    <span className="enemy-sprite-hitbox">
                        <EnemyInfoSprite enemyName={enemyName} spritePath={spritePath} frozen={frozen} />
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
                            <span className="enemy-effect-description enemy-effect-description--burn">
                                Fire +{burnStatus.stacks * BURN_FIRE_BONUS_PERCENT_PER_STACK}% | {burnStatus.remainingTurns} turns
                            </span>
                        </span>
                    ) : null}
                    {soakStatus ? (
                        <span className="enemy-soak-indicator" aria-label={`Soak ${soakStatus.stacks}`}>
                            <span className="soak-icon" role="img" aria-hidden="true">💧</span>
                            <span className="soak-stacks">{soakStatus.stacks}</span>
                            <span className="enemy-effect-description enemy-effect-description--soak">
                                Lightning +{soakStatus.stacks * SOAK_LIGHTNING_BONUS_PER_STACK}. Fire -{soakStatus.stacks * SOAK_FIRE_PENALTY_PER_STACK}
                            </span>
                        </span>
                    ) : null}
                    {freezeStatus ? (
                        <span className="enemy-freeze-indicator" aria-label={`Freeze ${freezeStatus.stacks}`}>
                            <span className="freeze-icon" role="img" aria-hidden="true">❄</span>
                            <span className="freeze-stacks">{freezeStatus.stacks}</span>
                            <span className="enemy-effect-description enemy-effect-description--freeze">
                                Fire gains +{freezeStatus.stacks * FREEZE_FIRE_BONUS_PER_STACK} damage
                            </span>
                        </span>
                    ) : null}
                    <div className="enemy-meta-tooltip" aria-hidden="true">
                        <div className="enemy-meta-section enemy-meta-section--hp">
                            <span className="enemy-meta-label">HP</span>
                            <div className="enemy-meta-hp-track" role="progressbar" aria-valuemin={0} aria-valuemax={enemyMaxHp} aria-valuenow={enemyHealth}>
                                <span className="enemy-meta-hp-fill" style={{ width: `${enemyHpFillPercent}%` }} />
                                <span className="enemy-meta-hp-text">{enemyHealth} / {enemyMaxHp}</span>
                            </div>
                        </div>
                        {(() => {
                            const vulnEntries = Object.entries(resistances ?? {})
                                .filter(([, v]) => (v as number) < 0)
                                .sort(([, a], [, b]) => (a as number) - (b as number));
                            const hasAny = weaknesses.length > 0 || vulnEntries.length > 0;
                            return (
                                <div className="enemy-meta-section">
                                    <span className="enemy-meta-label">Weaknesses</span>
                                    <div className="enemy-meta-chip-list">
                                        {hasAny ? (
                                            <>
                                                {weaknesses.map((w) => (
                                                    <span key={w} className="enemy-meta-icon-chip" aria-label={w} title={w}>
                                                        <ElementIcon name={w} />
                                                    </span>
                                                ))}
                                                {vulnEntries.map(([type, rawValue]) => (
                                                    <span
                                                        key={type}
                                                        className="enemy-meta-chip enemy-meta-chip-resist enemy-meta-chip-resist--weak"
                                                    >
                                                        <ElementIcon name={type} />
                                                        <span className="enemy-meta-resist-value">{Math.abs(rawValue as number)}%</span>
                                                    </span>
                                                ))}
                                            </>
                                        ) : (
                                            <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        {(() => {
                            const resistEntries = Object.entries(resistances ?? {})
                                .filter(([, v]) => (v as number) > 0)
                                .sort(([, a], [, b]) => (b as number) - (a as number));
                            return (
                                <div className="enemy-meta-section">
                                    <span className="enemy-meta-label">Resistances</span>
                                    <div className="enemy-meta-chip-list">
                                        {resistEntries.length > 0 ? resistEntries.map(([type, rawValue]) => (
                                            <span
                                                key={type}
                                                className="enemy-meta-chip enemy-meta-chip-resist"
                                            >
                                                <ElementIcon name={type} />
                                                <span className="enemy-meta-resist-value">{rawValue as number}%</span>
                                            </span>
                                        )) : (
                                            <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
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
                                            onMouseEnter={() => handleElementChipMouseEnter(index)}
                                            onMouseLeave={handleElementChipMouseLeave}
                                        >
                                            <ElementIcon name={element.letter} />
                                            <span className="enemy-meta-attack-value">{enemyPower ?? element.damage}</span>
                                        </span>
                                    ))
                                ) : (
                                    <span className="enemy-meta-chip enemy-meta-chip-muted">None</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isElementTooltipOpen && hoveredElementIndex !== null ? (() => {
                const hoveredElement = elements[hoveredElementIndex];
                if (!hoveredElement) return null;
                return (
                    <ElementDetailsTooltip
                        element={{
                            ...hoveredElement,
                            damage: enemyPower ?? hoveredElement.damage,
                        }}
                        anchorElement={elementRefs.current[hoveredElementIndex]}
                        open={isElementTooltipOpen}
                        className={`reward-element-tooltip-shell${isElementTooltipClosing ? " is-closing" : ""}`}
                        interactive
                        onTooltipMouseEnter={handleElementTooltipMouseEnter}
                        onTooltipMouseLeave={handleElementTooltipMouseLeave}
                    />
                );
            })() : null}
        </>
    );
}

export default EnemyStage;
