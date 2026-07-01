import type { RefObject } from "react";

type OutputSlotProps = {
    /** Class for the output zone (defaults to "output"). */
    className?: string;
    /** Ref used by Game.tsx for spawn positioning / hover detection. */
    slotRef?: RefObject<HTMLDivElement>;
    /** Hover callback. */
    onHover?: (hovered: boolean) => void;
};

/**
 * A reusable element output slot: the zone a freshly combined element lands in.
 * Purely presentational — Game.tsx reads {@link slotRef} to position spawned
 * elements over it.
 */
function OutputSlot({ className = "output", slotRef, onHover }: OutputSlotProps) {
    return (
        <div
            className={className}
            ref={slotRef}
            onMouseEnter={() => onHover?.(true)}
            onMouseLeave={() => onHover?.(false)}
        />
    );
}

export default OutputSlot;
