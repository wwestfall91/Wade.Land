import type { RefObject } from "react";
import ElementIcon from "../../components/ElementIcon";
import "./CombinationModePanel.scss";

const MODE_TAB_ORDER = ["water", "fire", "earth", "air", "soul"] as const;

export type ModeTabElementKey = (typeof MODE_TAB_ORDER)[number];

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

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
    activeModeTabElementKey,
    onModeTabSelect,
    onInsertMode,
}: CombinationModePanelProps) {
    return (
        <div className="combination-mode-panel-outer">
            <div className="mode-tabs-bar" role="tablist" aria-label="Mode elements">
                {MODE_TAB_ORDER.map((elementKey) => {
                    const isActive = activeModeTabElementKey === elementKey;
                    return (
                        <button
                            key={elementKey}
                            type="button"
                            className={`mode-tab mode-tab--${elementKey} ${isActive ? "is-active" : ""}`.trim()}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onModeTabSelect(elementKey)}
                        >
                            <ElementIcon name={elementKey} />
                        </button>
                    );
                })}
            </div>
            <div className={`combination-mode-panel ${className}`.trim()}>
            <div className="mode-panel-body">
                <div className="drop-zone-area">
                    <div className={`mode-drop-zone-shell ${isModeInserted ? "is-closed" : ""} ${shouldAnimateModeShutter ? "is-animating-close" : ""}`.trim()}>
                        <div
                            className={dropZoneClassName}
                            ref={dropZoneRefA}
                            onMouseEnter={() => {
                                onHoverInsertSlot(1);
                            }}
                            onMouseLeave={() => {
                                onHoverInsertSlot(null);
                            }}
                        >
                            {activeModeTabElementKey ? (
                                <span className="mode-slot-icon" aria-hidden="true">
                                    <ElementIcon name={activeModeTabElementKey} />
                                </span>
                            ) : null}
                            {shouldShowSlotOneInsertPrompt ? (
                                <CombineStationTooltip
                                    className="combine-station-tooltip--slot-one"
                                    message="Please insert element"
                                />
                            ) : null}
                        </div>
                        {showModeInsertedElementOverlay && modeInsertedElementLetter ? (
                            <span
                                className={`mode-drop-zone-inserted-element ${modeInsertedElementCategory === "soul" ? "is-soul" : ""}`.trim()}
                                aria-hidden="true"
                            >
                                <ElementIcon name={modeInsertedElementLetter} />
                            </span>
                        ) : null}
                        <span className="mode-drop-zone-shutter" aria-hidden="true" />
                    </div>
                </div>
            </div>
            <div className="insert-mode-button-wrap">
                    <button
                        type="button"
                        className="insert-mode-button"
                        onClick={onInsertMode}
                        disabled={!isInsertEnabled}
                    >
                        {isModeInserted ? "Inserted" : "Insert"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CombinationModePanel;
