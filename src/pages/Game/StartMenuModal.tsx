import type { RewardElement } from "../../context/PlayerContext";
import "./StartMenuModal.scss";

type StartMenuModalProps = {
    choices: RewardElement[];
    selected: RewardElement | null;
    onSelect: (element: RewardElement) => void;
    onConfirm: () => void;
};

function StartMenuModal({ choices, selected, onSelect, onConfirm }: StartMenuModalProps) {
    return (
        <div className="start-menu-overlay">
            <div className="start-menu">
                <h2 className="start-menu-title">Pick a Element!</h2>
                <div className="start-menu-elements">
                    {choices.map((element) => (
                        <button
                            key={element.letter}
                            type="button"
                            className={`start-menu-element${selected?.letter === element.letter ? " is-selected" : ""}`}
                            onClick={() => onSelect(element)}
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
    );
}

export default StartMenuModal;
