import type { RefObject } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import CombinationModePanel, { type ModeTabElementKey } from "./CombinationModePanel";
import CombinationResultPanel from "./CombinationResultPanel";
import "./CombinationStation.scss";

export type { ModeTabElementKey } from "./CombinationModePanel";

export type CombinationStationState = {
    key: "idle" | "cleanse" | "polish" | "purify" | "refine" | "enhance";
    actionLabel: string;
    elementKey?: string;
};

export type CombinationStationActionStateKey = Exclude<CombinationStationState["key"], "idle" | "enhance">;

export type CombinationStateWorkbookRow = {
    Element?: string;
    Effect?: string;
    ["Effect Amt"]?: string | number;
    ["Effect Hits"]?: string | number;
    ["Effect Dur"]?: string | number;
    ["Effect Target"]?: string;
};

export type CombinationStateEffectsLookup = Partial<Record<CombinationStationActionStateKey, Map<string, SpellEffectConfig[]>>>;

export const COMBINATION_STATE_WORKBOOK_PATHS: Record<CombinationStationActionStateKey, string> = {
    cleanse: "/cleanse.xlsx",
    polish: "/polish.xlsx",
    purify: "/purify.xlsx",
    refine: "/refine.xlsx",
};

const COMBINATION_STATION_STATE_BY_FIRST_ELEMENT: Record<string, CombinationStationState> = {
    fire: { key: "purify", actionLabel: "Purify", elementKey: "fire" },
    earth: { key: "refine", actionLabel: "Refine", elementKey: "earth" },
    water: { key: "cleanse", actionLabel: "Cleanse", elementKey: "water" },
    air: { key: "polish", actionLabel: "Polish", elementKey: "air" },
    soul: { key: "enhance", actionLabel: "Enhance", elementKey: "soul" },
};

const IDLE_COMBINATION_STATION_STATE: CombinationStationState = {
    key: "idle",
    actionLabel: "-",
};

export const getCombinationStationState = (firstSlotElementKey: string): CombinationStationState =>
    COMBINATION_STATION_STATE_BY_FIRST_ELEMENT[firstSlotElementKey] ?? IDLE_COMBINATION_STATION_STATE;

type CombinationStationProps = {
    zoneOccupants: Array<number | null>;
    hasStartedDraggingElement: boolean;
    hasSeenDropZoneOneTutorial: boolean;
    isInsertEnabled: boolean;
    isEnhanceCombinationReady: boolean;
    isNonEnhanceCombinationReady: boolean;
    firstSlotConnectorKey: string;
    hasActiveCombinationState: boolean;
    combinationStationState: CombinationStationState;
    canCombine: boolean;
    onCombine: () => void;
    dropZoneRefA: RefObject<HTMLDivElement>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    outputRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    hoveredInsertSlot: 1 | 2 | null;
    isCombineButtonHovered: boolean;
    onCombineButtonHoverChange: (isHovered: boolean) => void;
    onOutputHover: (hovered: boolean) => void;
    isModeInserted: boolean;
    shouldAnimateModeShutter: boolean;
    modeInsertedElementLetter?: string;
    modeInsertedElementCategory?: string;
    showModeInsertedElementOverlay: boolean;
    sealedModeElementKeys: ModeTabElementKey[];
    activeModeTabElementKey?: string;
    selectedModeTabElementKey: ModeTabElementKey | null;
    onModeTabSelect: (elementKey: ModeTabElementKey) => void;
    onInsertMode: () => void;
};

