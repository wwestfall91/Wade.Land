import type { RefObject } from "react";

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

type MixLogicContentProps = {
    primaryDropZoneClassName: string;
    secondaryDropZoneClassName: string;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowPrimaryInsertPrompt: boolean;
    shouldShowSecondaryInsertPrompt: boolean;
    slotConnectorClassName: string;
};

function MixLogicContent({
    primaryDropZoneClassName,
    secondaryDropZoneClassName,
    dropZoneRefB,
    dropZoneRefC,
    onHoverInsertSlot,
    shouldShowPrimaryInsertPrompt,
    shouldShowSecondaryInsertPrompt,
    slotConnectorClassName,
}: MixLogicContentProps) {
    return (
        <div className="mix-logic-content">
            <div className="mix-slot-group">
                <span className="mix-slot-label">Primary</span>
                <div
                    className={primaryDropZoneClassName}
                    ref={dropZoneRefB}
                    onMouseEnter={() => onHoverInsertSlot(2)}
                    onMouseLeave={() => onHoverInsertSlot(null)}
                >
                    {shouldShowPrimaryInsertPrompt ? (
                        <CombineStationTooltip
                            className="combine-station-tooltip--slot-two"
                            message="Please insert element"
                        />
                    ) : null}
                </div>
            </div>

            <div className={slotConnectorClassName} aria-hidden="true" />

            <div className="mix-slot-group">
                <span className="mix-slot-label">Secondary</span>
                <div
                    className={secondaryDropZoneClassName}
                    ref={dropZoneRefC}
                    onMouseEnter={() => onHoverInsertSlot(null)}
                    onMouseLeave={() => onHoverInsertSlot(null)}
                >
                    {shouldShowSecondaryInsertPrompt ? (
                        <CombineStationTooltip
                            className="combine-station-tooltip--slot-three"
                            message="Please insert element"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default MixLogicContent;
