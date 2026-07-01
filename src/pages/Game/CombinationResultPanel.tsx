import type { RefObject } from "react";
import OutputSlot from "./slots/OutputSlot";
import SlotShutter from "./slots/SlotShutter";
import { combinationStationRulesEngine } from "./CombinationStationRulesEngine";
import "./CombinationResultPanel.scss";

type CombinationResultPanelProps = {
    className: string;
    modeKey: string;
    outputRef: RefObject<HTMLDivElement>;
    outputRef2: RefObject<HTMLDivElement>;
    onOutputHover: (hovered: boolean) => void;
    onOutputHover2: (hovered: boolean) => void;
    isPrimaryOutputShutterClosed: boolean;
    isPrimaryOutputShutterAnimatingClose: boolean;
    isPrimaryOutputShutterAnimatingOpen: boolean;
};

function CombinationResultPanel({
    className,
    modeKey,
    outputRef,
    outputRef2,
    onOutputHover,
    onOutputHover2,
    isPrimaryOutputShutterClosed,
    isPrimaryOutputShutterAnimatingClose,
    isPrimaryOutputShutterAnimatingOpen,
}: CombinationResultPanelProps) {
    const isDualOutput = combinationStationRulesEngine.isDualOutput(modeKey);

    return (
        <div className={`combination-result-panel ${className}`.trim()}>
            <div className={`drop-zone-area ${isDualOutput ? "drop-zone-area--dual" : ""}`.trim()}>
                <SlotShutter
                    shellClassName="result-output-shell"
                    shutterClassName="result-output-shutter"
                    isClosed={isPrimaryOutputShutterClosed}
                    isAnimatingClose={isPrimaryOutputShutterClosed && isPrimaryOutputShutterAnimatingClose}
                    isAnimatingOpen={!isPrimaryOutputShutterClosed && isPrimaryOutputShutterAnimatingOpen}
                >
                    <OutputSlot slotRef={outputRef} onHover={onOutputHover} />
                </SlotShutter>
                {isDualOutput ? (
                    <OutputSlot slotRef={outputRef2} onHover={onOutputHover2} />
                ) : null}
            </div>
        </div>
    );
}

export default CombinationResultPanel;

