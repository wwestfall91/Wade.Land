import { useEffect, useState, type RefObject } from "react";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import ElementIcon from "../../components/ElementIcon";
import CombinationModePanel, { MODE_TAB_ORDER, type ModeTabElementKey } from "./CombinationModePanel";
import CombinationLogicPanel from "./CombinationLogicPanel";
import CombinationResultPanel from "./CombinationResultPanel";
import ModeUnlockPanel from "./ModeUnlockPanel";
import { combinationStationRulesEngine } from "./CombinationStationRulesEngine";
import "./CombinationStation.scss";

export type { ModeTabElementKey } from "./CombinationModePanel";

export type CombinationStationState = {
    key: "idle" | "mix" | "incubate" | "divide" | "refine" | "duplicate";
    actionLabel: string;
    elementKey?: string;
};

export type CombinationStationActionStateKey = Exclude<CombinationStationState["key"], "idle" | "duplicate">;

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
    mix: "/mix.xlsx",
    incubate: "/incubate.xlsx",
    divide: "/divide.xlsx",
    refine: "/refine.xlsx",
};

const COMBINATION_STATION_STATE_BY_FIRST_ELEMENT: Record<string, CombinationStationState> = {
    fire: { key: "incubate", actionLabel: "Incubate", elementKey: "fire" },
    earth: { key: "refine", actionLabel: "Refine", elementKey: "earth" },
    water: { key: "mix", actionLabel: "Mix", elementKey: "water" },
    air: { key: "divide", actionLabel: "Divide", elementKey: "air" },
    soul: { key: "duplicate", actionLabel: "Duplicate", elementKey: "soul" },
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
    isDuplicateCombinationReady: boolean;
    isNonDuplicateCombinationReady: boolean;
    firstSlotConnectorKey: string;
    hasActiveCombinationState: boolean;
    combinationStationState: CombinationStationState;
    canCombine: boolean;
    onCombine: () => void;
    dropZoneRefA: RefObject<HTMLDivElement>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    outputRef: RefObject<HTMLDivElement>;
    outputRef2: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    hoveredInsertSlot: 1 | 2 | null;
    isCombineButtonHovered: boolean;
    onCombineButtonHoverChange: (isHovered: boolean) => void;
    onOutputHover: (hovered: boolean) => void;
    onOutputHover2: (hovered: boolean) => void;
    hasOutputElementInSlot: boolean;
    isModeInserted: boolean;
    isModeCollapseAnimating: boolean;
    shouldAnimateModeShutter: boolean;
        modeUsesRemaining: number;
    modeInsertedElementLetter?: string;
    modeInsertedElementCategory?: string;
    showModeInsertedElementOverlay: boolean;
    sealedModeElementKeys: ModeTabElementKey[];
    activeModeTabElementKey?: string;
    selectedModeTabElementKey: ModeTabElementKey | null;
    onModeTabSelect: (elementKey: ModeTabElementKey) => void;
    onInsertMode: () => void;
    incubateCounter: number;
    refineCounter: number;
    onIncubateCounterChange: (value: number) => void;
    onRefineCounterChange: (value: number) => void;
    pendingJobElement: { letter: string; category?: string } | null;
    isSlotAnimatingClose: boolean;
    isSlotAnimatingOpen: boolean;
    isOutputSlotClosed: boolean;
    isOutputSlotAnimatingClose: boolean;
    isOutputSlotAnimatingOpen: boolean;
    lockedModes: Set<string>;
    unlockSlotRefs: [RefObject<HTMLDivElement>, RefObject<HTMLDivElement>, RefObject<HTMLDivElement>];
    unlockSlotOccupants: [number | null, number | null, number | null];
    getUnlockSlotLetter: (id: number) => string | undefined;
    isUnlockReady: boolean;
    onUnlock: () => void;
};

