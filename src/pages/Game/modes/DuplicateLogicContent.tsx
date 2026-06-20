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

type DuplicateLogicContentProps = {
    dropZoneClassName: string;
    dropZoneRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowInsertPrompt: boolean;
};

function DuplicateLogicContent({
    dropZoneClassName,
    dropZoneRef,
    onHoverInsertSlot,
    shouldShowInsertPrompt,
}: DuplicateLogicContentProps) {
    return (
        <div className="duplicate-logic-content">
            <div
                className={dropZoneClassName}
                ref={dropZoneRef}
                onMouseEnter={() => onHoverInsertSlot(2)}
                onMouseLeave={() => onHoverInsertSlot(null)}
            >
                {shouldShowInsertPrompt ? (
                    <CombineStationTooltip
                        className="combine-station-tooltip--slot-two"
                        message="Please insert element"
                    />
                ) : null}
            </div>
        </div>
    );
}

export default DuplicateLogicContent;
