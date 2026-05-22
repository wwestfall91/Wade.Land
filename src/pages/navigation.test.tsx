import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CookiesProvider } from "react-cookie";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { PlayerProvider } from "../context/PlayerContext";
import Game from "./Game/Game";
import Fight from "./Fight/Fight";

vi.mock("xlsx", () => {
    const sheetToJson = vi.fn((worksheet: { __kind?: string }) => {
        switch (worksheet?.__kind) {
            case "levels":
                return [
                    { Level: 1, HP: 100, Experience: 0 },
                    { Level: 2, HP: 120, Experience: 50 },
                ];
            case "elements":
                return [
                    {
                        Name: "Fire",
                        "Element 1": "",
                        "Element 2": "",
                        Damage: 12,
                        Level: 1,
                        Description: "Fire base",
                        "Type 1": "fire",
                    },
                    {
                        Name: "Water",
                        "Element 1": "",
                        "Element 2": "",
                        Damage: 10,
                        Level: 1,
                        Description: "Water base",
                        "Type 1": "water",
                    },
                    {
                        Name: "Earth",
                        "Element 1": "",
                        "Element 2": "",
                        Damage: 11,
                        Level: 1,
                        Description: "Earth base",
                        "Type 1": "earth",
                    },
                ];
            case "enemies":
                return [
                    {
                        Name: "Slime",
                        HP: 18,
                        Souls: 4,
                        Description: "A weak slime",
                        Sprite: "",
                        Element1: "Fire",
                        Weak1: "water",
                    },
                ];
            default:
                return [];
        }
    });

    const read = vi.fn((buffer: ArrayBuffer) => {
        const kind = buffer.byteLength === 1
            ? "levels"
            : buffer.byteLength === 2
                ? "elements"
                : "enemies";

        return {
            SheetNames: ["Sheet1"],
            Sheets: {
                Sheet1: { __kind: kind },
            },
        };
    });

    return {
        read,
        utils: {
            sheet_to_json: sheetToJson,
        },
    };
});

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-path">{location.pathname}</div>;
}

function renderWithRouter(initialEntries: Array<string | { pathname: string; state?: unknown }>) {
    const router = createMemoryRouter(
        [
            {
                path: "/game",
                element: (
                    <>
                        <LocationProbe />
                        <Game />
                    </>
                ),
            },
            {
                path: "/fight",
                element: (
                    <>
                        <LocationProbe />
                        <Fight />
                    </>
                ),
            },
        ],
        { initialEntries },
    );

    return render(
        <CookiesProvider>
            <PlayerProvider>
                <RouterProvider router={router} />
            </PlayerProvider>
        </CookiesProvider>,
    );
}

describe("Game/Fight navigation", () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        document.cookie = "wade_player_name=Tester; path=/";

        Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            },
        });

        const fetchMock = vi.fn((input: string | URL | Request) => {
            const requestUrl = String(input);

            const buffer = requestUrl.includes("levels.xlsx")
                ? new ArrayBuffer(1)
                : requestUrl.includes("elements.xlsx")
                    ? new ArrayBuffer(2)
                    : new ArrayBuffer(3);

            return Promise.resolve({
                arrayBuffer: () => Promise.resolve(buffer),
            } as Response);
        });

        vi.stubGlobal("fetch", fetchMock);
    });

    it("shows the starter modal before the game begins", async () => {
        renderWithRouter(["/game"]);

        await screen.findByText("Pick a Element!");

        expect(screen.getByTestId("location-path").textContent).toBe("/game");
        expect(document.querySelector("#Game")).toBeTruthy();
        expect(document.querySelector(".start-menu-overlay")).toBeTruthy();
    });

    it("navigates from game scene to fight scene when clicking FIGHT", async () => {
        renderWithRouter(["/game"]);

        await waitFor(() => {
            expect(screen.getAllByText("Next Enemy").length).toBeGreaterThan(0);
        });

        const fightButton = document.querySelector("#Game .fight-button") as HTMLButtonElement | null;
        expect(fightButton).toBeTruthy();
        if (fightButton) {
            fireEvent.click(fightButton);
        }

        await waitFor(() => {
            const probes = screen.getAllByTestId("location-path");
            expect(probes[probes.length - 1]?.textContent).toBe("/fight");
        });

        expect(document.querySelector("#Fight")).toBeTruthy();
    });

    it("shows reward modal after fight and returns to game on continue", async () => {
        renderWithRouter([
            {
                pathname: "/fight",
                state: {
                    enemy: {
                        name: "Defeated Slime",
                        hp: 0,
                        souls: 10,
                        sprite: "",
                        weaknesses: [],
                        elements: [],
                    },
                    elementPool: [
                        {
                            letter: "Fire",
                            damage: 12,
                            level: 1,
                            description: "Fire base",
                            type1: "fire",
                        },
                    ],
                },
            },
        ]);

        await screen.findByText("Pick 1 Element!");

        const rewardOption = document.querySelector(".reward-element") as HTMLButtonElement | null;
        expect(rewardOption).toBeTruthy();
        if (rewardOption) {
            fireEvent.click(rewardOption);
        }

        fireEvent.click(screen.getByRole("button", { name: "CONTINUE" }));

        await waitFor(() => {
            const probes = screen.getAllByTestId("location-path");
            expect(probes[probes.length - 1]?.textContent).toBe("/game");
        }, { timeout: 2000 });

        expect(document.querySelector("#Game")).toBeTruthy();
    });
});
