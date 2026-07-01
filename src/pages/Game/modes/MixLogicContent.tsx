import type { RefObject } from "react";
import InputSlot from "../slots/InputSlot";

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
                <InputSlot
                    className={`${primaryDropZoneClassName} mix-slot mix-slot--primary`.trim()}
                    slotRef={dropZoneRefB}
                    onHover={onHoverInsertSlot}
                    hoverValue={2}
                    label="Primary"
                    labelClassName="mix-slot-label mix-slot-label--inside"
                    showInsertPrompt={shouldShowPrimaryInsertPrompt}
                    insertPromptClassName="combine-station-tooltip--slot-two"
                />
            </div>

            <div className={slotConnectorClassName} aria-hidden="true" />

            <div className="mix-slot-group">
                <InputSlot
                    className={`${secondaryDropZoneClassName} mix-slot mix-slot--secondary`.trim()}
                    slotRef={dropZoneRefC}
                    onHover={onHoverInsertSlot}
                    hoverValue={null}
                    label="Secondary"
                    labelClassName="mix-slot-label mix-slot-label--inside"
                    showInsertPrompt={shouldShowSecondaryInsertPrompt}
                    insertPromptClassName="combine-station-tooltip--slot-three"
                />
            </div>
        </div>
    );
}

export default MixLogicContent;
