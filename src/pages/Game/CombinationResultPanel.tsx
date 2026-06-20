import type { RefObject } from "react";
import "./CombinationResultPanel.scss";

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

type CombinationResultPanelProps = {
    className: string;
    secondaryDropZoneClassName: string;
    secondSlotConnectorClassName: string;
    combineButtonElementClass: string;
    isCombineButtonDisabled: boolean;
    combineActionLabel: string;
    zoneOccupants: Array<number | null>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    outputRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    onCombineButtonHoverChange: (isHovered: boolean) => void;
    onCombine: () => void;
    shouldShowSlotTwoInsertPrompt: boolean;
    onOutputHover: (hovered: boolean) => void;
};

function CombinationResultPanel({
    className,
    secondaryDropZoneClassName,
    secondSlotConnectorClassName,
    combineButtonElementClass,
    isCombineButtonDisabled,
    combineActionLabel,
    zoneOccupants,
    dropZoneRefB,
    dropZoneRefC,
    outputRef,
    onHoverInsertSlot,
    onCombineButtonHoverChange,
    onCombine,
    shouldShowSlotTwoInsertPrompt,
    onOutputHover,
}: CombinationResultPanelProps) {
    return (
        <div className={`combination-result-panel ${className}`.trim()}>
            <div className="drop-zone-area">
                <div
                    className={secondaryDropZoneClassName}
                    ref={dropZoneRefB}
                    onMouseEnter={() => {
                        onHoverInsertSlot(2);
                    }}
                    onMouseLeave={() => {
                        onHoverInsertSlot(null);
                    }}
                >
                    Element
                    {shouldShowSlotTwoInsertPrompt ? (
                        <CombineStationTooltip
                            className="combine-station-tooltip--slot-two"
                            message="Please insert element"
                        />
                    ) : null}
                </div>
                {zoneOccupants.length === 3 ? (
                    <div className="drop-zone" ref={dropZoneRefC}>3</div>
                ) : null}
                <div className={secondSlotConnectorClassName} aria-hidden="true" />
                <div
                    className="output"
                    ref={outputRef}
                    onMouseEnter={() => onOutputHover(true)}
                    onMouseLeave={() => onOutputHover(false)}
                />
            </div>
            <div className="combine-button-dock">
                <div
                    className={`combine-button-wrap ${isCombineButtonDisabled ? "is-disabled" : ""}`}
                    onMouseEnter={() => {
                        onCombineButtonHoverChange(true);
                    }}
                    onMouseLeave={() => {
                        onCombineButtonHoverChange(false);
                    }}
                    onFocusCapture={() => {
                        onCombineButtonHoverChange(true);
                    }}
                    onBlurCapture={() => {
                        onCombineButtonHoverChange(false);
                    }}
                >
                    <button
                        className={`combine-button ${combineButtonElementClass}`.trim()}
                        disabled={isCombineButtonDisabled}
                        onClick={onCombine}
                    >
                        {combineActionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CombinationResultPanel;
