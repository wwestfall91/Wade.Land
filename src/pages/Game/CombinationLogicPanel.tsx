import type { RefObject } from "react";
import "./CombinationLogicPanel.scss";

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

type CombinationLogicPanelProps = {
    className: string;
    secondaryDropZoneClassName: string;
    zoneOccupants: Array<number | null>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowSlotTwoInsertPrompt: boolean;
};

function CombinationLogicPanel({
    className,
    secondaryDropZoneClassName,
    zoneOccupants,
    dropZoneRefB,
    dropZoneRefC,
    onHoverInsertSlot,
    shouldShowSlotTwoInsertPrompt,
}: CombinationLogicPanelProps) {
    return (
        <div className={`combination-logic-panel ${className}`.trim()}>
            <div className="logic-panel-body">
                <div className="drop-zone-area">
                    <div
                        className={secondaryDropZoneClassName}
                        ref={dropZoneRefB}
                        onMouseEnter={() => onHoverInsertSlot(2)}
                        onMouseLeave={() => onHoverInsertSlot(null)}
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
                </div>
            </div>
        </div>
    );
}

export default CombinationLogicPanel;
