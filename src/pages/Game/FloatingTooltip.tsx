import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./FloatingTooltip.scss";

type TooltipLayout = {
    left: number;
    top: number;
    offsetX: number;
    isBelow: boolean;
    width: number;
    height: number;
};

type FloatingTooltipProps = {
    anchorElement: HTMLElement | null;
    open: boolean;
    className: string;
    children: ReactNode;
    offset?: number;
    viewportPadding?: number;
    clampHorizontal?: boolean;
};

const DEFAULT_LAYOUT: TooltipLayout = {
    left: 0,
    top: 0,
    offsetX: 0,
    isBelow: false,
    width: 0,
    height: 0,
};

function FloatingTooltip({
    anchorElement,
    open,
    className,
    children,
    offset = 8,
    viewportPadding = 8,
    clampHorizontal = true,
}: FloatingTooltipProps) {
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [layout, setLayout] = useState<TooltipLayout>(DEFAULT_LAYOUT);

    const updatePosition = useCallback(() => {
        if (!anchorElement || !tooltipRef.current) {
            return;
        }

        const anchorRect = anchorElement.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        if (!anchorRect || !tooltipRect.width || !tooltipRect.height) {
            return;
        }

        const anchorCenterX = anchorRect.left + anchorRect.width / 2;
        let offsetX = 0;

        if (clampHorizontal) {
            const popupLeft = anchorCenterX - tooltipRect.width / 2;
            const popupRight = popupLeft + tooltipRect.width;

            if (popupLeft < viewportPadding) {
                offsetX = viewportPadding - popupLeft;
            } else if (popupRight > window.innerWidth - viewportPadding) {
                offsetX = window.innerWidth - viewportPadding - popupRight;
            }
        }

        const topIfAbove = anchorRect.top - offset - tooltipRect.height;
        const isBelow = topIfAbove < viewportPadding;

        setLayout({
            left: anchorCenterX,
            top: isBelow ? anchorRect.bottom + offset : anchorRect.top - offset,
            offsetX,
            isBelow,
            width: tooltipRect.width,
            height: tooltipRect.height,
        });
    }, [anchorElement, clampHorizontal, offset, viewportPadding]);

    useLayoutEffect(() => {
        if (!open || typeof document === "undefined") {
            return;
        }

        updatePosition();
    }, [children, open, updatePosition]);

    useEffect(() => {
        if (!open || typeof window === "undefined") {
            return;
        }

        const handleReposition = () => {
            updatePosition();
        };

        const rafId = window.requestAnimationFrame(handleReposition);
        window.addEventListener("resize", handleReposition);
        window.addEventListener("scroll", handleReposition, true);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", handleReposition);
            window.removeEventListener("scroll", handleReposition, true);
        };
    }, [open, updatePosition]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            ref={tooltipRef}
            className={`floating-tooltip ${className} ${layout.isBelow ? "is-below" : ""}`}
            style={{
                position: "absolute",
                left: layout.left,
                top: layout.top,
                marginLeft: `${-layout.width / 2 + layout.offsetX}px`,
                marginTop: layout.isBelow ? "0px" : `${-layout.height}px`,
                pointerEvents: "none",
                zIndex: 2147483647,
            }}
        >
            <div className="floating-tooltip__panel">{children}</div>
            <span className="floating-tooltip__arrow" aria-hidden="true" />
        </div>,
        document.body,
    );
}

export default FloatingTooltip;