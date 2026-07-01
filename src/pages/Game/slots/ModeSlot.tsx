import type { RefObject } from "react";
import ElementIcon from "../../../components/ElementIcon";
import InputSlot from "./InputSlot";
import SlotShutter from "./SlotShutter";

type ModeSlotProps = {
    /** Full class string for the drop zone. */
    dropZoneClassName: string;
    /** Ref used by Game.tsx drag hit-testing (zone slot 0). */
    dropZoneRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowInsertPrompt: boolean;
    /** True once an element has been inserted to seal the mode. */
    isModeInserted: boolean;
    /** Plays the shutter close animation. */
    shouldAnimateModeShutter: boolean;
    /** The element key whose icon previews inside the empty slot. */
    activeModeTabElementKey?: string;
    /** Whether to render the inserted-element overlay. */
    showInsertedElementOverlay: boolean;
    insertedElementLetter?: string;
    insertedElementCategory?: string;
};

/**
 * The combination station's first/mode slot. Unlike a plain {@link InputSlot},
 * inserting an element here *seals a mode* rather than feeding a formula, so it
 * owns mode-specific visuals: an active mode icon preview, the sealing shutter,
 * and the inserted-element overlay. The Insert button itself stays in the panel.
 */
function ModeSlot({
    dropZoneClassName,
    dropZoneRef,
    onHoverInsertSlot,
    shouldShowInsertPrompt,
    isModeInserted,
    shouldAnimateModeShutter,
    activeModeTabElementKey,
    showInsertedElementOverlay,
    insertedElementLetter,
    insertedElementCategory,
}: ModeSlotProps) {
    const overlay = showInsertedElementOverlay && insertedElementLetter ? (
        <span
            className={`mode-drop-zone-inserted-element ${insertedElementCategory === "soul" ? "is-soul" : ""}`.trim()}
            aria-hidden="true"
        >
            <ElementIcon name={insertedElementLetter} />
        </span>
    ) : null;

    return (
        <SlotShutter
            shellClassName="mode-drop-zone-shell"
            shutterClassName="mode-drop-zone-shutter"
            isClosed={isModeInserted}
            isAnimatingClose={shouldAnimateModeShutter}
            isAnimatingOpen={false}
            overlay={overlay}
        >
            <InputSlot
                className={dropZoneClassName}
                slotRef={dropZoneRef}
                onHover={onHoverInsertSlot}
                hoverValue={1}
                showInsertPrompt={shouldShowInsertPrompt}
                insertPromptClassName="combine-station-tooltip--slot-one"
            >
                {activeModeTabElementKey ? (
                    <span className="mode-slot-icon" aria-hidden="true">
                        <ElementIcon name={activeModeTabElementKey} />
                    </span>
                ) : null}
            </InputSlot>
        </SlotShutter>
    );
}

export default ModeSlot;
