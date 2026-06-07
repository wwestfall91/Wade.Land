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
        kind: "heal" | "multi_hit" | "burn" | "shield" | "lifesteal" | "soak" | "freeze";
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
        playerStatuses: {
            burn: null,
            soak: null,
            freeze: null,
            thorns: null,
            float: null,
            energize: null,
            shield: 0,
        },
        typeMultipliers: {
            fire: 1,
            water: 1,
            lightning: 1,
            earth: 1,
            ice: 1,
            leaf: 1,
        },
        shieldMultiplier: 1,
        soakMultiplier: 1,
        burnMultiplier: 1,
        maxHpMultiplier: 1,
        battleEnergyCarryover: 0,
        playerName: "Tester",
        levels: [{ level: 1, hp: 100 }],
        setPlayerName: vi.fn(),
        addSouls: vi.fn(),
        initializeElements: vi.fn(),
        combineElements: vi.fn(),
        applyEnemyAttack: vi.fn(),
        healPlayer: vi.fn(),
        decreaseMaxHp: vi.fn(),
        permanentMaxHpReduction: 0,
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
    const accessibleTarget = screen.queryByRole("button", { name: new RegExp(letter, "i") });
    if (accessibleTarget instanceof HTMLButtonElement) {
        return accessibleTarget;
    }

    const buttons = Array.from(view.container.querySelectorAll(".spell-hand .spell-card"));
    const target = buttons.find((entry) =>
        (entry as HTMLElement).textContent?.replace(/\s+/g, "").toLowerCase().includes(letter.replace(/\s+/g, "").toLowerCase()),
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

const expandBattleLog = () => {
    const battleLogToggle = screen.getByRole("button", { name: /battle log/i });
    fireEvent.click(battleLogToggle);
};

describe("Fight status effects", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("applies burn to enemy and boosts fire damage", async () => {
        const view = renderFight({
            enemyHp: 60,
            playerElements: [
                {
                    id: 1,
                    letter: "BurnSigil",
                    damage: 0,
                    energy: 1,
                    level: 1,
                    description: "Applies burn",
                    type1: "fire",
                    effects: [{ kind: "burn", amount: 10, duration: 2, target: "enemy" }],
                },
                {
                    id: 2,
                    letter: "Flare",
                    damage: 10,
                    energy: 1,
                    level: 1,
                    description: "Fire strike",
                    type1: "fire",
                },
            ],
        });

        expandBattleLog();

        const burnSigilButton = clickSpellButton(view, "burnsigil");
        await waitFor(() => {
            expect(burnSigilButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByLabelText("Burn 10")).toBeTruthy();
        });

        await waitForSpellReady(view, "flare");

        const flareButton = clickSpellButton(view, "flare");
        await waitFor(() => {
            expect(flareButton.disabled).toBe(true);
        });

        await waitFor(() => {
            expect(screen.getByText(/flare \(fire\) deals 15 damage/i)).toBeTruthy();
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

        expandBattleLog();

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
                    effects: [{ kind: "freeze", amount: 100, target: "enemy" }],
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

        expandBattleLog();

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
