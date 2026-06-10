import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import { EFFECTS as SK } from "../../combat/spellEffects";
import type { ElementEnhancements } from "../../context/PlayerContext";
import { statusEffectsRegistry } from "../../combat/statusEffectsRegistry";
import "./FloatingTooltip.scss";

type TooltipLayout = {
    left: number;
    top: number;
    offsetX: number;
    sideBySideOffsetX: number;
    sideBySideOffsetY: number;
    isBelow: boolean;
    width: number;
    height: number;
};

type FloatingTooltipProps = {
    anchorElement: HTMLElement | null;
    open: boolean;
    className: string;
    selected?: boolean;
    interactive?: boolean;
    onTooltipMouseEnter?: (event: MouseEvent<HTMLDivElement>) => void;
    onTooltipMouseLeave?: (event: MouseEvent<HTMLDivElement>) => void;
    children?: ReactNode;
    elementDetails?: {
        letter: string;
        damage: number;
        isDamageEnhanced?: boolean;
        baseDamageBeforeEnhance?: number;
        isCombusted?: boolean;
        baseDamageBeforeCombust?: number;
        energy?: number;
        baseEnergyBeforeCreation?: number;
        enhancements?: ElementEnhancements;
        description: string;
        type1?: string;
        type2?: string;
        effects?: SpellEffectConfig[];
        sourceEffects?: SpellEffectConfig[];
        level?: number;
        category?: string;
    };
    typeMultipliers?: Record<string, number>;
    offset?: number;
    viewportPadding?: number;
    clampHorizontal?: boolean;
};

const DEFAULT_LAYOUT: TooltipLayout = {
    left: 0,
    top: 0,
    offsetX: 0,
    sideBySideOffsetX: 0,
    sideBySideOffsetY: 0,
    isBelow: false,
    width: 0,
    height: 0,
};

const OVERLAP_PADDING_PX = 8;

type TooltipRect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

