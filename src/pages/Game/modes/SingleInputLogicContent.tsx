import type { RefObject } from "react";
import InputSlot from "../slots/InputSlot";

type SingleInputLogicContentProps = {
    /** Wrapper class for the mode (e.g. "divide-logic-content" / "duplicate-logic-content"). */
    wrapperClassName: string;
    dropZoneClassName: string;
    dropZoneRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowInsertPrompt: boolean;
};

/**
 * Logic content for modes that take a single element input and no extra
 * configuration (Divide, Duplicate). The only per-mode difference is the
 * wrapper class, which drives styling.
 */
function SingleInputLogicContent({
    wrapperClassName,
    dropZoneClassName,
    dropZoneRef,
    onHoverInsertSlot,
    shouldShowInsertPrompt,
}: SingleInputLogicContentProps) {
    return (
        <div className={wrapperClassName}>
            <InputSlot
                className={dropZoneClassName}
                slotRef={dropZoneRef}
                onHover={onHoverInsertSlot}
                hoverValue={2}
                showInsertPrompt={shouldShowInsertPrompt}
                insertPromptClassName="combine-station-tooltip--slot-two"
            />
        </div>
    );
}

export default SingleInputLogicContent;
