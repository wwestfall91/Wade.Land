import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelDefinition, RewardElement } from "../../context/PlayerContext";
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
    const [selectedElement, setSelectedElement] = useState<RewardElement>(rewardElements[0]);

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

    return (
        <div className="reward-menu-overlay">
            <div className="reward-menu">
                <h2 className="reward-title">Choose your reward!</h2>

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

                <div className="reward-elements">
                    {rewardElements.map((element) => (
                        <button
                            key={element.letter}
                            type="button"
                            className={`reward-element${selectedElement?.letter === element.letter ? " is-selected" : ""}`}
                            onClick={() => setSelectedElement(element)}
                        >
                            <span className="reward-element-letter">{element.letter}</span>
                            <span className="reward-element-damage">{element.damage} DMG</span>
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    className="reward-return-button"
                    onClick={() => onConfirm(selectedElement)}
                >
                    Return Home
                </button>
            </div>
        </div>
    );
}

export default RewardModal;
