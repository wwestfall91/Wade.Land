import type { RefObject } from "react";
import "./CombinationResultPanel.scss";


type CombinationResultPanelProps = {
    className: string;
    outputRef: RefObject<HTMLDivElement>;
    onOutputHover: (hovered: boolean) => void;
};

function CombinationResultPanel({
    className,
    outputRef,
    onOutputHover,
}: CombinationResultPanelProps) {
    return (
        <div className={`combination-result-panel ${className}`.trim()}>
            <div className="drop-zone-area">
                <div
                    className="output"
                    ref={outputRef}
                    onMouseEnter={() => onOutputHover(true)}
                    onMouseLeave={() => onOutputHover(false)}
                />
            </div>
        </div>
    );
}

export default CombinationResultPanel;
