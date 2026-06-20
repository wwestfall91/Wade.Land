type CombinationCombineButtonProps = {
    combineButtonElementClass: string;
    isCombineButtonDisabled: boolean;
    combineActionLabel: string;
    onCombineButtonHoverChange: (isHovered: boolean) => void;
    onCombine: () => void;
};

function CombinationCombineButton({
    combineButtonElementClass,
    isCombineButtonDisabled,
    combineActionLabel,
    onCombineButtonHoverChange,
    onCombine,
}: CombinationCombineButtonProps) {
    return (
        <div
            className={`combine-button-wrap ${isCombineButtonDisabled ? "is-disabled" : ""}`}
            onMouseEnter={() => onCombineButtonHoverChange(true)}
            onMouseLeave={() => onCombineButtonHoverChange(false)}
            onFocusCapture={() => onCombineButtonHoverChange(true)}
            onBlurCapture={() => onCombineButtonHoverChange(false)}
        >
            <button
                className={`combine-button ${combineButtonElementClass}`.trim()}
                disabled={isCombineButtonDisabled}
                onClick={onCombine}
            >
                {combineActionLabel}
            </button>
        </div>
    );
}

export default CombinationCombineButton;