function CombinationStation({
    zoneOccupants,
    hasStartedDraggingElement,
    hasSeenDropZoneOneTutorial,
    isInsertEnabled,
    isEnhanceCombinationReady,
    isNonEnhanceCombinationReady,
    firstSlotConnectorKey,
    hasActiveCombinationState,
    combinationStationState,
    canCombine,
    onCombine,
    dropZoneRefA,
    dropZoneRefB,
    dropZoneRefC,
    outputRef,
    onHoverInsertSlot,
    hoveredInsertSlot,
    isCombineButtonHovered,
    onCombineButtonHoverChange,
    onOutputHover,
    isModeInserted,
    shouldAnimateModeShutter,
    modeInsertedElementLetter,
    modeInsertedElementCategory,
    showModeInsertedElementOverlay,
    sealedModeElementKeys,
    activeModeTabElementKey,
    selectedModeTabElementKey,
    onModeTabSelect,
    onInsertMode,
}: CombinationStationProps) {
    const combineButtonElementClass = hasActiveCombinationState && combinationStationState.elementKey
        ? `combine-button--${combinationStationState.elementKey}`
        : "";
    const slotConnectorClassName = [
        "slot-connector",
        "slot-connector--between",
        zoneOccupants[0] !== null ? "is-lit" : "",
        zoneOccupants[0] !== null ? `slot-connector--${firstSlotConnectorKey || "default"}` : "",
    ].filter((name) => name.length > 0).join(" ");
    const secondSlotConnectorClassName = [
        "slot-connector",
        "slot-connector--between",
        zoneOccupants[0] !== null && zoneOccupants[1] !== null ? "is-lit" : "",
        zoneOccupants[0] !== null && zoneOccupants[1] !== null ? "slot-connector--yellow" : "",
    ].filter((name) => name.length > 0).join(" ");
    const interPanelConnectorClassName = [
        "slot-connector",
        "slot-connector--between",
        "slot-connector--inter-panel",
        zoneOccupants[0] !== null ? "is-lit" : "",
        zoneOccupants[0] !== null ? `slot-connector--${firstSlotConnectorKey || "default"}` : "",
    ].filter((name) => name.length > 0).join(" ");
    const combinationStationClassName = [
        "combination-station",
        zoneOccupants[0] !== null ? "is-lit" : "",
        zoneOccupants[0] !== null ? `combination-station--${firstSlotConnectorKey || "default"}` : "",
    ].filter((name) => name.length > 0).join(" ");
    const panelModifierClass = zoneOccupants[0] !== null ? "is-lit" : "";
    const modeDropZoneClassName = `drop-zone ${hasStartedDraggingElement && !hasSeenDropZoneOneTutorial ? "is-discoverable" : ""} ${isEnhanceCombinationReady ? "is-enhance-ready-primary" : ""} ${isNonEnhanceCombinationReady ? "is-combination-ready-primary" : ""}`;
    const secondaryDropZoneClassName = `drop-zone ${isEnhanceCombinationReady ? "is-enhance-ready-secondary" : ""} ${isNonEnhanceCombinationReady ? "is-combination-ready-secondary" : ""}`;
    const isCombineButtonDisabled = !canCombine || !hasActiveCombinationState;
    const shouldShowSlotOneInsertPrompt = (hoveredInsertSlot === 1 && zoneOccupants[0] === null)
        || (isCombineButtonHovered && hoveredInsertSlot === null && zoneOccupants[0] === null);
    const shouldShowSlotTwoInsertPrompt = (hoveredInsertSlot === 2 && zoneOccupants[1] === null)
        || (isCombineButtonHovered && hoveredInsertSlot === null && zoneOccupants[0] !== null && zoneOccupants[1] === null);

    return (
        <div className={combinationStationClassName}>
            <div className="combination-equation">
                <CombinationModePanel
                    className={panelModifierClass}
                    dropZoneClassName={modeDropZoneClassName}
                    dropZoneRefA={dropZoneRefA}
                    onHoverInsertSlot={onHoverInsertSlot}
                    shouldShowSlotOneInsertPrompt={shouldShowSlotOneInsertPrompt}
                    isInsertEnabled={isInsertEnabled}
                    isModeInserted={isModeInserted}
                    shouldAnimateModeShutter={shouldAnimateModeShutter}
                    modeInsertedElementLetter={modeInsertedElementLetter}
                    modeInsertedElementCategory={modeInsertedElementCategory}
                    showModeInsertedElementOverlay={showModeInsertedElementOverlay}
                    sealedModeElementKeys={sealedModeElementKeys}
                    hasSelectedModeTab={selectedModeTabElementKey !== null}
                    activeModeTabElementKey={combinationStationState.elementKey}
                    onModeTabSelect={onModeTabSelect}
                    onInsertMode={onInsertMode}
                />
                <div className={`combination-result-group ${isModeInserted ? "" : "is-hidden"}`.trim()}>
                <div className={interPanelConnectorClassName} aria-hidden="true" />

                <CombinationResultPanel
                    className={panelModifierClass}
                    secondaryDropZoneClassName={secondaryDropZoneClassName}
                    secondSlotConnectorClassName={secondSlotConnectorClassName}
                    combineButtonElementClass={combineButtonElementClass}
                    isCombineButtonDisabled={isCombineButtonDisabled}
                    combineActionLabel={combinationStationState.actionLabel}
                    zoneOccupants={zoneOccupants}
                    dropZoneRefB={dropZoneRefB}
                    dropZoneRefC={dropZoneRefC}
                    outputRef={outputRef}
                    onHoverInsertSlot={onHoverInsertSlot}
                    onCombineButtonHoverChange={onCombineButtonHoverChange}
                    onCombine={onCombine}
                    shouldShowSlotTwoInsertPrompt={shouldShowSlotTwoInsertPrompt}
                    onOutputHover={onOutputHover}
                />
                </div>
            </div>
        </div>
    );
}

export default CombinationStation;