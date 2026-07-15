import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ElementIcon from "../../components/ElementIcon";
import { ELEMENT_SPELL_COLORS } from "../../styles/elementThemes";
import "./ExpResultsModal.scss";

export type ExpSegment = {
    /** Starting fill % (0-100) for this bar. 0 after a level-up reset. */
    startPct: number;
    /** Ending fill % (0-100) for this bar. 100 means a level-up is reached. */
    endPct: number;
    didLevelUp: boolean;
    /** The level number this entry will be at after this segment completes. */
    toLevel: number;
};

export type ExpEntry = {
    elementId: number;
    letter: string;
    type1?: string;
    type2?: string;
    usesGained: number;
    oldLevel: number;
    newLevel: number;
    segments: ExpSegment[];
};

type ExpResultsModalProps = {
    entries: ExpEntry[];
    onContinue: () => void;
};

type EntryDisplayState = {
    fillPct: number;
    /** Full CSS transition string, or "none". */
    transition: string;
    isSparkle: boolean;
    /** Increments each time a level-up fires — keyed so the badge re-animates. */
    levelUpCount: number;
    currentLevel: number;
};

const BAR_FILL_MS = 450;
const SPARKLE_HOLD_MS = 500;
const NEXT_SEG_GAP_MS = 130;
const ENTRY_GAP_MS = 200;
const INITIAL_DELAY_MS = 400;

const getBarColor = (type1?: string, type2?: string): string => {
    const t1 = type1?.trim().toLowerCase();
    const t2 = type2?.trim().toLowerCase();
    const colors = (t1 ? ELEMENT_SPELL_COLORS[t1] : undefined) ?? (t2 ? ELEMENT_SPELL_COLORS[t2] : undefined);
    return colors?.bg ?? "#7ba7ff";
};

const getBarBorderColor = (type1?: string, type2?: string): string => {
    const t1 = type1?.trim().toLowerCase();
    const t2 = type2?.trim().toLowerCase();
    const colors = (t1 ? ELEMENT_SPELL_COLORS[t1] : undefined) ?? (t2 ? ELEMENT_SPELL_COLORS[t2] : undefined);
    return colors?.border ?? "#3a5fbf";
};

