import type { ReactNode, MouseEvent } from "react";
import FloatingTooltip, { type ElementDetails } from "./FloatingTooltip";
import ComparisonTooltip from "./ComparisonTooltip";

type PreviewOutputTooltipProps = {
    /** Anchor element for positioning (the draggable preview element). */
    anchorElement: HTMLElement | null;
    /** Element details for the output (the "after" state). */
    afterDetails: ElementDetails;
    /**
     * Element details for the consumed input (the "before" state).
     * When provided and showComparison is true, the ComparisonTooltip is shown.
     */
    beforeDetails: ElementDetails | null;
    /**
     * When true (and beforeDetails is non-null), shows the ComparisonTooltip
     * with the before→after arrow view instead of the standalone FloatingTooltip.
     */
    showComparison: boolean;
    /** Whether the standalone FloatingTooltip is open. Ignored when comparison is active. */
    isOpen: boolean;
    /** Whether the standalone tooltip is in the pinned/selected state. */
    isSelected?: boolean;
    /** Whether the standalone tooltip accepts mouse interaction. */
    isInteractive?: boolean;
    onTooltipMouseEnter?: (event: MouseEvent<HTMLDivElement>) => void;
    onTooltipMouseLeave?: (event: MouseEvent<HTMLDivElement>) => void;
    className?: string;
    changedKeys?: ReadonlySet<string>;
    typeMultipliers?: Record<string, number>;
    /**
     * Custom content for the standalone FloatingTooltip (e.g. a deferred "?" message).
     * When set this replaces the afterDetails-driven content.
     */
    standaloneContent?: ReactNode;
    /**
     * Custom content for the ComparisonTooltip's "after" panel (e.g. a deferred "?" block).
     * When set this replaces the afterDetails-driven panel.
     */
    comparisonAfterContent?: ReactNode;
};

/**
 * Renders the tooltip for a single combination output slot.
 *
 * - When `showComparison` is true and `beforeDetails` is provided, shows a
 *   ComparisonTooltip with a before → after arrow view.
 * - Otherwise shows a standard FloatingTooltip controlled by `isOpen`.
 *
 * Use this for every output slot so the "before/after" experience is guaranteed
 * by construction and never needs to be wired up manually per slot.
 */
function PreviewOutputTooltip({
    anchorElement,
    afterDetails,
    beforeDetails,
    showComparison,
    isOpen,
    isSelected,
    isInteractive,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    className = "drag-description-popup",
    changedKeys,
    typeMultipliers,
    standaloneContent,
    comparisonAfterContent,
}: PreviewOutputTooltipProps) {
    const isShowingComparison = showComparison && beforeDetails !== null;

    if (isShowingComparison && beforeDetails) {
        return (
            <ComparisonTooltip
                anchorElement={anchorElement}
                open={true}
                beforeElement={beforeDetails}
                afterElement={afterDetails}
                afterContent={comparisonAfterContent}
                changedKeys={changedKeys ?? new Set()}
                typeMultipliers={typeMultipliers}
            />
        );
    }

    return (
        <FloatingTooltip
            anchorElement={anchorElement}
            open={isOpen}
            selected={isSelected}
            className={className}
            interactive={isInteractive}
            onTooltipMouseEnter={onTooltipMouseEnter}
            onTooltipMouseLeave={onTooltipMouseLeave}
            clampHorizontal={false}
            typeMultipliers={typeMultipliers}
            {...(standaloneContent
                ? { children: standaloneContent }
                : { elementDetails: afterDetails }
            )}
        />
    );
}

export default PreviewOutputTooltip;
