import { useRef, useState } from "react";
import type { RewardElement } from "../../context/PlayerContext";
import FloatingTooltip from "./FloatingTooltip";
import "./StartMenuModal.scss";

type StartMenuModalProps = {
    choices: RewardElement[];
    selected: RewardElement | null;
    onSelect: (element: RewardElement) => void;
    onConfirm: () => void;
};

function StartMenuModal({ choices, selected, onSelect, onConfirm }: StartMenuModalProps) {
    const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const getEffectSummaryLines = (effects: RewardElement["effects"]) => {
        const lines: string[] = [];
        const normalizedEffects = effects ?? [];

        const multiHit = normalizedEffects.find((effect) => effect.kind === "multi_hit");
        if (multiHit?.hits && multiHit.hits > 1) {
            lines.push(`Hits: ${multiHit.hits}x`);
        }

        normalizedEffects.forEach((effect) => {
            switch (effect.kind) {
                case "heal": {
                    const amount = Math.max(0, effect.amount ?? 0);
                    if (amount > 0) {
                        lines.push(`Heal: +${amount}`);
                    }
                    break;
                }
                case "burn": {
                    const amount = Math.max(0, effect.amount ?? 0);
                    const duration = Math.max(1, effect.duration ?? 1);
                    if (amount > 0) {
                        lines.push(`Burn: +${amount} for ${duration} turns`);
                    }
                    break;
                }
                case "shield": {
                    const amount = Math.max(0, effect.amount ?? 0);
                    if (amount > 0) {
                        lines.push(`Shield: +${amount}`);
                    }
                    break;
                }
                case "lifesteal": {
                    const amount = Math.max(0, effect.amount ?? 0);
                    if (amount > 0) {
                        const percent = amount > 1 ? amount : Math.round(amount * 100);
                        lines.push(`Lifesteal: ${percent}%`);
                    }
                    break;
                }
                case "soak": {
                    const amount = Math.max(1, effect.amount ?? 1);
                    lines.push(`Soak: +${amount}`);
                    break;
                }
                default:
                    break;
            }
        });

        return lines;
    };

    const getEffectChipClass = (line: string): string => {
        if (line.startsWith("Heal:")) {
            return "effect-heal";
        }
        if (line.startsWith("Burn:")) {
            return "effect-burn";
        }
        if (line.startsWith("Shield:")) {
            return "effect-shield";
        }
        if (line.startsWith("Lifesteal:")) {
            return "effect-lifesteal";
        }
        if (line.startsWith("Soak:")) {
            return "effect-soak";
        }
        if (line.startsWith("Hits:")) {
            return "effect-multi-hit";
        }

        return "effect-default";
    };

    return (
        <>
            <div className="start-menu-overlay">
                <div className="start-menu">
                    <h2 className="start-menu-title">Pick a Element!</h2>
                    <div className="start-menu-elements">
                        {choices.map((element) => (
                            <button
                                key={element.letter}
                                ref={el => (buttonRefs.current[element.letter] = el)}
                                type="button"
                                className={`start-menu-element${selected?.letter === element.letter ? " is-selected" : ""}`}
                                onClick={() => onSelect(element)}
                                onMouseEnter={e => {
                                    setHoveredLetter(element.letter);
                                }}
                                onMouseLeave={() => {
                                    setHoveredLetter(current => (current === element.letter ? null : current));
                                }}
                            >
                                <span className="start-menu-element-letter">{element.letter}</span>
                                <span className="start-menu-element-damage">{element.damage} DMG</span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="start-menu-confirm"
                        disabled={!selected}
                        onClick={onConfirm}
                    >
                        BEGIN
                    </button>
                </div>
            </div>
            {hoveredLetter ? (() => {
                const element = choices.find(e => e.letter === hoveredLetter);
                if (!element) return null;

                const elementTypes = [element.type1, element.type2].filter(
                    (value): value is string => Boolean(value && value.trim().length > 0),
                );
                const effectLines = getEffectSummaryLines(element.effects);

                return (
                    <FloatingTooltip
                        anchorElement={buttonRefs.current[hoveredLetter]}
                        open={Boolean(hoveredLetter)}
                        className="start-menu-element-tooltip-shell"
                    >
                        <div className="start-menu-element-info">
                            {element.description.length > 0 ? (
                                <span className="element-info-description">{element.description}</span>
                            ) : null}
                            <span className="element-info-damage">Damage: {element.damage}</span>
                            <span className="element-info-types">
                                <span className="element-info-label">Types:</span>
                                <span className="element-info-list">
                                    {elementTypes.length > 0 ? (
                                        elementTypes.map((type) => (
                                            <span key={type} className={`type-chip ${toTypeClass(type)}`}>
                                                {type}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="type-chip type-none">None</span>
                                    )}
                                </span>
                            </span>
                            {effectLines.length > 0 ? (
                                <span className="element-info-effects">
                                    <span className="element-info-label">Effects:</span>
                                    <span className="element-info-list">
                                        {effectLines.map((line, index) => (
                                            <span key={`${line}-${index}`} className={`effect-chip ${getEffectChipClass(line)}`}>
                                                {line}
                                            </span>
                                        ))}
                                    </span>
                                </span>
                            ) : null}
                        </div>
                    </FloatingTooltip>
                );
            })() : null}
        </>
    );
}

export default StartMenuModal;
