import FloatingTooltip from "../pages/Game/FloatingTooltip";
import type { RewardElement } from "../context/PlayerContext";

type ElementDetailsTooltipProps = {
    element: RewardElement;
    anchorElement: HTMLElement | null;
    open: boolean;
    className?: string;
    clampHorizontal?: boolean;
    interactive?: boolean;
    onTooltipMouseEnter?: () => void;
    onTooltipMouseLeave?: () => void;
};

function ElementDetailsTooltip({
    element,
    anchorElement,
    open,
    className = "reward-element-tooltip-shell",
    clampHorizontal = true,
    interactive = false,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
}: ElementDetailsTooltipProps) {
    return (
        <FloatingTooltip
            anchorElement={anchorElement}
            open={open}
            className={className}
            clampHorizontal={clampHorizontal}
            interactive={interactive}
            onTooltipMouseEnter={onTooltipMouseEnter}
            onTooltipMouseLeave={onTooltipMouseLeave}
            elementDetails={{
                letter: element.letter,
                damage: element.damage,
                energy: element.energy,
                description: element.description,
                type1: element.type1,
                type2: element.type2,
                effects: element.effects,
                level: element.level,
                category: element.category,
            }}
        />
    );
}

export default ElementDetailsTooltip;
