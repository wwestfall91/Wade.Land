import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TooltipPanelContent, type ElementDetails } from "./FloatingTooltip";
import "./ComparisonTooltip.scss";

type ComparisonTooltipProps = {
    anchorElement: HTMLElement | null;
    open: boolean;
    beforeElement: ElementDetails;
    afterElement: ElementDetails;
    changedKeys: ReadonlySet<string>;
    typeMultipliers?: Record<string, number>;
};

function ComparisonTooltip({
    anchorElement,
    open,
    beforeElement,
    afterElement,
    changedKeys,
    typeMultipliers,
}: ComparisonTooltipProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState({ left: 0, top: 0 });

    const updatePosition = useCallback(() => {
        if (!anchorElement || !containerRef.current) return;
        const anchor = anchorElement.getBoundingClientRect();
        const container = containerRef.current.getBoundingClientRect();
        const anchorCenterX = anchor.left + anchor.width / 2;
        const padding = 8;
        const topIfAbove = anchor.top - padding - container.height;
        const top = topIfAbove < padding ? anchor.bottom + padding : topIfAbove;
        const left = Math.max(padding, Math.min(
            anchorCenterX - container.width / 2,
            window.innerWidth - container.width - padding,
        ));
        setPos({ left, top });
    }, [anchorElement]);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open, beforeElement, afterElement, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const raf = requestAnimationFrame(updatePosition);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, updatePosition]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={containerRef}
            className="comparison-tooltip"
            style={{ position: "absolute", left: pos.left, top: pos.top, zIndex: 2147483647 }}
        >
            <div className="comparison-tooltip__card">
                <TooltipPanelContent
                    elementDetails={beforeElement}
                    typeMultipliers={typeMultipliers}
                />
            </div>
            <div className="comparison-tooltip__arrow" aria-hidden="true">→</div>
            <div className="comparison-tooltip__card">
                <TooltipPanelContent
                    elementDetails={afterElement}
                    changedKeys={changedKeys}
                    typeMultipliers={typeMultipliers}
                />
            </div>
        </div>,
        document.body,
    );
}

export default ComparisonTooltip;
