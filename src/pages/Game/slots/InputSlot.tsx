import type { ReactNode, RefObject } from "react";
import SlotInsertPrompt from "./SlotInsertPrompt";

type InputSlotProps = {
    /** Full class string for the drop zone (e.g. the `drop-zone ...` string from the station, plus any mode modifiers). */
    className: string;
    /** Ref used by Game.tsx drag hit-testing. */
    slotRef?: RefObject<HTMLDivElement>;
    /** Hover callback wired to the station's insert-slot tracking. */
    onHover?: (slot: 1 | 2 | null) => void;
    /** Value emitted on mouse enter (mouse leave always emits null). */
    hoverValue?: 1 | 2 | null;
    /** Optional inside label (e.g. "Primary" / "Secondary" for Mix). */
    label?: string;
    /** Class for the inside label element. */
    labelClassName?: string;
    /** Whether to show the "please insert element" prompt. */
    showInsertPrompt?: boolean;
    /** Positioning class for the insert prompt (e.g. "combine-station-tooltip--slot-two"). */
    insertPromptClassName?: string;
    /** Override the insert prompt message. */
    insertPromptMessage?: string;
    /** Extra content rendered inside the drop zone (e.g. a mode element icon). */
    children?: ReactNode;
};

/**
 * A reusable element input slot: the drop-zone box that accepts a dragged
 * element. Purely presentational — the drop rules themselves live in Game.tsx,
 * which reads {@link slotRef} for hit-testing.
 */
function InputSlot({
    className,
    slotRef,
    onHover,
    hoverValue = 2,
    label,
    labelClassName,
    showInsertPrompt = false,
    insertPromptClassName,
    insertPromptMessage,
    children,
}: InputSlotProps) {
    return (
        <div
            className={className}
            ref={slotRef}
            onMouseEnter={() => onHover?.(hoverValue)}
            onMouseLeave={() => onHover?.(null)}
        >
            {label ? <span className={labelClassName}>{label}</span> : null}
            {children}
            {showInsertPrompt ? (
                <SlotInsertPrompt className={insertPromptClassName} message={insertPromptMessage} />
            ) : null}
        </div>
    );
}

export default InputSlot;
