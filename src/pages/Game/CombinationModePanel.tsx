import type { RefObject } from "react";
import ElementIcon from "../../components/ElementIcon";
import ModeSlot from "./slots/ModeSlot";
import "./CombinationModePanel.scss";

const MODE_TAB_ORDER = ["water", "fire", "earth", "air", "soul"] as const;

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
    sealedModeElementKeys: ModeTabElementKey[];
    activeModeTabElementKey?: string;
    onModeTabSelect: (elementKey: ModeTabElementKey) => void;
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
    sealedModeElementKeys,
    activeModeTabElementKey,
    onModeTabSelect,
    onInsertMode,
}: CombinationModePanelProps) {
    return (
        <div className="combination-mode-panel-outer">
            <div className="mode-tabs-bar" role="tablist" aria-label="Mode elements">
                {MODE_TAB_ORDER.map((elementKey) => {
                    const isActive = activeModeTabElementKey === elementKey;
                    const isInserted = sealedModeElementKeys.includes(elementKey)
                        || (isModeInserted && activeModeTabElementKey === elementKey);
                    return (
                        <button
                            key={elementKey}
                            type="button"
                            className={`mode-tab mode-tab--${elementKey} ${isActive ? "is-active" : ""} ${isInserted ? "is-inserted" : ""}`.trim()}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onModeTabSelect(elementKey)}
                        >
                            <ElementIcon name={elementKey} />
                        </button>
                    );
                })}
            </div>
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