function CombinationStation({
    zoneOccupants,
    hasStartedDraggingElement,
    hasSeenDropZoneOneTutorial,
    isInsertEnabled,
    isDuplicateCombinationReady,
    isNonDuplicateCombinationReady,
    firstSlotConnectorKey,
    hasActiveCombinationState,
    combinationStationState,
    canCombine,
    onCombine,
    dropZoneRefA,
    dropZoneRefB,
    dropZoneRefC,
    outputRef,
    outputRef2,
    onHoverInsertSlot,
    hoveredInsertSlot,
    isCombineButtonHovered,
    onCombineButtonHoverChange,
    onOutputHover,
    onOutputHover2,
    hasOutputElementInSlot,
    isModeInserted,
    isModeCollapseAnimating,
    shouldAnimateModeShutter,
        modeUsesRemaining,
    modeInsertedElementLetter,
    modeInsertedElementCategory,
    showModeInsertedElementOverlay,
    sealedModeElementKeys,
    selectedModeTabElementKey,
    onModeTabSelect,
    onInsertMode,
    incubateCounter,
    refineCounter,
    onIncubateCounterChange,
    onRefineCounterChange,
    pendingJobElement,
    isSlotAnimatingClose,
    isSlotAnimatingOpen,
    isOutputSlotClosed,
    isOutputSlotAnimatingClose,
    isOutputSlotAnimatingOpen,
    lockedModes,
    unlockSlotRefs,
    unlockSlotOccupants,
    getUnlockSlotLetter,
    isUnlockReady,
    onUnlock,
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
        "slot-connector--inter-panel",
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
    const modeKey = combinationStationState.key;
    const panelModifierClass = zoneOccupants[0] !== null ? "is-lit" : "";
    const modeDropZoneClassName = `drop-zone ${hasStartedDraggingElement && !hasSeenDropZoneOneTutorial ? "is-discoverable" : ""} ${isDuplicateCombinationReady ? "is-enhance-ready-primary" : ""} ${isNonDuplicateCombinationReady ? "is-combination-ready-primary" : ""}`;
    const secondaryDropZoneClassName = `drop-zone ${isDuplicateCombinationReady ? "is-enhance-ready-secondary" : ""} ${isNonDuplicateCombinationReady ? "is-combination-ready-secondary" : ""}`;
    const isCombineButtonDisabled = !canCombine || !hasActiveCombinationState;
    const hasDeferredProcessActive = Boolean(pendingJobElement) || isOutputSlotClosed || isOutputSlotAnimatingClose || isOutputSlotAnimatingOpen;
    const [isResultGroupLatchedVisible, setIsResultGroupLatchedVisible] = useState(false);

    useEffect(() => {
        if (!isModeInserted) {
            setIsResultGroupLatchedVisible(false);
            return;
        }

        if (!isCombineButtonDisabled) {
            setIsResultGroupLatchedVisible(true);
            return;
        }

        if (hasDeferredProcessActive || hasOutputElementInSlot) {
            setIsResultGroupLatchedVisible(true);
            return;
        }

        setIsResultGroupLatchedVisible(false);
    }, [
        hasDeferredProcessActive,
        hasOutputElementInSlot,
        isCombineButtonDisabled,
        isModeInserted,
    ]);

    const shouldShowResultGroup = isResultGroupLatchedVisible;
    const shouldShowSlotOneInsertPrompt = (hoveredInsertSlot === 1 && zoneOccupants[0] === null)
        || (isCombineButtonHovered && hoveredInsertSlot === null && zoneOccupants[0] === null);
    const shouldShowSlotTwoInsertPrompt = (hoveredInsertSlot === 2 && zoneOccupants[1] === null)
        || (isCombineButtonHovered && hoveredInsertSlot === null && zoneOccupants[0] !== null && zoneOccupants[1] === null);
    // Third equation slot (e.g. Mix secondary) — shown when combine button is hovered and primary is filled but secondary is not
    const shouldShowSlotThreeInsertPrompt = combinationStationRulesEngine.usesThirdSlot(modeKey)
        && isCombineButtonHovered
        && (zoneOccupants[1] ?? null) !== null
        && (zoneOccupants[2] ?? null) === null;
    // Resolve active counter and handler based on current mode
    const activeCounter = modeKey === "incubate" ? incubateCounter
        : modeKey === "refine" ? refineCounter
        : 1;
    const handleCounterChange = modeKey === "incubate" ? onIncubateCounterChange
        : modeKey === "refine" ? onRefineCounterChange
        : () => {};
    const combineActionLabel = pendingJobElement && combinationStationRulesEngine.isDeferred(modeKey)
        ? combinationStationRulesEngine.getActiveLabel(modeKey) ?? combinationStationState.actionLabel
        : combinationStationState.actionLabel;
    const activeModeLabel = combinationStationRulesEngine.getActiveLabel(modeKey) ?? "";
    const isCurrentModeLocked = combinationStationState.elementKey
        ? lockedModes.has(combinationStationState.elementKey)
        : false;

    return (
        <div className={combinationStationClassName}>
            <div className="combination-equation-shell">
                <div className="combination-shell-body">
                    <div className="mode-tabs-bar" role="tablist" aria-label="Mode elements">
                        {MODE_TAB_ORDER.map((elementKey) => {
                            const isActive = combinationStationState.elementKey === elementKey;
                            const isInserted = sealedModeElementKeys.includes(elementKey)
                                || (isModeInserted && combinationStationState.elementKey === elementKey);

                            return (
                                <button
                                    key={elementKey}
                                    type="button"
                                    className={`mode-tab mode-tab--${elementKey} ${isActive ? "is-active" : ""} ${isInserted ? "is-inserted" : ""}`.trim()}
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => onModeTabSelect(elementKey)}
                                >
                                    <ElementIcon name={elementKey} />
                                </button>
                            );
                        })}
                    </div>
                    <div className="combination-shell-main">
                        <div className="combination-header-row combination-row-header">
                            <div className="combination-equation-mode-label" aria-live="polite">
                                {activeModeLabel}
                            </div>
                            {!isCurrentModeLocked && isModeInserted && modeKey !== "idle" && (
                                <div className="mode-charge-pips" aria-label={`${modeUsesRemaining} uses remaining`}>
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className={`mode-charge-pip mode-charge-pip--${combinationStationState.elementKey ?? "default"} ${i < modeUsesRemaining ? "is-lit" : "is-spent"}`}
                                            aria-hidden="true"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="combination-equation-container">
                            {isCurrentModeLocked && (
                                <ModeUnlockPanel
                                    elementKey={combinationStationState.elementKey ?? "default"}
                                    slotRefs={unlockSlotRefs}
                                    slotOccupants={unlockSlotOccupants}
                                    getSlotLetter={getUnlockSlotLetter}
                                    isUnlockReady={isUnlockReady}
                                    onUnlock={onUnlock}
                                />
                            )}
                            <div className={`combination-equation${isCurrentModeLocked ? " combination-equation--phantom" : ""}`}>
                            {isCurrentModeLocked ? (
                                <div className="combination-mode-panel-outer" aria-hidden="true">
                                    <div className="mode-component-anchor">
                                        <div className={`combination-mode-panel ${panelModifierClass} combination-mode-panel--spacer`}>
                                            <div className="mode-panel-body">
                                                <div className="drop-zone-area">
                                                    <span className="combination-mode-slot-spacer" />
                                                </div>
                                            </div>
                                            <div className="insert-mode-button-wrap">
                                                <span className="insert-mode-button-spacer" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
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
                                    hasSelectedModeTab={selectedModeTabElementKey !== null}
                                    activeModeTabElementKey={combinationStationState.elementKey}
                                    onInsertMode={onInsertMode}
                                />
                            )}
                            <div className={[
                                "combination-logic-result-group",
                                !isModeInserted ? "is-hidden" : "",
                                isModeCollapseAnimating ? "is-collapsing" : "",
                            ].filter(Boolean).join(" ")}>
                                <div className={interPanelConnectorClassName} aria-hidden="true" />

                                <CombinationLogicPanel
                                    className={panelModifierClass}
                                    modeKey={modeKey}
                                    primaryDropZoneClassName={modeDropZoneClassName}
                                    secondaryDropZoneClassName={secondaryDropZoneClassName}
                                    zoneOccupants={zoneOccupants}
                                    dropZoneRefB={dropZoneRefB}
                                    dropZoneRefC={dropZoneRefC}
                                    onHoverInsertSlot={onHoverInsertSlot}
                                    shouldShowSlotTwoInsertPrompt={shouldShowSlotTwoInsertPrompt}
                                    shouldShowSlotThreeInsertPrompt={shouldShowSlotThreeInsertPrompt}
                                    slotConnectorClassName={secondSlotConnectorClassName}
                                    counterValue={activeCounter}
                                    onCounterChange={handleCounterChange}
                                    pendingJobElement={pendingJobElement}
                                    isSlotAnimatingClose={isSlotAnimatingClose}
                                    isSlotAnimatingOpen={isSlotAnimatingOpen}
                                    combineButtonElementClass={combineButtonElementClass}
                                    isCombineButtonDisabled={isCombineButtonDisabled}
                                    combineActionLabel={combineActionLabel}
                                    onCombineButtonHoverChange={onCombineButtonHoverChange}
                                    onCombine={onCombine}
                                />
                                <div className={secondSlotConnectorClassName} aria-hidden="true" />

                                <div className={`combination-result-group ${shouldShowResultGroup ? "" : "is-hidden"}`.trim()}>
                                    <CombinationResultPanel
                                        className={panelModifierClass}
                                        modeKey={modeKey}
                                        outputRef={outputRef}
                                        outputRef2={outputRef2}
                                        onOutputHover={onOutputHover}
                                        onOutputHover2={onOutputHover2}
                                        isPrimaryOutputShutterClosed={isOutputSlotClosed}
                                        isPrimaryOutputShutterAnimatingClose={isOutputSlotAnimatingClose}
                                        isPrimaryOutputShutterAnimatingOpen={isOutputSlotAnimatingOpen}
                                    />
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CombinationStation;
