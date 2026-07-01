import { useCallback, useMemo, useRef } from "react";
import { usePlayer } from "../../context/PlayerContext";
import Draggable from "./Draggable";
import ElementIcon from "../../components/ElementIcon";
import "./SpellSlots.scss";

type SpellSlotsProps = {
    containerRef: React.RefObject<HTMLDivElement>;
};

export function SpellSlots({ containerRef }: SpellSlotsProps) {
    const {
        player,
        spellSlots,
        setSpellSlotElement,
        addSpellSlot,
    } = usePlayer();

    const dropZoneRefs = useRef<Array<React.RefObject<HTMLDivElement>>>(
        spellSlots.map(() => ({ current: null })),
    );

    // Sync refs array length with spell slots count
    if (dropZoneRefs.current.length !== spellSlots.length) {
        dropZoneRefs.current = spellSlots.map((_, i) => dropZoneRefs.current[i] ?? { current: null });
    }

    const canSnapToZone = useCallback(
        (draggableId: number, zoneIndex: number) => {
            // Can only snap to valid zone indices
            return zoneIndex >= 0 && zoneIndex < spellSlots.length;
        },
        [spellSlots.length],
    );

    const handleSnapChange = useCallback(
        (draggableId: number, zoneIndex: number | null) => {
            if (zoneIndex === null) {
                // Element was removed from all zones
                for (let i = 0; i < spellSlots.length; i++) {
                    if (spellSlots[i] === draggableId) {
                        setSpellSlotElement(i, null);
                        break;
                    }
                }
            } else {
                // Element snapped to a zone
                // First, remove it from any other slots it was in
                for (let i = 0; i < spellSlots.length; i++) {
                    if (spellSlots[i] === draggableId) {
                        setSpellSlotElement(i, null);
                        break;
                    }
                }
                // Then add it to the new slot
                setSpellSlotElement(zoneIndex, draggableId);
            }
        },
        [spellSlots, setSpellSlotElement],
    );

    const spellSlotElements = useMemo(
        () => spellSlots.map((elementId) => {
            if (elementId === null) return null;
            return player.elements.find((el) => el.id === elementId) ?? null;
        }),
        [spellSlots, player.elements],
    );

    const slottedElementIds = new Set(spellSlots.filter((id): id is number => id !== null));
    const draggableElements = player.elements.filter((el) => !slottedElementIds.has(el.id));

    return (
        <div className="spell-slots-section">
            <div className="spell-slots-header">
                <span className="spell-slots-label">SPELL SLOTS</span>
                <button
                    className="spell-slots-add-button"
                    onClick={addSpellSlot}
                    title="Add a new spell slot"
                    aria-label="Add a new spell slot"
                >
                    +
                </button>
            </div>

            <div className="spell-slots-container">
                {spellSlots.map((elementId, slotIndex) => {
                    const element = spellSlotElements[slotIndex];
                    const initialPosition = { x: 0, y: 0 };

                    return (
                        <div
                            key={`spell-slot-${slotIndex}`}
                            className="spell-slot"
                            ref={dropZoneRefs.current[slotIndex]}
                        >
                            {element ? (
                                <Draggable
                                    id={element.id}
                                    letter={element.letter}
                                    damage={element.damage}
                                    shield={element.shield}
                                    energy={element.energy}
                                    enhancements={element.enhancements}
                                    description={element.description}
                                    type1={element.type1}
                                    type2={element.type2}
                                    effects={element.effects}
                                    level={element.level}
                                    category={element.category}
                                    containerRef={containerRef}
                                    dropZoneRefs={dropZoneRefs.current}
                                    initialPosition={initialPosition}
                                    onSnapChange={handleSnapChange}
                                    canSnapToZone={canSnapToZone}
                                />
                            ) : (
                                <div className="spell-slot-empty">
                                    <span className="spell-slot-empty-text">Drag element here</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
