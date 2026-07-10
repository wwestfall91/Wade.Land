import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        cleanup();
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
                        energy: 8,
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
            spellSlots: [1, 2, 3],
            elementalResistances: { fire: 0, water: 0, earth: 0, air: 0 },
        });

        renderFight();

        // Player starts each turn with ENERGY_PER_TURN (3) out of MAX_TURN_ENERGY (9)
        await screen.findByText("3/9");

        const sparkButton = screen.getByRole("button", { name: /spark/i });
        const waveButton = screen.getByRole("button", { name: /wave/i });
        const quakeButton = screen.getByRole("button", { name: /quake/i });

        // Spark (2) and Wave (2) are affordable; Quake (8) exceeds starting energy
        expect((sparkButton as HTMLButtonElement).disabled).toBe(false);
        expect((waveButton as HTMLButtonElement).disabled).toBe(false);
        expect((quakeButton as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(sparkButton);

        // 3 - 2 = 1 remaining
        await waitFor(() => {
            expect(screen.getByText("1/9")).toBeTruthy();
        });

        // With only 1 energy left, all spells (cost ≥ 2) are now disabled
        await waitFor(() => {
            expect((screen.getByRole("button", { name: /spark/i }) as HTMLButtonElement).disabled).toBe(true);
            expect((screen.getByRole("button", { name: /wave/i }) as HTMLButtonElement).disabled).toBe(true);
            expect((screen.getByRole("button", { name: /quake/i }) as HTMLButtonElement).disabled).toBe(true);
        });
    });

    it("carries over unspent energy to next turn additively", async () => {
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
            spellSlots: [1],
            elementalResistances: { fire: 0, water: 0, earth: 0, air: 0 },
        });

        renderFight();

        // Turn 1 starts with 3 energy
        await screen.findByText("3/9");

        // Cast Spark (cost 2) → 1 remaining
        fireEvent.click(screen.getByRole("button", { name: /spark/i }));
        await waitFor(() => {
            expect(screen.getByText("1/9")).toBeTruthy();
        });

        // End turn
        await waitFor(() => {
            expect((screen.getByRole("button", { name: /end turn/i }) as HTMLButtonElement).disabled).toBe(false);
        }, { timeout: 5000 });
        fireEvent.click(screen.getByRole("button", { name: /end turn/i }));

        // Turn 2: 1 leftover + 3 gained = 4/9
        await waitFor(() => {
            expect(screen.getByText("4/9")).toBeTruthy();
        }, { timeout: 5000 });
    }, 20000);

    it("energize stacks give bonus energy next turn and are consumed", async () => {
        mockedUsePlayer.mockReturnValue({
            player: {
                level: 1,
                hp: 100,
                souls: 0,
                elements: [
                    {
                        id: 1,
                        letter: "Charge",
                        damage: 0,
                        energy: 1,
                        level: 1,
                        description: "Energize self",
                        type1: "lightning",
                        effects: [{ kind: "energize", amount: 2, target: "self" }],
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
            spellSlots: [1],
            elementalResistances: { fire: 0, water: 0, earth: 0, air: 0 },
        });

        renderFight();

        // Turn 1 starts with 3/9; cast Charge (cost 1) → 2 remaining
        await screen.findByText("3/9");
        fireEvent.click(screen.getByRole("button", { name: /charge/i }));
        await waitFor(() => {
            expect(screen.getByText("2/9")).toBeTruthy();
        });

        // Energize badge should appear showing 2 stacks
        await waitFor(() => {
            expect(screen.getByLabelText("Energize 2")).toBeTruthy();
        });

        // End turn → enemy resolves → next turn energy = 2 leftover + 3 base + 2 energize = 7
        await waitFor(() => {
            expect((screen.getByRole("button", { name: /end turn/i }) as HTMLButtonElement).disabled).toBe(false);
        }, { timeout: 5000 });
        fireEvent.click(screen.getByRole("button", { name: /end turn/i }));

        await waitFor(() => {
            expect(screen.getByText("7/9")).toBeTruthy();
        }, { timeout: 5000 });

        // Energize stacks should be consumed
        await waitFor(() => {
            expect(screen.queryByLabelText("Energize 2")).toBeNull();
        }, { timeout: 5000 });
    }, 20000);

    it("expires enemy shield at start of enemy turn so it does not stack", async () => {
        mockedUsePlayer.mockReturnValue({
            player: {
                level: 1,
                hp: 100,
                souls: 0,
                elements: [
                    {
                        id: 1,
                        letter: "Spark",
                        damage: 1,
                        energy: 1,
                        level: 1,
                        description: "Cheap spell",
                        type1: "lightning",
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
            spellSlots: [1],
            elementalResistances: { fire: 0, water: 0, earth: 0, air: 0 },
        });

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
                                name: "Shield Dummy",
                                hp: 999,
                                souls: 0,
                                sprite: "",
                                weaknesses: [],
                                elements: [
                                    {
                                        letter: "Guard",
                                        damage: 0,
                                        shield: 5,
                                        energy: 0,
                                        level: 1,
                                        description: "Adds enemy shield",
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

        render(<RouterProvider router={router} />);

        // First enemy turn grants shield.
        await waitFor(() => {
            expect((screen.getByRole("button", { name: /end turn/i }) as HTMLButtonElement).disabled).toBe(false);
        }, { timeout: 5000 });
        fireEvent.click(screen.getByRole("button", { name: /end turn/i }));

        await waitFor(() => {
            expect(screen.getByLabelText(/enemy shield 5/i)).toBeTruthy();
        }, { timeout: 5000 });

        // Second enemy turn should expire old shield before applying the new one,
        // so shield remains 5 (not 10).
        await waitFor(() => {
            expect((screen.getByRole("button", { name: /end turn/i }) as HTMLButtonElement).disabled).toBe(false);
        }, { timeout: 5000 });
        fireEvent.click(screen.getByRole("button", { name: /end turn/i }));

        await waitFor(() => {
            expect(screen.getByLabelText(/enemy shield 5/i)).toBeTruthy();
            expect(screen.queryByLabelText(/enemy shield 10/i)).toBeNull();
        }, { timeout: 5000 });
    }, 20000);
});
