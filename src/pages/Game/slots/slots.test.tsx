import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import InputSlot from "./InputSlot";
import OutputSlot from "./OutputSlot";
import SlotShutter from "./SlotShutter";
import SlotInsertPrompt from "./SlotInsertPrompt";
import CounterSlot from "./CounterSlot";

afterEach(() => {
    cleanup();
});

describe("InputSlot", () => {
    it("renders the drop zone class, label and children, and wires the slot ref", () => {
        const ref = createRef<HTMLDivElement>();
        const { container } = render(
            <InputSlot
                className="drop-zone mix-slot"
                slotRef={ref}
                label="Primary"
                labelClassName="mix-slot-label"
            >
                <span>icon</span>
            </InputSlot>,
        );

        const zone = container.querySelector(".drop-zone.mix-slot") as HTMLElement;
        expect(zone).not.toBeNull();
        expect(zone).toBe(ref.current);

        const label = zone.querySelector(".mix-slot-label");
        expect(label?.textContent).toBe("Primary");
        expect(zone.textContent).toContain("icon");
    });

    it("emits the hover value on enter and null on leave", () => {
        const onHover = vi.fn();
        const { container } = render(
            <InputSlot className="drop-zone" onHover={onHover} hoverValue={2} />,
        );
        const zone = container.querySelector(".drop-zone") as HTMLElement;

        fireEvent.mouseEnter(zone);
        fireEvent.mouseLeave(zone);

        expect(onHover).toHaveBeenNthCalledWith(1, 2);
        expect(onHover).toHaveBeenNthCalledWith(2, null);
    });

    it("shows the insert prompt only when requested", () => {
        const { container, rerender } = render(<InputSlot className="drop-zone" />);
        expect(container.querySelector(".combine-station-tooltip")).toBeNull();

        rerender(
            <InputSlot
                className="drop-zone"
                showInsertPrompt
                insertPromptClassName="combine-station-tooltip--slot-two"
            />,
        );
        const prompt = container.querySelector(".combine-station-tooltip") as HTMLElement;
        expect(prompt).not.toBeNull();
        expect(prompt.className).toContain("combine-station-tooltip--slot-two");
    });
});

describe("OutputSlot", () => {
    it("defaults to the output class and reports hover state", () => {
        const ref = createRef<HTMLDivElement>();
        const onHover = vi.fn();
        const { container } = render(<OutputSlot slotRef={ref} onHover={onHover} />);
        const zone = container.querySelector(".output") as HTMLElement;

        expect(zone).toBe(ref.current);
        fireEvent.mouseEnter(zone);
        fireEvent.mouseLeave(zone);
        expect(onHover).toHaveBeenNthCalledWith(1, true);
        expect(onHover).toHaveBeenNthCalledWith(2, false);
    });
});

describe("SlotShutter", () => {
    it("applies state flags as given and renders children, overlay and shutter", () => {
        const { container } = render(
            <SlotShutter
                shellClassName="logic-drop-zone-shell"
                shutterClassName="logic-drop-zone-shutter"
                isClosed
                isAnimatingClose
                isAnimatingOpen={false}
                overlay={<span className="overlay" />}
            >
                <div className="zone" />
            </SlotShutter>,
        );

        const shell = container.querySelector(".logic-drop-zone-shell") as HTMLElement;
        expect(shell.className).toContain("is-closed");
        expect(shell.className).toContain("is-animating-close");
        expect(shell.className).not.toContain("is-animating-open");
        expect(shell.querySelector(".zone")).not.toBeNull();
        expect(shell.querySelector(".overlay")).not.toBeNull();
        expect(shell.querySelector(".logic-drop-zone-shutter")).not.toBeNull();
    });
});

describe("SlotInsertPrompt", () => {
    it("renders a tooltip with the default message and the supplied class", () => {
        const { container } = render(
            <SlotInsertPrompt className="combine-station-tooltip--slot-one" />,
        );
        const tooltip = container.querySelector(".combine-station-tooltip") as HTMLElement;
        expect(tooltip.getAttribute("role")).toBe("tooltip");
        expect(tooltip.className).toContain("combine-station-tooltip--slot-one");
        expect(tooltip.textContent).toBe("Please insert element");
    });
});

describe("CounterSlot", () => {
    it("renders the label and value and clamps within bounds", () => {
        const onChange = vi.fn();
        const { container, rerender } = render(
            <CounterSlot value={1} min={1} max={5} label="Battles" onChange={onChange} />,
        );

        expect(container.querySelector(".mode-counter-label")?.textContent).toBe("Battles");
        expect(container.querySelector(".mode-counter-value")?.textContent).toBe("1");

        const up = container.querySelector(".mode-counter-btn--up") as HTMLButtonElement;
        const down = container.querySelector(".mode-counter-btn--down") as HTMLButtonElement;

        // At min: down is disabled, up increments.
        expect(down.disabled).toBe(true);
        fireEvent.click(up);
        expect(onChange).toHaveBeenCalledWith(2);

        // At max: up is disabled.
        rerender(<CounterSlot value={5} min={1} max={5} label="Battles" onChange={onChange} />);
        expect((container.querySelector(".mode-counter-btn--up") as HTMLButtonElement).disabled).toBe(true);
    });

    it("disables all controls when disabled", () => {
        const onChange = vi.fn();
        const { container } = render(<CounterSlot value={3} onChange={onChange} disabled />);
        const slot = container.querySelector(".mode-counter") as HTMLElement;
        expect(slot.className).toContain("is-disabled");
        container.querySelectorAll("button").forEach((btn) => {
            expect((btn as HTMLButtonElement).disabled).toBe(true);
        });
    });
});