export function ExpResultsModal({ entries, onContinue }: ExpResultsModalProps) {
    const [displayStates, setDisplayStates] = useState<EntryDisplayState[]>(() =>
        entries.map((e) => ({
            fillPct: e.segments[0]?.startPct ?? 0,
            transition: "none",
            isSparkle: false,
            levelUpCount: 0,
            currentLevel: e.oldLevel,
        })),
    );
    const [currentEntryIndex, setCurrentEntryIndex] = useState(-1);
    const [allDone, setAllDone] = useState(entries.length === 0);
    const timersRef = useRef<number[]>([]);

    useEffect(() => {
        if (entries.length === 0) {
            const id = window.setTimeout(() => setAllDone(true), INITIAL_DELAY_MS);
            return () => window.clearTimeout(id);
        }

        const timers: number[] = [];
        timersRef.current = timers;
        const t = (fn: () => void, ms: number) => {
            const id = window.setTimeout(fn, ms);
            timers.push(id);
        };

        let time = INITIAL_DELAY_MS;

        for (let ei = 0; ei < entries.length; ei++) {
            const entry = entries[ei];
            const capturedEi = ei;

            // Highlight this entry as current
            t(() => setCurrentEntryIndex(capturedEi), time);

            for (let si = 0; si < entry.segments.length; si++) {
                const seg = entry.segments[si];

                // Phase 1: set bar to startPct instantly (no transition)
                t(() => {
                    setDisplayStates((prev) => {
                        const next = [...prev];
                        next[capturedEi] = { ...next[capturedEi], fillPct: seg.startPct, transition: "none", isSparkle: false };
                        return next;
                    });
                }, time);

                // Phase 2: trigger fill transition (20ms later so browser has painted startPct)
                t(() => {
                    setDisplayStates((prev) => {
                        const next = [...prev];
                        next[capturedEi] = { ...next[capturedEi], fillPct: seg.endPct, transition: `width ${BAR_FILL_MS}ms ease-out` };
                        return next;
                    });
                }, time + 20);

                time += BAR_FILL_MS + 20;

                if (seg.didLevelUp) {
                    // Phase 3: sparkle + update level badge
                    t(() => {
                        setDisplayStates((prev) => {
                            const next = [...prev];
                            next[capturedEi] = {
                                ...next[capturedEi],
                                isSparkle: true,
                                transition: "none",
                                levelUpCount: next[capturedEi].levelUpCount + 1,
                                currentLevel: seg.toLevel,
                            };
                            return next;
                        });
                    }, time);

                    time += SPARKLE_HOLD_MS;

                    // Phase 4: clear sparkle, snap bar back to 0% for next segment
                    t(() => {
                        setDisplayStates((prev) => {
                            const next = [...prev];
                            next[capturedEi] = {
                                ...next[capturedEi],
                                isSparkle: false,
                                fillPct: 0,
                                transition: "none",
                            };
                            return next;
                        });
                    }, time);

                    time += NEXT_SEG_GAP_MS;
                } else {
                    time += NEXT_SEG_GAP_MS;
                }
            }

            time += ENTRY_GAP_MS;
        }

        t(() => setAllDone(true), time);

        return () => {
            timers.forEach(window.clearTimeout);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hasLevelUps = entries.some((e) => e.newLevel > e.oldLevel);

    return createPortal(
        <div className="exp-results-overlay">
            <div className="exp-results-modal">
                <h2 className="exp-results-title">Battle Results</h2>

                {entries.length === 0 ? (
                    <p className="exp-results-empty">No experience gained.</p>
                ) : (
                    <div className="exp-results-entries">
                        {entries.map((entry, i) => {
                            const ds = displayStates[i];
                            const isCurrent = i === currentEntryIndex;
                            const isFuture = currentEntryIndex >= 0 && i > currentEntryIndex;
                            const barColor = getBarColor(entry.type1, entry.type2);
                            const barBorder = getBarBorderColor(entry.type1, entry.type2);

                            return (
                                <div
                                    key={entry.elementId}
                                    className={`exp-entry${isCurrent ? " is-current" : ""}${isFuture ? " is-future" : ""}`}
                                >
                                    <div className="exp-entry-icon">
                                        <ElementIcon name={entry.letter} className="exp-entry-icon-img" alt={entry.letter} />
                                    </div>

                                    <div className="exp-entry-body">
                                        <div className="exp-entry-header">
                                            <span className="exp-entry-letter">{entry.letter}</span>
                                            <span className="exp-entry-gained">+{entry.usesGained} exp</span>
                                            {ds.levelUpCount > 0 && (
                                                <span key={ds.levelUpCount} className="exp-entry-lvlup-badge">
                                                    LEVEL UP!
                                                </span>
                                            )}
                                        </div>

                                        <div className="exp-bar-track">
                                            <div
                                                className={`exp-bar-fill${ds.isSparkle ? " is-sparkling" : ""}`}
                                                style={{
                                                    width: `${ds.fillPct}%`,
                                                    transition: ds.transition,
                                                    ["--bar-color" as string]: barColor,
                                                    ["--bar-border" as string]: barBorder,
                                                }}
                                            />
                                        </div>

                                        <div className="exp-entry-footer">
                                            <span className="exp-entry-level">Lv {entry.oldLevel}</span>
                                            {entry.newLevel !== entry.oldLevel && (
                                                <span className="exp-entry-level-new"> → Lv {entry.newLevel}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <button
                    className="exp-results-continue"
                    onClick={() => {
                        timersRef.current.forEach(window.clearTimeout);
                        timersRef.current = [];
                        onContinue();
                    }}
                >
                    Continue
                </button>
            </div>
        </div>,
        document.body,
    );
}
