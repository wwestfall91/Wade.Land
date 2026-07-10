import type { RefObject } from "react";
import ElementIcon from "../../components/ElementIcon";
import "./ModeUnlockPanel.scss";

type ModeUnlockPanelProps = {
    /** Element key for this mode (e.g. "fire", "water"). Used for styling and icon hints. */
    elementKey: string;
    /** The 3 drop-zone refs wired into Game.tsx's drag hit-testing. */
    slotRefs: [RefObject<HTMLDivElement>, RefObject<HTMLDivElement>, RefObject<HTMLDivElement>];
    /** The element IDs currently occupying each unlock slot (null = empty). */
    slotOccupants: [number | null, number | null, number | null];
    /** Resolves an occupant id to the element's letter for rendering the icon. */
    getSlotLetter: (id: number) => string | undefined;
    /** True only when all 3 inserted elements are the correct type for this mode. */
    isUnlockReady: boolean;
    /** Called when the player clicks Unlock (only enabled when all 3 slots are filled). */
    onUnlock: () => void;
};

/**
 * The panel shown when a combination mode is locked. Contains 3 drop-zone slots
 * that each require the mode's element type, plus an Unlock button.
 */
function ModeUnlockPanel({
    elementKey,
    slotRefs,
    slotOccupants,
    getSlotLetter,
    isUnlockReady,
    onUnlock,
}: ModeUnlockPanelProps) {
    return (
        <div className={`mode-unlock-panel mode-unlock-panel--${elementKey}`}>
            <div className="mode-unlock-slots">
                {slotRefs.map((ref, i) => {
                    const occupantId = slotOccupants[i];
                    const letter = occupantId !== null ? getSlotLetter(occupantId) : undefined;
                    return (
                        <div
                            key={i}
                            className={`mode-unlock-slot${occupantId !== null ? " has-element" : ""}`}
                            ref={ref}
                        >
                            <span className="mode-unlock-slot-mode-icon" aria-hidden="true">
                                <ElementIcon name={elementKey} />
                            </span>
                            {letter ? (
                                <span className="mode-unlock-slot-occupant" aria-hidden="true">
                                    <ElementIcon name={letter} />
                                </span>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <button
                type="button"
                className="mode-unlock-button"
                disabled={!isUnlockReady}
                onClick={onUnlock}
            >
                Unlock
            </button>
        </div>
    );
}

export default ModeUnlockPanel;
