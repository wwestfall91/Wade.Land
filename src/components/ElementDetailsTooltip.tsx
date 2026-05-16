import FloatingTooltip from "../pages/Game/FloatingTooltip";
import ElementIcon from "./ElementIcon";
import { getEffectChipClass, getEffectSummaryLines } from "../combat/effectSummary";
import type { RewardElement } from "../context/PlayerContext";

type ElementDetailsTooltipProps = {
    element: RewardElement;
    anchorElement: HTMLElement | null;
    open: boolean;
    className?: string;
    clampHorizontal?: boolean;
};

function ElementDetailsTooltip({
    element,
    anchorElement,
    open,
    className = "reward-element-tooltip-shell",
    clampHorizontal = true,
}: ElementDetailsTooltipProps) {
    const toTypeClass = (value: string) =>
        `type-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const elementTypes = [element.type1, element.type2].filter(
        (value): value is string => Boolean(value && value.trim().length > 0),
    );
    const effectLines = getEffectSummaryLines(element.effects);

    return (
        <FloatingTooltip
            anchorElement={anchorElement}
            open={open}
            className={className}
            clampHorizontal={clampHorizontal}
        >
            <div className="reward-element-info">
                <div className="element-info-title-row">
					<div className="drag-title">
                        <div className="element-header">
                            <span className="drag-title-icon">
                                <ElementIcon name={element.letter} />
                            </span>
                            <span className="drag-title-name">{element.letter}</span>
                        </div>
					    {element.level === 1 ? <span className="element-info-badge">BASE ELEMENT </span> : null}
					</div>
                    <div>{element.description}</div>
				</div>
                <span className="element-info-damage">Damage: {element.damage}</span>
                <span className="element-info-types">
                    <span className="element-info-label">Types:</span>
                    <span className="element-info-list">
                        {elementTypes.length > 0 ? (
                            elementTypes.map((type) => (
                                <span key={type} className={`type-chip ${toTypeClass(type)}`}>
                                    {type}
                                </span>
                            ))
                        ) : (
                            <span className="type-chip type-none">None</span>
                        )}
                    </span>
                </span>
                {effectLines.length > 0 ? (
                    <span className="element-info-effects">
                        <span className="element-info-label">Effects:</span>
                        <span className="element-info-list">
                            {effectLines.map((line, lineIndex) => (
                                <span key={`${line}-${lineIndex}`} className={`effect-chip ${getEffectChipClass(line)}`}>
                                    {line}
                                </span>
                            ))}
                        </span>
                    </span>
                ) : null}
            </div>
        </FloatingTooltip>
    );
}

export default ElementDetailsTooltip;
