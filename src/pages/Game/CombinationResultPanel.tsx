import type { RefObject } from "react";
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

const DUAL_OUTPUT_MODES = new Set(["divide", "duplicate"]);

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
    const isDualOutput = DUAL_OUTPUT_MODES.has(modeKey);

    return (
        <div className={`combination-result-panel ${className}`.trim()}>
            <div className={`drop-zone-area ${isDualOutput ? "drop-zone-area--dual" : ""}`.trim()}>
                <div
                    className={[
                        "result-output-shell",
                        isPrimaryOutputShutterClosed ? "is-closed" : "",
                        isPrimaryOutputShutterClosed && isPrimaryOutputShutterAnimatingClose ? "is-animating-close" : "",
                        !isPrimaryOutputShutterClosed && isPrimaryOutputShutterAnimatingOpen ? "is-animating-open" : "",
                    ].filter(Boolean).join(" ")}
                >
                    <div
                        className="output"
                        ref={outputRef}
                        onMouseEnter={() => onOutputHover(true)}
                        onMouseLeave={() => onOutputHover(false)}
                    />
                    <span className="result-output-shutter" aria-hidden="true" />
                </div>
                {isDualOutput ? (
                    <div
                        className="output"
                        ref={outputRef2}
                        onMouseEnter={() => onOutputHover2(true)}
                        onMouseLeave={() => onOutputHover2(false)}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default CombinationResultPanel;

