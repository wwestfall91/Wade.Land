import { cleanup, fireEvent, render, screen, waitFor, type RenderResult } from "@testing-library/react";
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

type TestSpell = {
    id: number;
    letter: string;
    damage: number;
    energy?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: Array<{
        kind: "heal" | "multi_hit" | "burn" | "shield" | "lifesteal" | "soak";
        amount?: number;
        hits?: number;
        duration?: number;
        target?: "self" | "enemy";
    }>;
};

const renderFight = (options: { playerElements: TestSpell[]; enemyHp: number }) => {
    mockedUsePlayer.mockReturnValue({
        player: {
            level: 1,
            hp: 100,
            souls: 0,
            elements: options.playerElements,
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
                            hp: options.enemyHp,
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

const getSpellButton = (view: RenderResult, letter: string): HTMLButtonElement => {
    const buttons = Array.from(view.container.querySelectorAll(".spell-hand .spell-card"));
    const target = buttons.find((entry) =>
        (entry as HTMLElement).textContent?.toLowerCase().includes(letter.toLowerCase()),
    );
    if (!(target instanceof HTMLButtonElement)) {
        throw new Error(`Spell button not found for ${letter}`);
    }

    return target;
};

const clickSpellButton = (view: RenderResult, letter: string) => {
    const target = getSpellButton(view, letter);
    fireEvent.click(target);
    return target;
};

const waitForSpellReady = async (view: RenderResult, letter: string) => {
    await waitFor(() => {
        expect(getSpellButton(view, letter).disabled).toBe(false);
    }, { timeout: 5000 });
};

describe("Fight status effects", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("applies burn to enemy and burns for extra damage at end of turn", async () => {
        const view = renderFight({
            enemyHp: 50,
            playerElements: [
                {
                    id: 1,
                    letter: "BurnSigil",
                    damage: 0,
                    energy: 1,
                    level: 1,
                    description: "Applies burn",
                    type1: "fire",
                    effects: [{ kind: "burn", amount: 2, duration: 2, target: "enemy" }],
                },
            ],
        });

        const burnSigilButton = clickSpellButton(view, "burnsigil");
        await waitFor(() => {
            expect(burnSigilButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByLabelText("Burn 2")).toBeTruthy();
        });

        await waitFor(() => {
            expect((screen.getByRole("button", { name: /end turn/i }) as HTMLButtonElement).disabled).toBe(false);
        }, { timeout: 5000 });

        fireEvent.click(screen.getByRole("button", { name: /end turn/i }));

        await waitFor(() => {
            expect(screen.getByText(/enemy burn deals 10 damage/i)).toBeTruthy();
        }, { timeout: 5000 });
    }, 20000);

    it("soak increases lightning damage and is consumed", async () => {
        const view = renderFight({
            enemyHp: 50,
            playerElements: [
                {
                    id: 1,
                    letter: "Drench",
                    damage: 0,
                    energy: 1,
                    level: 1,
                    description: "Applies soak",
                    type1: "water",
                    effects: [{ kind: "soak", amount: 2, target: "enemy" }],
                },
                {
                    id: 2,
                    letter: "Zap",
                    damage: 10,
                    energy: 1,
                    level: 1,
                    description: "Lightning strike",
                    type1: "lightning",
                },
            ],
        });

        const drenchButton = clickSpellButton(view, "drench");
        await waitFor(() => {
            expect(drenchButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByLabelText("Soak 2")).toBeTruthy();
        });

        await waitForSpellReady(view, "zap");

        const zapButton = clickSpellButton(view, "zap");
        await waitFor(() => {
            expect(zapButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByText(/zap \(lightning\) deals 16 damage/i)).toBeTruthy();
        }, { timeout: 5000 });

        await waitFor(() => {
            expect(screen.queryByLabelText("Soak 2")).toBeNull();
        });

        await waitFor(() => {
            expect(screen.getByText(/soak evaporates/i)).toBeTruthy();
        }, { timeout: 5000 });
    }, 20000);

    it("freeze adds bonus fire damage and is consumed", async () => {
        const view = renderFight({
            enemyHp: 60,
            playerElements: [
                {
                    id: 1,
                    letter: "Drench",
                    damage: 0,
                    energy: 1,
                    level: 1,
                    description: "Applies soak",
                    type1: "water",
                    effects: [{ kind: "soak", amount: 2, target: "enemy" }],
                },
                {
                    id: 2,
                    letter: "Chill",
                    damage: 0,
                    energy: 1,
                    level: 1,
                    description: "Converts soak into freeze",
                    type1: "ice",
                },
                {
                    id: 3,
                    letter: "Flare",
                    damage: 5,
                    energy: 1,
                    level: 1,
                    description: "Fire strike",
                    type1: "fire",
                },
            ],
        });

        const drenchButton = clickSpellButton(view, "drench");
        await waitFor(() => {
            expect(drenchButton.disabled).toBe(true);
        });
        await waitFor(() => {
            expect(screen.getByLabelText("Soak 2")).toBeTruthy();
        });

        await waitForSpellReady(view, "chill");

        const chillButton = clickSpellButton(view, "chill");
        await waitFor(() => {
            expect(chillButton.disabled).toBe(true);
        });
        await waitFor(() => {
            expect(screen.getByLabelText("Freeze 2")).toBeTruthy();
        });

        await waitForSpellReady(view, "flare");

        const flareButton = clickSpellButton(view, "flare");
        await waitFor(() => {
            expect(flareButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByText(/flare \(fire\) deals 25 damage/i)).toBeTruthy();
        }, { timeout: 5000 });

        await waitFor(() => {
            expect(screen.queryByLabelText("Freeze 2")).toBeNull();
        }, { timeout: 5000 });

        await waitFor(() => {
            expect(screen.getByText(/freeze consumed/i)).toBeTruthy();
        }, { timeout: 5000 });
    }, 20000);
});
