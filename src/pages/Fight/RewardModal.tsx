import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePlayer, type RewardElement } from "../../context/PlayerContext";
import ElementIcon from "../../components/ElementIcon";
import ElementDetailsTooltip from "../../components/ElementDetailsTooltip";
import soulIcon from "../../assets/icons/Soul.png";
import "./RewardModal.scss";

type RewardModalProps = {
    soulsGained: number;
    rewardElements: RewardElement[];
    onConfirm: (element: RewardElement) => void;
};

function RewardModal({ soulsGained, rewardElements, onConfirm }: RewardModalProps) {
    const { player } = usePlayer();
    const [selectedElement, setSelectedElement] = useState<RewardElement | null>(null);
    const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
    const [hoveredCurrentElementId, setHoveredCurrentElementId] = useState<number | null>(null);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const currentElementRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const [isClosing, setIsClosing] = useState(false);
    const closeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            if (closeTimeoutRef.current !== null) {
                window.clearTimeout(closeTimeoutRef.current);
            }
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const handleConfirm = () => {
        if (!selectedElement || isClosing) {
            return;
        }

        setIsClosing(true);
        closeTimeoutRef.current = window.setTimeout(() => {
            onConfirm(selectedElement);
        }, 180);
    };

    const modal = (
        <>
            <div
                className={`reward-menu-overlay${isClosing ? " is-closing" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Reward selection"
            >
                <div className={`reward-menu${isClosing ? " is-closing" : ""}`}>
                    {soulsGained >  0 && 
                        <div className="reward-souls-section">
                            <div className="reward-souls-gained">
                                <img src={soulIcon} alt="" aria-hidden="true" className="reward-souls-icon" />
                                <span>+{soulsGained} Souls</span>
                            </div>
                        </div>
                    }
                    <h2 className="reward-title">Pick 1 Element!</h2>
                    <div className="reward-elements">
                        {rewardElements.map((element) => (
                            <button
                                key={element.letter}
                                ref={el => (buttonRefs.current[element.letter] = el)}
                                type="button"
                                className={`reward-element${selectedElement?.letter === element.letter ? " is-selected" : ""}`}
                                onClick={() => setSelectedElement(element)}
                                onMouseEnter={e => {
                                    setHoveredLetter(element.letter);
                                }}
                                onMouseLeave={() => {
                                    setHoveredLetter(current => (current === element.letter ? null : current));
                                }}
                            >
                                <span className="reward-element-letter"><ElementIcon name={element.letter} /></span>
                                <span className="reward-element-damage">{element.damage} DMG</span>
                            </button>
                        ))}
                    </div>
                    {player.elements.length > 0 && 
                    <>
                        <section className="reward-current-elements" aria-label="Current spells">
                            <h3 className="reward-current-elements-title">Your Elements</h3>
                            <div className="reward-current-elements-list">
                                {player.elements.length > 0 ? (
                                    player.elements.map((element) => (
                                        <div
                                            key={element.id}
                                            ref={(el) => {
                                                currentElementRefs.current[element.id] = el;
                                            }}
                                            className="reward-current-element"
                                            onMouseEnter={() => setHoveredCurrentElementId(element.id)}
                                            onMouseLeave={() => {
                                                setHoveredCurrentElementId((current) => (
                                                    current === element.id ? null : current
                                                ));
                                            }}
                                        >
                                            <span className="reward-current-element-letter"><ElementIcon name={element.letter} /></span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="reward-current-empty">Nothing.</p>
                                )}
                            </div>
                        </section>
                    </>
                    }
                    

                    <button
                        type="button"
                        className="reward-return-button"
                        disabled={!selectedElement || isClosing}
                        onClick={handleConfirm}
                    >
                        CONTINUE
                    </button>
                </div>
            </div>
            {hoveredLetter ? (() => {
                const element = rewardElements.find(e => e.letter === hoveredLetter);
                if (!element) return null;
                return (
                    <ElementDetailsTooltip
                        element={element}
                        anchorElement={buttonRefs.current[hoveredLetter]}
                        open={Boolean(hoveredLetter)}
                        className="reward-element-tooltip-shell"
                    />
                );
            })() : null}
            {hoveredCurrentElementId !== null ? (() => {
                const element = player.elements.find((entry) => entry.id === hoveredCurrentElementId);
                if (!element) return null;
                return (
                    <ElementDetailsTooltip
                        element={element}
                        anchorElement={currentElementRefs.current[hoveredCurrentElementId]}
                        open
                        className="reward-element-tooltip-shell"
                    />
                );
            })() : null}
        </>
    );

    return createPortal(modal, document.body);
}

export default RewardModal;
