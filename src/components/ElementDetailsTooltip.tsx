import FloatingTooltip from "../pages/Game/FloatingTooltip";
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
    return (
        <FloatingTooltip
            anchorElement={anchorElement}
            open={open}
            className={className}
            clampHorizontal={clampHorizontal}
            elementDetails={{
                letter: element.letter,
                damage: element.damage,
                energy: element.energy,
                description: element.description,
                type1: element.type1,
                type2: element.type2,
                effects: element.effects,
                level: element.level,
            }}
        />
    );
}

export default ElementDetailsTooltip;
