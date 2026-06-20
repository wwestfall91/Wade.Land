import "./ModeCounter.scss";

type ModeCounterProps = {
    value: number;
    min?: number;
    max?: number;
    label?: string;
    onChange: (value: number) => void;
    disabled?: boolean;
};

function ModeCounter({ value, min = 1, max = 5, label, onChange, disabled = false }: ModeCounterProps) {
    return (
        <div className={`mode-counter${disabled ? " is-disabled" : ""}`}>
            {label ? <span className="mode-counter-label">{label}</span> : null}
            <div className="mode-counter-controls">
                <button
                    className="mode-counter-btn mode-counter-btn--up"
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={disabled || value >= max}
                    aria-label="Increase"
                >
                    ▲
                </button>
                <span className="mode-counter-value">{value}</span>
                <button
                    className="mode-counter-btn mode-counter-btn--down"
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={disabled || value <= min}
                    aria-label="Decrease"
                >
                    ▼
                </button>
            </div>
        </div>
    );
}

export default ModeCounter;
