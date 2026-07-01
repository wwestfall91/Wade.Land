type SlotInsertPromptProps = {
    /** Positioning modifier class, e.g. "combine-station-tooltip--slot-one". */
    className?: string;
    message?: string;
};

/**
 * The small "Please insert element" tooltip shown over an empty slot.
 * Previously duplicated inline (as `CombineStationTooltip`) in every slot renderer.
 */
function SlotInsertPrompt({ className = "", message = "Please insert element" }: SlotInsertPromptProps) {
    return (
        <div className={`combine-station-tooltip ${className}`.trim()} role="tooltip">
            {message}
        </div>
    );
}

export default SlotInsertPrompt;
