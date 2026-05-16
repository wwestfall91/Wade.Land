import { useRef, useState } from "react";
import type { RewardElement } from "../../context/PlayerContext";
import ElementIcon from "../../components/ElementIcon";
import ElementDetailsTooltip from "../../components/ElementDetailsTooltip";
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
                                <div className="start-menu-element-name">{element.letter}</div>
                                <span className="start-menu-element-letter"><ElementIcon name={element.letter} /></span>
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
                return (
                    <ElementDetailsTooltip
                        element={element}
                        anchorElement={buttonRefs.current[hoveredLetter]}
                        open={Boolean(hoveredLetter)}
                        className="start-menu-element-tooltip-shell"
                    />
                );
            })() : null}
        </>
    );
}

export default StartMenuModal;
