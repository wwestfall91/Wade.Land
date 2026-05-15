import { useRef, useState } from "react";
import EnemyInfoSprite from "./EnemyInfoSprite";
import "./EnemyInfo.scss";
import type { RewardElement } from "../context/PlayerContext";
import { getEffectChipClass, getEffectSummaryLines } from "../combat/effectSummary";
import FloatingTooltip from "../pages/Game/FloatingTooltip";

type EnemyInfoProps = {
    enemyName: string;
    enemyHealth: number;
    enemyExperience: number;
    enemyDescription: string;
    enemyWeaknesses: string[];
    enemyElements: RewardElement[];
    enemySpritePath: string;
};

function EnemyInfo({
    enemyName,
    enemyHealth,
    enemyExperience,
    enemyDescription,
    enemyWeaknesses,
    enemyElements,
    enemySpritePath,
}: EnemyInfoProps) {
    const weaknesses = enemyWeaknesses.filter((value) => value.trim().length > 0);
    const [hoveredEnemyElementIndex, setHoveredEnemyElementIndex] = useState<number | null>(null);
    const enemyElementRefs = useRef<Record<number, HTMLSpanElement | null>>({});
    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    return (
        <div id="EnemyInfo">
            <div className="next-enemy-text">Next Enemy</div>
            <div className="enemy-info-header">
                <div className="enemy-info-name">{enemyName}</div>
            </div>
            <div className="enemy-info-sprite">
                <EnemyInfoSprite enemyName={enemyName} spritePath={enemySpritePath} />
            </div>
            <div className="enemy-info-health">Hover for details</div>
            <div className="enemy-info-description">
                {enemyDescription.length > 0 ? <div className="enemy-description-text">{enemyDescription}</div> : null}
                <div className="enemy-detail-row">
                    <span className="enemy-detail-label">HP</span>
                    <span className="enemy-detail-value">{enemyHealth}</span>
                </div>
                <div className="enemy-weakness-text">
                    <span className="enemy-weakness-label">Weaknesses:</span>
                    <span className="enemy-weakness-list">
                        {weaknesses.length > 0 ? (
                            weaknesses.map((weakness) => (
                                <span key={weakness} className="type-chip">
                                    {weakness}
                                </span>
                            ))
                        ) : (
                            <span className="type-chip">None</span>
                        )}
                    </span>
                </div>
                <div className="enemy-element-text">
                    <span className="enemy-element-label">Elements:</span>
                    <span className="enemy-element-list">
                        {enemyElements.length > 0 ? (
                            enemyElements.map((element, index) => (
                                <span
                                    key={`${element.letter}-${element.damage}-${index}`}
                                    ref={(entry) => {
                                        enemyElementRefs.current[index] = entry;
                                    }}
                                    className="type-chip type-chip-attack"
                                    onMouseEnter={() => setHoveredEnemyElementIndex(index)}
                                    onMouseLeave={() => {
                                        setHoveredEnemyElementIndex((current) => (current === index ? null : current));
                                    }}
                                >
                                    {element.letter} ({element.damage})
                                </span>
                            ))
                        ) : (
                            <span className="type-chip">None</span>
                        )}
                    </span>
                </div>
                <div className="enemy-xp-footer">Rewards {enemyExperience} XP</div>
            </div>
            {hoveredEnemyElementIndex !== null ? (() => {
                const hoveredElement = enemyElements[hoveredEnemyElementIndex];
                if (!hoveredElement) {
                    return null;
                }

                const elementTypes = [hoveredElement.type1, hoveredElement.type2].filter(
                    (value): value is string => Boolean(value && value.trim().length > 0),
                );
                const effectLines = getEffectSummaryLines(hoveredElement.effects);

                return (
                    <FloatingTooltip
                        anchorElement={enemyElementRefs.current[hoveredEnemyElementIndex]}
                        open={Boolean(enemyElementRefs.current[hoveredEnemyElementIndex])}
                        className="reward-element-tooltip-shell"
                    >
                        <div className="reward-element-info">
                            {hoveredElement.description.length > 0 ? (
                                <span className="element-info-description">{hoveredElement.description}</span>
                            ) : null}
                            <span className="element-info-damage">Damage: {hoveredElement.damage}</span>
                            <span className="element-info-types">
                                <span className="element-info-label">Types:</span>
                                <span className="element-info-list">
                                    {elementTypes.length > 0 ? (
                                        elementTypes.map((type) => (
                                            <span key={type} className={`type-chip ${toTypeClass(type)}`}>
                                                {type}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="type-chip type-none">None</span>
                                    )}
                                </span>
                            </span>
                            {effectLines.length > 0 ? (
                                <span className="element-info-effects">
                                    <span className="element-info-label">Effects:</span>
                                    <span className="element-info-list">
                                        {effectLines.map((line, lineIndex) => (
                                            <span key={`${line}-${lineIndex}`} className={`effect-chip ${getEffectChipClass(line)}`}>
                                                {line}
                                            </span>
                                        ))}
                                    </span>
                                </span>
                            ) : null}
                        </div>
                    </FloatingTooltip>
                );
            })() : null}
        </div>
    );
}

export default EnemyInfo;
