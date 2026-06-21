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
                <div
                    className={`${primaryDropZoneClassName} mix-slot mix-slot--primary`.trim()}
                    ref={dropZoneRefB}
                    onMouseEnter={() => onHoverInsertSlot(2)}
                    onMouseLeave={() => onHoverInsertSlot(null)}
                >
                    <span className="mix-slot-label mix-slot-label--inside">Primary</span>
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
                <div
                    className={`${secondaryDropZoneClassName} mix-slot mix-slot--secondary`.trim()}
                    ref={dropZoneRefC}
                    onMouseEnter={() => onHoverInsertSlot(null)}
                    onMouseLeave={() => onHoverInsertSlot(null)}
                >
                    <span className="mix-slot-label mix-slot-label--inside">Secondary</span>
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
