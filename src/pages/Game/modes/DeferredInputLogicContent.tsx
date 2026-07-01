import type { RefObject } from "react";
import ElementIcon from "../../../components/ElementIcon";
import InputSlot from "../slots/InputSlot";
import SlotShutter from "../slots/SlotShutter";
import CounterSlot from "../slots/CounterSlot";

type DeferredInputLogicContentProps = {
    /** Wrapper class for the mode (e.g. "incubate-logic-content" / "refine-logic-content"). */
    wrapperClassName: string;
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

/**
 * Logic content for deferred modes that take a single element input plus a
 * battle counter, and seal behind a shutter while a job is pending
 * (Incubate, Refine). The only per-mode difference is the wrapper class.
 */
function DeferredInputLogicContent({
    wrapperClassName,
    dropZoneClassName,
    dropZoneRef,
    onHoverInsertSlot,
    shouldShowInsertPrompt,
    counterValue,
    onCounterChange,
    pendingJobElement,
    isSlotAnimatingClose,
    isSlotAnimatingOpen,
}: DeferredInputLogicContentProps) {
    const isPending = pendingJobElement !== null;
    const overlay = isPending ? (
        <span
            className={`logic-drop-zone-pending-element${pendingJobElement.category === "soul" ? " is-soul" : ""}`}
            aria-hidden="true"
        >
            <ElementIcon name={pendingJobElement.letter} />
        </span>
    ) : null;
    return (
        <div className={wrapperClassName}>
            <SlotShutter
                shellClassName="logic-drop-zone-shell"
                shutterClassName="logic-drop-zone-shutter"
                isClosed={isPending}
                isAnimatingClose={isPending && isSlotAnimatingClose}
                isAnimatingOpen={!isPending && isSlotAnimatingOpen}
                overlay={overlay}
            >
                <InputSlot
                    className={dropZoneClassName}
                    slotRef={dropZoneRef}
                    onHover={onHoverInsertSlot}
                    hoverValue={2}
                    showInsertPrompt={shouldShowInsertPrompt}
                    insertPromptClassName="combine-station-tooltip--slot-two"
                />
            </SlotShutter>
            <CounterSlot
                value={counterValue}
                label="Battles"
                onChange={onCounterChange}
                disabled={isPending}
            />
        </div>
    );
}

export default DeferredInputLogicContent;
