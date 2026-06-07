import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import { statusEffectsRegistry } from "../../combat/statusEffectsRegistry";
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
    isBelow: false,
    width: 0,
    height: 0,
};

function FloatingTooltip({
    anchorElement,
    open,
    className,
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

    const effectKinds = (elementDetails?.effects ?? []).map((effect, index) => {
        const descriptor = effect.kind === "multi_hit" ? undefined : statusEffectsRegistry.get(effect.kind);
        const detail = statusEffectsRegistry.getEffectDetail(effect);
        const chipLabel = statusEffectsRegistry.getChipLabel(effect);

        return {
            key: `${effect.kind}-${index}`,
            label: chipLabel,
            detail,
            chipClass: effect.kind === "multi_hit"
                ? "effect-multi-hit"
                : (descriptor?.chipClass ?? "effect-default"),
        };
    });

    const sourceEffectKinds = (elementDetails?.sourceEffects ?? []).map((effect, index) => {
        const descriptor = effect.kind === "multi_hit" ? undefined : statusEffectsRegistry.get(effect.kind);
        const detail = statusEffectsRegistry.getEffectDetail(effect);
        const chipLabel = statusEffectsRegistry.getChipLabel(effect);

        return {
            key: `source-${effect.kind}-${index}`,
            label: chipLabel,
            detail,
            chipClass: effect.kind === "multi_hit"
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

    return createPortal(
        <div
            ref={tooltipRef}
            className={`floating-tooltip ${className} ${layout.isBelow ? "is-below" : ""}`}
            onMouseEnter={onTooltipMouseEnter}
            onMouseLeave={onTooltipMouseLeave}
            style={{
                position: "absolute",
                left: layout.left,
                top: layout.top,
                marginLeft: `${-layout.width / 2 + layout.offsetX}px`,
                marginTop: layout.isBelow ? "0px" : `${-layout.height}px`,
                pointerEvents: interactive ? "auto" : "none",
                zIndex: 2147483647,
            }}
        >
            <div className={`floating-tooltip__panel ${elementDetails ? toTypeThemeClass(primaryThemeType) : ""}`}>
                {elementDetails ? (
                    <div className="tooltip-container">
                        {typeof elementDetails.energy === "number" ? (
                            <span className="element-energy-badge" aria-label={`Energy ${elementDetails.energy}`}>
                                {elementDetails.energy}
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