const rectsOverlap = (a: TooltipRect, b: TooltipRect) =>
    a.left < b.right - OVERLAP_PADDING_PX &&
    a.right > b.left + OVERLAP_PADDING_PX &&
    a.top < b.bottom - OVERLAP_PADDING_PX &&
    a.bottom > b.top + OVERLAP_PADDING_PX;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function FloatingTooltip({
    anchorElement,
    open,
    className,
    selected = false,
    interactive = false,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    children,
    elementDetails,
    typeMultipliers,
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
        const baseTop = isBelow ? anchorRect.bottom + offset : anchorRect.top - offset;

        let sideBySideOffsetX = 0;
        let sideBySideOffsetY = 0;

        if (selected && typeof document !== "undefined") {
            const selfElement = tooltipRef.current;
            const baseAbsoluteLeft = anchorCenterX - tooltipRect.width / 2 + offsetX;
            const baseAbsoluteTop = isBelow
                ? anchorRect.bottom + offset
                : anchorRect.top - offset - tooltipRect.height;
            const baseRect: TooltipRect = {
                left: baseAbsoluteLeft,
                right: baseAbsoluteLeft + tooltipRect.width,
                top: baseAbsoluteTop,
                bottom: baseAbsoluteTop + tooltipRect.height,
            };

            const selectedRects = Array.from(document.querySelectorAll<HTMLElement>(".floating-tooltip.is-selected"))
                .filter((element) => element !== selfElement)
                .map((element) => element.getBoundingClientRect())
                .filter((rect) => rect.width > 0 && rect.height > 0)
                .map((rect) => ({
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                }));

            const overlapTarget = selectedRects.find((rect) => rectsOverlap(baseRect, rect));
            if (overlapTarget) {
                const viewportRight = window.innerWidth - viewportPadding;
                const viewportBottom = window.innerHeight - viewportPadding;

                const rightCandidateLeft = overlapTarget.right + OVERLAP_PADDING_PX;
                const leftCandidateLeft = overlapTarget.left - tooltipRect.width - OVERLAP_PADDING_PX;

                const rightFits = rightCandidateLeft + tooltipRect.width <= viewportRight;
                const leftFits = leftCandidateLeft >= viewportPadding;

                let chosenLeft = rightCandidateLeft;
                if (!rightFits && leftFits) {
                    chosenLeft = leftCandidateLeft;
                } else if (!rightFits && !leftFits) {
                    chosenLeft = clamp(rightCandidateLeft, viewportPadding, Math.max(viewportPadding, viewportRight - tooltipRect.width));
                }

                const chosenTop = clamp(
                    overlapTarget.top,
                    viewportPadding,
                    Math.max(viewportPadding, viewportBottom - tooltipRect.height),
                );

                sideBySideOffsetX = chosenLeft - baseAbsoluteLeft;
                sideBySideOffsetY = chosenTop - baseAbsoluteTop;
            }
        }

        setLayout({
            left: anchorCenterX,
            top: baseTop,
            offsetX,
            sideBySideOffsetX,
            sideBySideOffsetY,
            isBelow,
            width: tooltipRect.width,
            height: tooltipRect.height,
        });
    }, [anchorElement, clampHorizontal, offset, selected, viewportPadding]);

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

    const effectKinds = (elementDetails?.effects ?? []).map((effect, index) => {
        const descriptor = effect.kind === SK.MULTI_HIT ? undefined : statusEffectsRegistry.get(effect.kind);
        const detail = statusEffectsRegistry.getEffectDetail(effect);
        const chipLabel = statusEffectsRegistry.getChipLabel(effect);

        return {
            key: `${effect.kind}-${index}`,
            label: chipLabel,
            detail,
            chipClass: effect.kind === SK.MULTI_HIT
                ? "effect-multi-hit"
                : (descriptor?.chipClass ?? "effect-default"),
        };
    });

    const sourceEffectKinds = (elementDetails?.sourceEffects ?? []).map((effect, index) => {
        const descriptor = effect.kind === SK.MULTI_HIT ? undefined : statusEffectsRegistry.get(effect.kind);
        const detail = statusEffectsRegistry.getEffectDetail(effect);
        const chipLabel = statusEffectsRegistry.getChipLabel(effect);

        return {
            key: `source-${effect.kind}-${index}`,
            label: chipLabel,
            detail,
            chipClass: effect.kind === SK.MULTI_HIT
                ? "effect-multi-hit"
                : (descriptor?.chipClass ?? "effect-default"),
        };
    });

    const effectSignature = (effects?: SpellEffectConfig[]) =>
        JSON.stringify((effects ?? []).map((effect) => ({
            kind: effect.kind,
            amount: effect.amount ?? null,
            duration: effect.duration ?? null,
            hits: effect.hits ?? null,
            target: effect.target ?? null,
            targetType: effect.targetType ?? null,
        })));

    const hasEffectDifference = Boolean(
        elementDetails?.sourceEffects &&
        effectSignature(elementDetails.sourceEffects) !== effectSignature(elementDetails.effects),
    );
    const shouldShowEffectDelta = hasEffectDifference;
    const showSourceNoneChip = shouldShowEffectDelta && sourceEffectKinds.length === 0 && effectKinds.length > 0;

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

    const primaryThemeType = elementDetails?.type1 ?? elementDetails?.type2;
    const isSpell = elementDetails?.category?.toLowerCase() === "spell";
    const isWeapon = elementDetails?.category?.toLowerCase() === "weapon";
    const primaryBadgeLabel = elementDetails?.category;
    const primaryBadgeClass = isSpell  ? "tooltip-badge-spell" : 
                              isWeapon ? "tooltip-badge-weapon" : "";

    const baseDamage = elementDetails?.damage ?? 0;
    const masteryMultiplier = elementDetails && typeMultipliers
        ? Math.max(
            ...[elementDetails.type1, elementDetails.type2]
                .filter((t): t is string => Boolean(t?.trim()))
                .map(t => typeMultipliers[t.trim().toLowerCase()] ?? 1),
            1,
        )
        : 1;
    const finalDamage = Math.round(baseDamage * masteryMultiplier);
    const masteryBonus = finalDamage - baseDamage;
    const hasEnhanceDamagePreview = Boolean(
        elementDetails?.isDamageEnhanced && typeof elementDetails.baseDamageBeforeEnhance === "number",
    );
    const enhancedDamageBefore = hasEnhanceDamagePreview
        ? Math.round((elementDetails?.baseDamageBeforeEnhance ?? 0) * masteryMultiplier)
        : 0;
    const hasCombustDamagePreview = Boolean(
        elementDetails?.isCombusted && typeof elementDetails.baseDamageBeforeCombust === "number",
    );
    const combustDamageBefore = hasCombustDamagePreview
        ? Math.round((elementDetails?.baseDamageBeforeCombust ?? 0) * masteryMultiplier)
        : 0;

    const enhancementItems = [
        { key: "purified", label: "Purified", active: Boolean(elementDetails?.enhancements?.purified) },
        { key: "polished", label: "Polished", active: Boolean(elementDetails?.enhancements?.polished) },
        { key: "cleansed", label: "Cleansed", active: Boolean(elementDetails?.enhancements?.cleansed) },
        { key: "refined", label: "Refined", active: Boolean(elementDetails?.enhancements?.refined) },
    ];

    return createPortal(
        <div
            ref={tooltipRef}
            className={`floating-tooltip ${className} ${layout.isBelow ? "is-below" : ""} ${selected ? "is-selected" : ""}`}
            onMouseEnter={onTooltipMouseEnter}
            onMouseLeave={onTooltipMouseLeave}
            style={{
                position: "absolute",
                left: layout.left,
                top: layout.top + layout.sideBySideOffsetY,
                marginLeft: `${-layout.width / 2 + layout.offsetX + layout.sideBySideOffsetX}px`,
                marginTop: layout.isBelow ? "0px" : `${-layout.height}px`,
                pointerEvents: interactive ? "auto" : "none",
                zIndex: 2147483647,
            }}
        >
            <div className={`floating-tooltip__panel ${elementDetails ? toTypeThemeClass(primaryThemeType) : ""}`}>
                {elementDetails ? (
                    <div className="tooltip-container">
                        {typeof elementDetails.energy === "number" ? (
                            <span
                                className={`element-energy-badge${typeof elementDetails.baseEnergyBeforeCreation === "number" ? " is-energy-delta" : ""}`}
                                aria-label={`Energy ${elementDetails.energy}`}
                            >
                                {typeof elementDetails.baseEnergyBeforeCreation === "number" ? (
                                    <>
                                        <span className="energy-value-before">{elementDetails.baseEnergyBeforeCreation}</span>
                                        <span className="energy-value-arrow" aria-hidden="true">➔</span>
                                        <span className="energy-value-after">{elementDetails.energy}</span>
                                    </>
                                ) : elementDetails.energy}
                                <span className="element-energy-badge-tooltip" role="tooltip">
                                    Energy required to use.
                                </span>
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
                            <span className={`damage-value${elementDetails.isDamageEnhanced ? " damage-value--enhanced" : ""}${elementDetails.isCombusted ? " damage-value--combusted" : ""}`}>
                                {hasEnhanceDamagePreview ? (
                                    <>
                                        <span className="damage-value-before">{enhancedDamageBefore}</span>
                                        <span className="damage-value-arrow" aria-hidden="true">➔</span>
                                        <span className="damage-value-after">{finalDamage}</span>
                                    </>
                                ) : hasCombustDamagePreview ? (
                                    <>
                                        <span className="damage-value-before">{combustDamageBefore}</span>
                                        <span className="damage-value-arrow" aria-hidden="true">➔</span>
                                        <span className="damage-value-after">{finalDamage}</span>
                                    </>
                                ) : finalDamage}
                            </span>
                        </span>
                        {masteryBonus > 0 ? (
                            <span className="damage-mastery-breakdown">
                                <span className="damage-base">base {baseDamage}</span>
                                <span className="damage-bonus">+{masteryBonus} mastery</span>
                            </span>
                        ) : null}

                        {(effectKinds.length > 0 || shouldShowEffectDelta) ? (
                            <span className="effects-details">Effects:
                                {shouldShowEffectDelta ? (
                                    <>
                                        {showSourceNoneChip ? (
                                            <span className="effect-chip effect-chip-none">none</span>
                                        ) : (
                                            sourceEffectKinds.map((effectKind) => (
                                                <span
                                                    key={effectKind.key}
                                                    className={`effect-chip ${effectKind.chipClass}`}
                                                >
                                                    {effectKind.label}
                                                    {effectKind.detail ? (
                                                        <span className="effect-chip-popup" role="tooltip">
                                                            {effectKind.detail}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            ))
                                        )}
                                        <span className="effects-delta-arrow" aria-hidden="true">➔</span>
                                        {effectKinds.length > 0 ? (
                                            effectKinds.map((effectKind) => (
                                                <span
                                                    key={`delta-${effectKind.key}`}
                                                    className={`effect-chip ${effectKind.chipClass}`}
                                                >
                                                    {effectKind.label}
                                                    {effectKind.detail ? (
                                                        <span className="effect-chip-popup" role="tooltip">
                                                            {effectKind.detail}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="effect-chip effect-chip-none">none</span>
                                        )}
                                    </>
                                ) : (
                                    effectKinds.map((effectKind) => (
                                        <span
                                            key={effectKind.key}
                                            className={`effect-chip ${effectKind.chipClass}`}
                                        >
                                            {effectKind.label}
                                            {effectKind.detail ? (
                                                <span className="effect-chip-popup" role="tooltip">
                                                    {effectKind.detail}
                                                </span>
                                            ) : null}
                                        </span>
                                    ))
                                )}
                            </span>
                        ) : null}
                        <div className="enhancements" aria-label="Enhancements">
                            {enhancementItems.map((item) => (
                                <span
                                    key={item.key}
                                    className={`enhancement-chip${item.active ? " is-active" : ""}`}
                                >
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : (
                    children
                )}
            </div>

        </div>,
        document.body,
    );
}

export default FloatingTooltip;