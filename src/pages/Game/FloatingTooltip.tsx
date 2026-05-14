import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipLayout = {
    left: number;
    top: number;
    offsetX: number;
    isBelow: boolean;
};

type FloatingTooltipProps = {
    anchorElement: HTMLElement | null;
    open: boolean;
    className: string;
    children: ReactNode;
    offset?: number;
    viewportPadding?: number;
};

const DEFAULT_LAYOUT: TooltipLayout = {
    left: 0,
    top: 0,
    offsetX: 0,
    isBelow: false,
};

function FloatingTooltip({
    anchorElement,
    open,
    className,
    children,
    offset = 8,
    viewportPadding = 8,
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
        const popupLeft = anchorCenterX - tooltipRect.width / 2;
        const popupRight = popupLeft + tooltipRect.width;
        let offsetX = 0;

        if (popupLeft < viewportPadding) {
            offsetX = viewportPadding - popupLeft;
        } else if (popupRight > window.innerWidth - viewportPadding) {
            offsetX = window.innerWidth - viewportPadding - popupRight;
        }

        const topIfAbove = anchorRect.top - offset - tooltipRect.height;
        const isBelow = topIfAbove < viewportPadding;

        setLayout({
            left: anchorCenterX,
            top: isBelow ? anchorRect.bottom + offset : anchorRect.top - offset,
            offsetX,
            isBelow,
        });
    }, [anchorElement, offset, viewportPadding]);

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
            className={className}
            style={{
                position: "absolute",
                left: layout.left,
                top: layout.top,
                transform: `translate(calc(-50% + ${layout.offsetX}px), ${layout.isBelow ? "0" : "-100%"})`,
                background: "linear-gradient(180deg, #fff6d6 0%, #f1dcaa 100%)",
                border: "2px solid #102060",
                borderRadius: "5px",
                boxShadow: "inset 0 0 0 1px #ffe7b6, inset 0 0 0 2px #c9b071, 0 7px 0 rgba(0, 0, 0, 0.33)",
                pointerEvents: "none",
                zIndex: 2147483647,
            }}
        >
            {children}
            <span
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: "50%",
                    width: 0,
                    height: 0,
                    marginLeft: "-0.46rem",
                    bottom: layout.isBelow ? "auto" : "-0.5rem",
                    top: layout.isBelow ? "-0.5rem" : "auto",
                    borderLeft: "0.46rem solid transparent",
                    borderRight: "0.46rem solid transparent",
                    borderTop: layout.isBelow ? "0" : "0.52rem solid #102060",
                    borderBottom: layout.isBelow ? "0.52rem solid #102060" : "0",
                }}
            />
        </div>,
        document.body,
    );
}

export default FloatingTooltip;