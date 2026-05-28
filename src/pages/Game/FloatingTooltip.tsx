import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import { getEffectChipClass, getEffectSummaryLines } from "../../combat/effectSummary";
import "./FloatingTooltip.scss";
import ElementIcon from "../../components/ElementIcon";

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
    children?: ReactNode;
    elementDetails?: {
        letter: string;
        damage: number;
        energy?: number;
        description: string;
        type1?: string;
        type2?: string;
        effects?: SpellEffectConfig[];
        level?: number;
    };
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
    elementDetails,
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
    }, [children, elementDetails, open, updatePosition]);

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

    const types = elementDetails
        ? [elementDetails.type1, elementDetails.type2].filter(
            (value): value is string => Boolean(value && value.trim().length > 0),
        )
        : [];

    const effectLines = elementDetails ? getEffectSummaryLines(elementDetails.effects) : [];

    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const toTypeBadgeClass = (value?: string) => {
        if (!value || value.trim().length === 0) {
            return "type-badge-none";
        }

        return `type-badge-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    };

    const toTypeThemeClass = (value?: string) => {
        if (!value || value.trim().length === 0) {
            return "tooltip-theme-none";
        }

        return `tooltip-theme-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    };

    const primaryBadgeType = elementDetails?.type1 ?? elementDetails?.type2;
    const primaryThemeType = elementDetails?.type1 ?? elementDetails?.type2;
    const primaryBadgeLabel = elementDetails?.level === 2 ? "SPELL" : "ELEMENT";
    const primaryBadgeClass = elementDetails?.level === 2 ? "tooltip-badge-spell" : "";

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
            <div className={`floating-tooltip__panel ${elementDetails ? toTypeThemeClass(primaryThemeType) : ""}`}>
                {elementDetails ? (
                    <div className="tooltip-container">
                        {typeof elementDetails.energy === "number" ? (
                            <span className="element-energy-badge" aria-label={`Energy ${elementDetails.energy}`}>
                                {elementDetails.energy}
                            </span>
                        ) : null}
                        <div className="element-title">
                            <div>{elementDetails.letter}</div>
                            <div className="description">{elementDetails.description}</div>
                        </div>
                        <div className="tooltip-header">
                            <span className={`element-info-badge ${primaryBadgeClass}`}>{primaryBadgeLabel}</span>
                            <div className="element-types">
                                {elementDetails.type1 ? (
                                    <span className={`element-info-badge ${toTypeBadgeClass(elementDetails.type1)}`}>{elementDetails.type1}</span>
                                ) : null}
                                {elementDetails.type2 ? (
                                    <span className={`element-info-badge ${toTypeBadgeClass(elementDetails.type2)}`}>{elementDetails.type2}</span>
                                ) : null}
                            </div>
                        </div>

                        <span className="damage-details">
                            <span className="damage-label">Damage:</span>
                            <span className="damage-value">{elementDetails.damage}</span>
                        </span>

                        {effectLines.length > 0 ? (
                            <span className="effects-details">Effects:
                                {effectLines.map((line, lineIndex) => (
                                    <span
                                        key={`${line}-${lineIndex}`}
                                        className={`effect-chip ${getEffectChipClass(line)}`}
                                    >
                                        {line}
                                    </span>
                                ))}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    children
                )}
                {/* {elementDetails ? (
                    <>
                        <div className="element-info-title-row">
                            <div className="element-info-header">
                                <div className="drag-title">
                                    <span className="drag-title-icon">
                                        <ElementIcon name={elementDetails.letter} />
                                    </span>
                                    <span className="drag-title-name">{elementDetails.letter}</span>
                                </div>
                                <div className="right-info-header">
                                    <span className="element-info-badge">ELEMENT</span>
                                    <span className="element-info-badge">ELEMENT</span>
                                </div>
                            </div>
                            <div>{elementDetails.description}</div>
                        </div>
                        <div className="drag-damage-text">Damage: {elementDetails.damage}</div>
                        <div className="drag-type-text">
                            <span className="drag-type-label">Types:</span>
                            <span className="drag-type-list">
                                {types.length > 0 ? (
                                    types.map((type) => (
                                        <span key={type} className={`type-chip ${toTypeClass(type)}`}>
                                            {type}
                                        </span>
                                    ))
                                ) : (
                                    <span className="type-chip type-none">None</span>
                                )}
                            </span>
                        </div>
                        {effectLines.length > 0 ? (
                            <div className="drag-effect-text">
                                <span className="drag-effect-label">Effects:</span>
                                <span className="drag-effect-list">
                                    {effectLines.map((line, lineIndex) => (
                                        <span
                                            key={`${line}-${lineIndex}`}
                                            className={`effect-chip ${getEffectChipClass(line)}`}
                                        >
                                            {line}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        ) : null}
                    </>
                ) : (
                    children
                )} */}
            </div>

        </div>,
        document.body,
    );
}

export default FloatingTooltip;