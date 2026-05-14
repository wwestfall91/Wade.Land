import { useRef, useState } from "react";
import { getEffectChipClass, getEffectSummaryLines } from "../../combat/effectSummary";
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
