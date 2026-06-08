import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Draggable from "./Draggable";

vi.mock("../../context/PlayerContext", () => ({
    usePlayer: () => ({
        typeMultipliers: {},
    }),
}));

describe("Draggable selection toggle", () => {
    it("selects on click and deselects on second click", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);

        const containerRef = { current: container } as React.RefObject<HTMLDivElement | null>;
        const dropZoneRefs = [{ current: null }, { current: null }] as Array<React.RefObject<HTMLDivElement | null>>;

        const { unmount } = render(
            <Draggable
                id={1}
                letter="A"
                damage={10}
                description="Test description"
                containerRef={containerRef}
                dropZoneRefs={dropZoneRefs}
                initialPosition={{ x: 0, y: 0 }}
                onSnapChange={() => {}}
                canSnapToZone={() => false}
            />,
        );

        const dragElement = document.getElementById("Draggable");
        expect(dragElement).toBeTruthy();

        fireEvent.pointerDown(dragElement as HTMLElement, { clientX: 10, clientY: 10 });
        fireEvent.pointerUp(window, { clientX: 10, clientY: 10 });

        await screen.findByText("Test description");

        fireEvent.pointerDown(dragElement as HTMLElement, { clientX: 10, clientY: 10 });
        fireEvent.pointerUp(window, { clientX: 10, clientY: 10 });

        await waitFor(() => {
            expect(screen.queryByText("Test description")).toBeNull();
        });

        unmount();
        document.body.removeChild(container);
    });
});
