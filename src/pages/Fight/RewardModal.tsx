import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getEffectChipClass, getEffectSummaryLines } from "../../combat/effectSummary";
import { usePlayer, type LevelDefinition, type RewardElement } from "../../context/PlayerContext";
import FloatingTooltip from "../Game/FloatingTooltip";
import ElementIcon from "../../components/ElementIcon";
import "./RewardModal.scss";

type AnimSegment = {
    level: number;
    startFill: number;
    endFill: number;
    isLastSegment: boolean;
};

const computeAnimSegments = (
    startXp: number,
    gainedXp: number,
    levels: LevelDefinition[],
): AnimSegment[] => {
    if (levels.length === 0 || gainedXp <= 0) {
        return [{ level: 1, startFill: 0, endFill: 0, isLastSegment: true }];
    }

    const sortedLevels = [...levels].sort((a, b) => a.level - b.level);
    const endXp = startXp + gainedXp;
    const segments: AnimSegment[] = [];
    let xp = startXp;

    while (xp < endXp) {
        const currentLevel = sortedLevels.reduce(
            (cur, l) => (xp >= l.experience ? l : cur),
            sortedLevels[0],
        );
        const currentLevelIdx = sortedLevels.findIndex((l) => l.level === currentLevel.level);
        const nextLevel = sortedLevels[currentLevelIdx + 1];
        const levelStart = currentLevel.experience;
        const levelEnd = nextLevel?.experience ?? null;
        const levelRange = levelEnd !== null ? levelEnd - levelStart : null;

        if (levelRange === null) {
            segments.push({ level: currentLevel.level, startFill: 100, endFill: 100, isLastSegment: true });
            break;
        }

        const startFill = Math.min(100, Math.round(((xp - levelStart) / levelRange) * 100));

        if (nextLevel && endXp >= nextLevel.experience) {
            segments.push({ level: currentLevel.level, startFill, endFill: 100, isLastSegment: false });
            xp = nextLevel.experience;
        } else {
            const endFill = Math.min(100, Math.round(((endXp - levelStart) / levelRange) * 100));
            segments.push({ level: currentLevel.level, startFill, endFill, isLastSegment: true });
            break;
        }
    }

    return segments.length > 0 ? segments : [{ level: 1, startFill: 0, endFill: 0, isLastSegment: true }];
};

const XP_FILL_DURATION_MS = 900;
const LEVELUP_PAUSE_MS = 500;

type RewardModalProps = {
    xpGained: number;
    currentXp: number;
    levels: LevelDefinition[];
    rewardElements: RewardElement[];
    onConfirm: (element: RewardElement) => void;
};

