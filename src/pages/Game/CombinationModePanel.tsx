import type { RefObject } from "react";
import ModeSlot from "./slots/ModeSlot";
import "./CombinationModePanel.scss";

export const MODE_TAB_ORDER = ["water", "fire", "earth", "air", "soul"] as const;

export type ModeTabElementKey = (typeof MODE_TAB_ORDER)[number];

type CombinationModePanelProps = {
    className: string;
    dropZoneClassName: string;
    dropZoneRefA: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowSlotOneInsertPrompt: boolean;
    isInsertEnabled: boolean;
    isModeInserted: boolean;
    shouldAnimateModeShutter: boolean;
    modeInsertedElementLetter?: string;
    modeInsertedElementCategory?: string;
    showModeInsertedElementOverlay: boolean;
    hasSelectedModeTab: boolean;
    activeModeTabElementKey?: string;
    onInsertMode: () => void;
};

function CombinationModePanel({
    className,
    dropZoneClassName,
    dropZoneRefA,
    onHoverInsertSlot,
    shouldShowSlotOneInsertPrompt,
    isInsertEnabled,
    isModeInserted,
    shouldAnimateModeShutter,
    modeInsertedElementLetter,
    modeInsertedElementCategory,
    showModeInsertedElementOverlay,
    hasSelectedModeTab,
    activeModeTabElementKey,
    onInsertMode,
}: CombinationModePanelProps) {
    return (
        <div className="combination-mode-panel-outer">
            <div className="mode-component-anchor">
                <div className={`combination-mode-panel ${className} ${hasSelectedModeTab ? "" : "is-hidden"}`.trim()}>
                    <div className="mode-panel-body">
                        <div className="drop-zone-area">
                            <ModeSlot
                                dropZoneClassName={dropZoneClassName}
                                dropZoneRef={dropZoneRefA}
                                onHoverInsertSlot={onHoverInsertSlot}
                                shouldShowInsertPrompt={shouldShowSlotOneInsertPrompt}
                                isModeInserted={isModeInserted}
                                shouldAnimateModeShutter={shouldAnimateModeShutter}
                                activeModeTabElementKey={activeModeTabElementKey}
                                showInsertedElementOverlay={showModeInsertedElementOverlay}
                                insertedElementLetter={modeInsertedElementLetter}
                                insertedElementCategory={modeInsertedElementCategory}
                            />
                        </div>
                    </div>
                    <div className="insert-mode-button-wrap">
                        {!isModeInserted ? (
                            <button
                                type="button"
                                className="insert-mode-button"
                                onClick={onInsertMode}
                                disabled={!isInsertEnabled}
                            >
                                Insert
                            </button>
                        ) : (
                            <span className="insert-mode-button-spacer" aria-hidden="true" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CombinationModePanel;
