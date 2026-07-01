import type { ReactNode } from "react";

type SlotShutterProps = {
    /** Shell wrapper class, e.g. "mode-drop-zone-shell" / "logic-drop-zone-shell" / "result-output-shell". */
    shellClassName: string;
    /** Shutter element class, e.g. "mode-drop-zone-shutter" / "result-output-shutter". */
    shutterClassName: string;
    /** Whether the shutter is closed (covers the slot). */
    isClosed: boolean;
    /**
     * Whether the close animation should play. Callers pass the already-gated
     * value because gating differs between the mode slot and the logic/output
     * slots (the engine intentionally does not normalize this).
     */
    isAnimatingClose: boolean;
    /** Whether the open animation should play (already gated by the caller). */
    isAnimatingOpen: boolean;
    /** Optional overlay rendered between the slot and the shutter (e.g. a pending element icon). */
    overlay?: ReactNode;
    /** The slot (input drop zone or output zone) the shutter covers. */
    children: ReactNode;
};

/**
 * Shared shutter shell that animates open/closed over a slot. Dedupes the markup
 * that was copy-pasted across the mode slot, the deferred input slots
 * (Incubate / Refine) and the primary output slot.
 */
function SlotShutter({
    shellClassName,
    shutterClassName,
    isClosed,
    isAnimatingClose,
    isAnimatingOpen,
    overlay,
    children,
}: SlotShutterProps) {
    const className = [
        shellClassName,
        isClosed ? "is-closed" : "",
        isAnimatingClose ? "is-animating-close" : "",
        isAnimatingOpen ? "is-animating-open" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={className}>
            {children}
            {overlay}
            <span className={shutterClassName} aria-hidden="true" />
        </div>
    );
}

export default SlotShutter;