function RewardModal({ xpGained, currentXp, levels, rewardElements, onConfirm }: RewardModalProps) {
    const { player } = usePlayer();
    const [selectedElement, setSelectedElement] = useState<RewardElement | null>(null);
    const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
    const [hoveredCurrentElementId, setHoveredCurrentElementId] = useState<number | null>(null);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const currentElementRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const [isClosing, setIsClosing] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);

    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const segments = useMemo(
        () => computeAnimSegments(currentXp, xpGained, levels),
        [currentXp, xpGained, levels],
    );

    const [segmentIndex, setSegmentIndex] = useState(0);
    const [displayLevel, setDisplayLevel] = useState(segments[0]?.level ?? 1);
    const [fillPercent, setFillPercent] = useState(segments[0]?.startFill ?? 0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const timeoutsRef = useRef<number[]>([]);

    const clearAllTimeouts = () => {
        timeoutsRef.current.forEach(window.clearTimeout);
        timeoutsRef.current = [];
    };

    const schedule = (fn: () => void, delay: number) => {
        const id = window.setTimeout(fn, delay);
        timeoutsRef.current.push(id);
        return id;
    };

    useEffect(() => {
        clearAllTimeouts();

        const currentSegment = segments[segmentIndex];
        if (!currentSegment) return;

        setIsTransitioning(false);
        setFillPercent(currentSegment.startFill);

        schedule(() => {
            setIsTransitioning(true);
            setFillPercent(currentSegment.endFill);
        }, 80);

        if (!currentSegment.isLastSegment) {
            schedule(() => {
                setShowLevelUp(true);
                schedule(() => {
                    setShowLevelUp(false);
                    setDisplayLevel((prev) => prev + 1);
                    setFillPercent(0);
                    setIsTransitioning(false);
                    schedule(() => {
                        const nextSegment = segments[segmentIndex + 1];
                        if (nextSegment) {
                            setIsTransitioning(true);
                            setFillPercent(nextSegment.endFill);
                            setSegmentIndex((prev) => prev + 1);
                        }
                    }, 80);
                }, LEVELUP_PAUSE_MS);
            }, 80 + XP_FILL_DURATION_MS + 200);
        }

        return clearAllTimeouts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segmentIndex]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            if (closeTimeoutRef.current !== null) {
                window.clearTimeout(closeTimeoutRef.current);
            }
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const handleConfirm = () => {
        if (!selectedElement || isClosing) {
            return;
        }

        setIsClosing(true);
        closeTimeoutRef.current = window.setTimeout(() => {
            onConfirm(selectedElement);
        }, 180);
    };

    const modal = (
        <>
            <div
                className={`reward-menu-overlay${isClosing ? " is-closing" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Reward selection"
            >
                <div className={`reward-menu${isClosing ? " is-closing" : ""}`}>
                    <div className="reward-xp-section">
                        <div className="reward-level-label">
                            Level {displayLevel}
                            {showLevelUp ? <span className="reward-levelup-flash"> LEVEL UP!</span> : null}
                        </div>
                        <div className="reward-xp-bar-track">
                            <div
                                className={`reward-xp-bar-fill${isTransitioning ? " is-transitioning" : ""}`}
                                style={{ width: `${fillPercent}%` }}
                            />
                        </div>
                        <div className="reward-xp-gained">+{xpGained} XP</div>
                    </div>
                    <h2 className="reward-title">Pick 1 Element!</h2>
                    <div className="reward-elements">
                        {rewardElements.map((element) => (
                            <button
                                key={element.letter}
                                ref={el => (buttonRefs.current[element.letter] = el)}
                                type="button"
                                className={`reward-element${selectedElement?.letter === element.letter ? " is-selected" : ""}`}
                                onClick={() => setSelectedElement(element)}
                                onMouseEnter={e => {
                                    setHoveredLetter(element.letter);
                                }}
                                onMouseLeave={() => {
                                    setHoveredLetter(current => (current === element.letter ? null : current));
                                }}
                            >
                                <span className="reward-element-letter"><ElementIcon name={element.letter} /></span>
                                <span className="reward-element-damage">{element.damage} DMG</span>
                            </button>
                        ))}
                    </div>
                    <section className="reward-current-elements" aria-label="Current spells">
                        <h3 className="reward-current-elements-title">Your Elements</h3>
                        <div className="reward-current-elements-list">
                            {player.elements.length > 0 ? (
                                player.elements.map((element) => (
                                    <div
                                        key={element.id}
                                        ref={(el) => {
                                            currentElementRefs.current[element.id] = el;
                                        }}
                                        className="reward-current-element"
                                        onMouseEnter={() => setHoveredCurrentElementId(element.id)}
                                        onMouseLeave={() => {
                                            setHoveredCurrentElementId((current) => (
                                                current === element.id ? null : current
                                            ));
                                        }}
                                    >
                                        <span className="reward-current-element-letter"><ElementIcon name={element.letter} /></span>
                                    </div>
                                ))
                            ) : (
                                <p className="reward-current-empty">Nothing.</p>
                            )}
                        </div>
                    </section>
                    

                    <button
                        type="button"
                        className="reward-return-button"
                        disabled={!selectedElement || isClosing}
                        onClick={handleConfirm}
                    >
                        CONTINUE
                    </button>
                </div>
            </div>
            {hoveredLetter ? (() => {
                const element = rewardElements.find(e => e.letter === hoveredLetter);
                if (!element) return null;

                const elementTypes = [element.type1, element.type2].filter(
                    (value): value is string => Boolean(value && value.trim().length > 0),
                );
                const effectLines = getEffectSummaryLines(element.effects);

                return (
                    <FloatingTooltip
                        anchorElement={buttonRefs.current[hoveredLetter]}
                        open={Boolean(hoveredLetter)}
                        className="reward-element-tooltip-shell"
                    >
                        <div className="reward-element-info">
                            {element.description.length > 0 ? (
                                <span className="element-info-description">{element.description}</span>
                            ) : null}
                            <span className="element-info-damage">Damage: {element.damage}</span>
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
                                        {effectLines.map((line, index) => (
                                            <span key={`${line}-${index}`} className={`effect-chip ${getEffectChipClass(line)}`}>
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
            {hoveredCurrentElementId !== null ? (() => {
                const element = player.elements.find((entry) => entry.id === hoveredCurrentElementId);
                if (!element) return null;

                const elementTypes = [element.type1, element.type2].filter(
                    (value): value is string => Boolean(value && value.trim().length > 0),
                );
                const effectLines = getEffectSummaryLines(element.effects);

                return (
                    <FloatingTooltip
                        anchorElement={currentElementRefs.current[hoveredCurrentElementId]}
                        open
                        className="reward-element-tooltip-shell"
                    >
                        <div className="reward-element-info">
                            {element.description.length > 0 ? (
                                <span className="element-info-description">{element.description}</span>
                            ) : null}
                            <span className="element-info-damage">Damage: {element.damage}</span>
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
                                        {effectLines.map((line, index) => (
                                            <span key={`${line}-${index}`} className={`effect-chip ${getEffectChipClass(line)}`}>
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
        </>
    );

    return createPortal(modal, document.body);
}

export default RewardModal;
