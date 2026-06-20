import type { RefObject } from "react";
import ElementIcon from "../../../components/ElementIcon";
import ModeCounter from "./ModeCounter";

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

type RefineLogicContentProps = {
    dropZoneClassName: string;
    dropZoneRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowInsertPrompt: boolean;
    counterValue: number;
    onCounterChange: (value: number) => void;
    pendingJobElement: { letter: string; category?: string } | null;
    isSlotAnimatingClose: boolean;
    isSlotAnimatingOpen: boolean;
};

function RefineLogicContent({
    dropZoneClassName,
    dropZoneRef,
    onHoverInsertSlot,
    shouldShowInsertPrompt,
    counterValue,
    onCounterChange,
    pendingJobElement,
    isSlotAnimatingClose,
    isSlotAnimatingOpen,
}: RefineLogicContentProps) {
    const isPending = pendingJobElement !== null;
    return (
        <div className="refine-logic-content">
            <div
                className={[
                    "logic-drop-zone-shell",
                    isPending ? "is-closed" : "",
                    isPending && isSlotAnimatingClose ? "is-animating-close" : "",
                    !isPending && isSlotAnimatingOpen ? "is-animating-open" : "",
                ].filter(Boolean).join(" ")}
            >
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
                {isPending ? (
                    <span
                        className={`logic-drop-zone-pending-element${pendingJobElement.category === "soul" ? " is-soul" : ""}`}
                        aria-hidden="true"
                    >
                        <ElementIcon name={pendingJobElement.letter} />
                    </span>
                ) : null}
                <span className="logic-drop-zone-shutter" aria-hidden="true" />
            </div>
            <ModeCounter
                value={counterValue}
                label="Battles"
                onChange={onCounterChange}
                disabled={isPending}
            />
        </div>
    );
}

export default RefineLogicContent;
