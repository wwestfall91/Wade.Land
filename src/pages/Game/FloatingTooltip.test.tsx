import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FloatingTooltip from "./FloatingTooltip";

function TooltipHarness() {
    const anchorRef = useRef<HTMLButtonElement | null>(null);

    return (
        <>
            <div
                data-testid="enemy-sprite"
                style={{ position: "fixed", inset: 0, zIndex: 2147483646 }}
            />
            <div
                data-testid="overlay"
                style={{ position: "fixed", inset: 0, zIndex: 5000 }}
            />
            <button ref={anchorRef} type="button">
                Spell Slot
            </button>
            <FloatingTooltip
                anchorElement={anchorRef.current}
                open
                className="spell-hover-tooltip-shell"
            >
                <span>Damage: 12</span>
            </FloatingTooltip>
        </>
    );
}

describe("FloatingTooltip layering", () => {
    it("renders above other elements", async () => {
        render(<TooltipHarness />);

        const tooltipContent = await screen.findByText("Damage: 12");
        const tooltipRoot = tooltipContent.closest(".floating-tooltip");
        const enemySprite = screen.getByTestId("enemy-sprite");
        const overlay = screen.getByTestId("overlay");

        expect(tooltipRoot).toBeTruthy();
        expect((tooltipRoot as HTMLElement).parentElement).toBe(document.body);

        const tooltipZ = Number.parseInt(window.getComputedStyle(tooltipRoot as HTMLElement).zIndex || "0", 10);
        const enemySpriteZ = Number.parseInt(window.getComputedStyle(enemySprite).zIndex || "0", 10);
        const overlayZ = Number.parseInt(window.getComputedStyle(overlay).zIndex || "0", 10);

        expect(tooltipZ).toBeGreaterThan(enemySpriteZ);
        expect(tooltipZ).toBeGreaterThan(overlayZ);
    });
});
