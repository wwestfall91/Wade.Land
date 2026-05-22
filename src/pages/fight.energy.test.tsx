import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import Fight from "./Fight/Fight";

const mockedUsePlayer = vi.hoisted(() => vi.fn());

vi.mock("../context/PlayerContext", async () => {
    const actual = await vi.importActual<typeof import("../context/PlayerContext")>("../context/PlayerContext");
    return {
        ...actual,
        usePlayer: mockedUsePlayer,
    };
});

const renderFight = () => {
    const router = createMemoryRouter(
        [
            {
                path: "/fight",
                element: <Fight />,
            },
        ],
        {
            initialEntries: [
                {
                    pathname: "/fight",
                    state: {
                        enemy: {
                            name: "Training Dummy",
                            hp: 999,
                            souls: 0,
                            sprite: "",
                            weaknesses: [],
                            elements: [
                                {
                                    letter: "Bonk",
                                    damage: 0,
                                    energy: 0,
                                    level: 1,
                                    description: "No-op",
                                    type1: "earth",
                                },
                            ],
                        },
                        elementPool: [],
                    },
                },
            ],
        },
    );

    return render(<RouterProvider router={router} />);
};

describe("Fight energy usage", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("spends turn energy on casts and disables unaffordable/all slots", async () => {
        mockedUsePlayer.mockReturnValue({
            player: {
                level: 1,
                hp: 100,
                souls: 0,
                elements: [
                    {
                        id: 1,
                        letter: "Spark",
                        damage: 5,
                        energy: 2,
                        level: 1,
                        description: "Cheap spell",
                        type1: "lightning",
                    },
                    {
                        id: 2,
                        letter: "Wave",
                        damage: 4,
                        energy: 2,
                        level: 1,
                        description: "Second cast",
                        type1: "water",
                    },
                    {
                        id: 3,
                        letter: "Quake",
                        damage: 9,
                        energy: 3,
                        level: 1,
                        description: "Expensive spell",
                        type1: "earth",
                    },
                ],
            },
            playerName: "Tester",
            levels: [{ level: 1, hp: 100 }],
            setPlayerName: vi.fn(),
            addSouls: vi.fn(),
            initializeElements: vi.fn(),
            combineElements: vi.fn(),
            applyEnemyAttack: vi.fn(),
            healPlayer: vi.fn(),
            resetGame: vi.fn(),
            addElement: vi.fn(),
            selectedEnemy: null,
            setSelectedEnemy: vi.fn(),
        });

        renderFight();

        await screen.findByText("4/4");

        const sparkButton = screen.getByRole("button", { name: /spark/i });
        const waveButton = screen.getByRole("button", { name: /wave/i });
        const quakeButton = screen.getByRole("button", { name: /quake/i });

        expect((sparkButton as HTMLButtonElement).disabled).toBe(false);
        expect((waveButton as HTMLButtonElement).disabled).toBe(false);
        expect((quakeButton as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(sparkButton);

        await waitFor(() => {
            expect(screen.getByText("2/4")).toBeTruthy();
        });

        await waitFor(() => {
            expect((screen.getByRole("button", { name: /quake/i }) as HTMLButtonElement).disabled).toBe(true);
        });

        await waitFor(() => {
            expect((screen.getByRole("button", { name: /wave/i }) as HTMLButtonElement).disabled).toBe(false);
        });

        fireEvent.click(screen.getByRole("button", { name: /wave/i }));

        await waitFor(() => {
            expect(screen.getByText("0/4")).toBeTruthy();
        });

        await waitFor(() => {
            expect((screen.getByRole("button", { name: /spark/i }) as HTMLButtonElement).disabled).toBe(true);
            expect((screen.getByRole("button", { name: /wave/i }) as HTMLButtonElement).disabled).toBe(true);
            expect((screen.getByRole("button", { name: /quake/i }) as HTMLButtonElement).disabled).toBe(true);
        });
    });
});
