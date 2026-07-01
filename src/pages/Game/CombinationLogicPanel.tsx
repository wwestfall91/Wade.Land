import type { RefObject } from "react";
import MixLogicContent from "./modes/MixLogicContent";
import DeferredInputLogicContent from "./modes/DeferredInputLogicContent";
import SingleInputLogicContent from "./modes/SingleInputLogicContent";
import CombinationCombineButton from "./CombinationCombineButton";
import "./CombinationLogicPanel.scss";

type CombinationLogicPanelProps = {
    className: string;
    modeKey: string;
    primaryDropZoneClassName: string;
    secondaryDropZoneClassName: string;
    zoneOccupants: Array<number | null>;
    dropZoneRefB: RefObject<HTMLDivElement>;
    dropZoneRefC: RefObject<HTMLDivElement>;
    onHoverInsertSlot: (slot: 1 | 2 | null) => void;
    shouldShowSlotTwoInsertPrompt: boolean;
    shouldShowSlotThreeInsertPrompt: boolean;
    slotConnectorClassName: string;
    counterValue: number;
    onCounterChange: (value: number) => void;
    pendingJobElement: { letter: string; category?: string } | null;
    isSlotAnimatingClose: boolean;
    isSlotAnimatingOpen: boolean;
    combineButtonElementClass: string;
    isCombineButtonDisabled: boolean;
    combineActionLabel: string;
    onCombineButtonHoverChange: (isHovered: boolean) => void;
    onCombine: () => void;
};

function CombinationLogicPanel({
    className,
    modeKey,
    primaryDropZoneClassName,
    secondaryDropZoneClassName,
    dropZoneRefB,
    dropZoneRefC,
    onHoverInsertSlot,
    shouldShowSlotTwoInsertPrompt,
    shouldShowSlotThreeInsertPrompt,
    slotConnectorClassName,
    counterValue,
    onCounterChange,
    pendingJobElement,
    isSlotAnimatingClose,
    isSlotAnimatingOpen,
    combineButtonElementClass,
    isCombineButtonDisabled,
    combineActionLabel,
    onCombineButtonHoverChange,
    onCombine,
}: CombinationLogicPanelProps) {
    const renderContent = () => {
        switch (modeKey) {
            case "mix":
                return (
                    <MixLogicContent
                        primaryDropZoneClassName={primaryDropZoneClassName}
                        secondaryDropZoneClassName={secondaryDropZoneClassName}
                        dropZoneRefB={dropZoneRefB}
                        dropZoneRefC={dropZoneRefC}
                        onHoverInsertSlot={onHoverInsertSlot}
                        shouldShowPrimaryInsertPrompt={shouldShowSlotTwoInsertPrompt}
                        shouldShowSecondaryInsertPrompt={shouldShowSlotThreeInsertPrompt}
                        slotConnectorClassName={slotConnectorClassName}
                    />
                );
            case "incubate":
                return (
                    <DeferredInputLogicContent
                        wrapperClassName="incubate-logic-content"
                        dropZoneClassName={primaryDropZoneClassName}
                        dropZoneRef={dropZoneRefB}
                        onHoverInsertSlot={onHoverInsertSlot}
                        shouldShowInsertPrompt={shouldShowSlotTwoInsertPrompt}
                        counterValue={counterValue}
                        onCounterChange={onCounterChange}
                        pendingJobElement={pendingJobElement}
                        isSlotAnimatingClose={isSlotAnimatingClose}
                        isSlotAnimatingOpen={isSlotAnimatingOpen}
                    />
                );
            case "divide":
                return (
                    <SingleInputLogicContent
                        wrapperClassName="divide-logic-content"
                        dropZoneClassName={primaryDropZoneClassName}
                        dropZoneRef={dropZoneRefB}
                        onHoverInsertSlot={onHoverInsertSlot}
                        shouldShowInsertPrompt={shouldShowSlotTwoInsertPrompt}
                    />
                );
            case "refine":
                return (
                    <DeferredInputLogicContent
                        wrapperClassName="refine-logic-content"
                        dropZoneClassName={primaryDropZoneClassName}
                        dropZoneRef={dropZoneRefB}
                        onHoverInsertSlot={onHoverInsertSlot}
                        shouldShowInsertPrompt={shouldShowSlotTwoInsertPrompt}
                        counterValue={counterValue}
                        onCounterChange={onCounterChange}
                        pendingJobElement={pendingJobElement}
                        isSlotAnimatingClose={isSlotAnimatingClose}
                        isSlotAnimatingOpen={isSlotAnimatingOpen}
                    />
                );
            case "duplicate":
                return (
                    <SingleInputLogicContent
                        wrapperClassName="duplicate-logic-content"
                        dropZoneClassName={primaryDropZoneClassName}
                        dropZoneRef={dropZoneRefB}
                        onHoverInsertSlot={onHoverInsertSlot}
                        shouldShowInsertPrompt={shouldShowSlotTwoInsertPrompt}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className={`combination-logic-panel mode-${modeKey} ${className}`.trim()}>
            <div className="logic-panel-body">
                {renderContent()}
            </div>
            <div className="logic-panel-actions">
                <CombinationCombineButton
                    combineButtonElementClass={combineButtonElementClass}
                    isCombineButtonDisabled={isCombineButtonDisabled}
                    combineActionLabel={combineActionLabel}
                    onCombineButtonHoverChange={onCombineButtonHoverChange}
                    onCombine={onCombine}
                />
            </div>
        </div>
    );
}

export default CombinationLogicPanel;
