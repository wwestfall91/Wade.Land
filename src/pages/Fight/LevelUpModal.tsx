import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import type { RewardElement } from "../../context/PlayerContext";
import ElementIcon from "../../components/ElementIcon";
import ElementDetailsTooltip from "../../components/ElementDetailsTooltip";
import { STARTER_BUTTON_THEME_BY_TYPE, STARTER_BUTTON_THEME_DEFAULT } from "../../styles/elementThemes";
import "./LevelUpModal.scss";

type LevelUpModalProps = {
    elementLetter: string;
    elementType1?: string;
    elementType2?: string;
    elementPreview: RewardElement;
    choices: SpellEffectConfig[];
    onConfirm: (choice: SpellEffectConfig) => void;
};

const formatEffectKind = (kind: string): string =>
    kind.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const formatEffectStats = (effect: SpellEffectConfig): string => {
    const parts: string[] = [];
    if (effect.amount != null) parts.push(`${effect.amount}`);
    if (effect.duration != null) parts.push(`${effect.duration} turns`);
    return parts.join(" / ");
};

export function LevelUpModal({ elementLetter, elementType1, elementType2, elementPreview, choices, onConfirm }: LevelUpModalProps) {
    const [selected, setSelected] = useState<SpellEffectConfig | null>(
        choices.length === 1 ? choices[0] : null,
    );
    const [hoveredChoiceIndex, setHoveredChoiceIndex] = useState<number | null>(null);
    const choiceButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

    const handleConfirm = () => {
        if (selected) onConfirm(selected);
    };

    const normalizedType1 = elementType1?.trim().toLowerCase();
    const normalizedType2 = elementType2?.trim().toLowerCase();
    const theme =
        (normalizedType1 ? STARTER_BUTTON_THEME_BY_TYPE[normalizedType1] : undefined) ??
        (normalizedType2 ? STARTER_BUTTON_THEME_BY_TYPE[normalizedType2] : undefined) ??
        STARTER_BUTTON_THEME_DEFAULT;
    const activeType = normalizedType1 ?? normalizedType2 ?? null;
    const usesLightPanelText = activeType === "air" || activeType === "light" || activeType === "water" || activeType === "ice";

    const hoveredEffect = hoveredChoiceIndex !== null ? choices[hoveredChoiceIndex] : null;
    const previewEffects = hoveredEffect ? [...(elementPreview.effects ?? []), hoveredEffect] : undefined;
    const previewElement = hoveredEffect
        ? {
            ...elementPreview,
            effects: previewEffects,
        }
        : null;
    const highlightedEffectKey = hoveredEffect && previewEffects
        ? `${hoveredEffect.kind}-${previewEffects.length - 1}`
        : undefined;

    return createPortal(
        <>
            <div className="levelup-overlay">
                <div
                    className="levelup-menu"
                    style={{
                        ["--levelup-top" as string]: theme.top,
                        ["--levelup-bottom" as string]: theme.bottom,
                        ["--levelup-border" as string]: theme.border,
                        ["--levelup-text" as string]: theme.text,
                        ["--levelup-glow" as string]: theme.glow,
                        ["--levelup-ink" as string]: usesLightPanelText ? "#10202b" : "#f7f9ff",
                        ["--levelup-shadow" as string]: usesLightPanelText ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.6)",
                    }}
                >
                    <div className="levelup-element-icon" aria-hidden="true">
                        <ElementIcon name={elementLetter} className="levelup-element-icon-image" alt={elementLetter} />
                    </div>
                    <h2 className="levelup-title">Level Up!</h2>
                    <h3 className="levelup-section-title">Select a New Effect!</h3>

                    <div className="levelup-choices">
                        {choices.map((effect, index) => (
                            <button
                                key={index}
                                ref={(button) => {
                                    choiceButtonRefs.current[index] = button;
                                }}
                                className={`levelup-choice${selected === effect ? " is-selected" : ""}`}
                                onClick={() => setSelected(effect)}
                                onMouseEnter={() => setHoveredChoiceIndex(index)}
                                onMouseLeave={() => setHoveredChoiceIndex((current) => (current === index ? null : current))}
                                onFocus={() => setHoveredChoiceIndex(index)}
                                onBlur={() => setHoveredChoiceIndex((current) => (current === index ? null : current))}
                            >
                                <span className="levelup-choice-kind">{formatEffectKind(effect.kind)}</span>
                                {(effect.shortDescription) ? (
                                    <span className="levelup-choice-desc">{effect.shortDescription}</span>
                                ) : null}
                                <span className="levelup-choice-stats">{formatEffectStats(effect)}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        className="levelup-confirm"
                        disabled={!selected}
                        onClick={handleConfirm}
                    >
                        Confirm
                    </button>
                </div>
            </div>
            {previewElement && hoveredChoiceIndex !== null ? (
                <ElementDetailsTooltip
                    element={previewElement}
                    anchorElement={choiceButtonRefs.current[hoveredChoiceIndex]}
                    open
                    highlightedEffectKey={highlightedEffectKey}
                    className="reward-element-tooltip-shell"
                />
            ) : null}
        </>,
        document.body,
    );
}
