import type { RefObject } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import "./CombinationStation.scss";

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

type CombineStationTooltipProps = {
    message: string;
    className?: string;
};

const CombineStationTooltip = ({ message, className = "" }: CombineStationTooltipProps) => (
    <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
        {message}
    </div>
);

type CombinationModePanelProps = {
    className: string;
    dropZoneClassName: string;
    dropZoneRefA: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowSlotOneInsertPrompt: boolean;
};

const CombinationModePanel = ({
    className,
    dropZoneClassName,
    dropZoneRefA,
    onHoverInsertSlot,
    shouldShowSlotOneInsertPrompt,
}: CombinationModePanelProps) => (
    <div className={className}>
        <div className="drop-zone-area">
            <div
                className={dropZoneClassName}
                ref={dropZoneRefA}
                onMouseEnter={() => {
                    onHoverInsertSlot(1);
                }}
                onMouseLeave={() => {
                    onHoverInsertSlot(null);
                }}
            >
                Mode
                {shouldShowSlotOneInsertPrompt ? (
                    <CombineStationTooltip
                        className="combine-station-tooltip--slot-one"
                        message="Please insert element"
                    />
                ) : null}
            </div>
        </div>
    </div>
);

type CombinationResultPanelProps = {
    className: string;
    secondaryDropZoneClassName: string;
    secondSlotConnectorClassName: string;
    zoneOccupants: Array<number | null>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    outputRef: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowSlotTwoInsertPrompt: boolean;
    onOutputHover: (hovered: boolean) => void;
};

const CombinationResultPanel = ({
    className,
    secondaryDropZoneClassName,
    secondSlotConnectorClassName,
    zoneOccupants,
    dropZoneRefB,
    dropZoneRefC,
    outputRef,
    onHoverInsertSlot,
    shouldShowSlotTwoInsertPrompt,
    onOutputHover,
}: CombinationResultPanelProps) => (
    <div className={className}>
        <div className="drop-zone-area">
            <div
                className={secondaryDropZoneClassName}
                ref={dropZoneRefB}
                onMouseEnter={() => {
                    onHoverInsertSlot(2);
                }}
                onMouseLeave={() => {
                    onHoverInsertSlot(null);
                }}
            >
                Element
                {shouldShowSlotTwoInsertPrompt ? (
                    <CombineStationTooltip
                        className="combine-station-tooltip--slot-two"
                        message="Please insert element"
                    />
                ) : null}
            </div>
            {zoneOccupants.length === 3 ? (
                <div className="drop-zone" ref={dropZoneRefC}>3</div>
            ) : null}
            <div className={secondSlotConnectorClassName} aria-hidden="true" />
            <div
                className="output"
                ref={outputRef}
                onMouseEnter={() => onOutputHover(true)}
                onMouseLeave={() => onOutputHover(false)}
            />
        </div>
    </div>
);

type CombinationStationProps = {
    zoneOccupants: Array<number | null>;
    hasStartedDraggingElement: boolean;
    hasSeenDropZoneOneTutorial: boolean;
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
};

function CombinationStation({
    zoneOccupants,
    hasStartedDraggingElement,
    hasSeenDropZoneOneTutorial,
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
    const combinationEquationPanelClassName = [
        "combination-equation-panel",
        zoneOccupants[0] !== null ? "is-lit" : "",
        zoneOccupants[0] !== null ? `combination-equation-panel--${firstSlotConnectorKey || "default"}` : "",
    ].filter((name) => name.length > 0).join(" ");
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
                    className={`${combinationEquationPanelClassName} combination-equation-panel--mode`}
                    dropZoneClassName={modeDropZoneClassName}
                    dropZoneRefA={dropZoneRefA}
                    onHoverInsertSlot={onHoverInsertSlot}
                    shouldShowSlotOneInsertPrompt={shouldShowSlotOneInsertPrompt}
                />
                <div className={interPanelConnectorClassName} aria-hidden="true" />

                <CombinationResultPanel
                    className={`${combinationEquationPanelClassName} combination-equation-panel--result`}
                    secondaryDropZoneClassName={secondaryDropZoneClassName}
                    secondSlotConnectorClassName={secondSlotConnectorClassName}
                    zoneOccupants={zoneOccupants}
                    dropZoneRefB={dropZoneRefB}
                    dropZoneRefC={dropZoneRefC}
                    outputRef={outputRef}
                    onHoverInsertSlot={onHoverInsertSlot}
                    shouldShowSlotTwoInsertPrompt={shouldShowSlotTwoInsertPrompt}
                    onOutputHover={onOutputHover}
                />
            </div>
            <div
                className={`combine-button-wrap ${isCombineButtonDisabled ? "is-disabled" : ""}`}
                onMouseEnter={() => {
                    onCombineButtonHoverChange(true);
                }}
                onMouseLeave={() => {
                    onCombineButtonHoverChange(false);
                }}
                onFocusCapture={() => {
                    onCombineButtonHoverChange(true);
                }}
                onBlurCapture={() => {
                    onCombineButtonHoverChange(false);
                }}
            >
                <button
                    className={`combine-button ${combineButtonElementClass}`.trim()}
                    disabled={isCombineButtonDisabled}
                    onClick={onCombine}
                >
                    {combinationStationState.actionLabel}
                </button>
            </div>
        </div>
    );
}

export default CombinationStation;