import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Draggable from "./Draggable";
import { useNavigate, useLocation } from "react-router";
import "./Game.scss";

type RestoredSpell = {
    id: number;
    letter: string;
    damage: number;
};

type GameLocationState = {
    restoredSpells?: RestoredSpell[];
};

// TODO: Create battle scene, port elements over, make scene changer?
type Position = {
    x: number;
    y: number;
};

type DraggableItem = {
    id: number;
    letter: string;
    damage: number;
    initialPosition: Position;
};

type CombinationRecipe = {
    element1: string;
    element2: string;
    result: string;
    damage: number;
};

type ElementRow = {
    name?: string;
    Name?: string;
    ["Element 1"]?: string;
    ["Element 2"]?: string;
    damage?: number | string;
    Damage?: number | string;
};

type EnemyRow = {
    Name?: string;
    name?: string;
    HP?: number | string;
    hp?: number | string;
};

type Enemy = {
    name: string;
    hp: number;
};

const SPREAD_X = 200;
const SPREAD_Y = 150;

function Game() {
    const navigate = useNavigate();
    const location = useLocation();
    const gameRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefA = useRef<HTMLDivElement | null>(null);
    const dropZoneRefB = useRef<HTMLDivElement | null>(null);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const dropZoneRefs = [dropZoneRefA, dropZoneRefB];

    const restoredSpells = (location.state as GameLocationState | null)?.restoredSpells;

    const [draggables, setDraggables] = useState<DraggableItem[]>(() => {
        if (restoredSpells && restoredSpells.length > 0) {
            return restoredSpells.map((spell, index) => ({
                ...spell,
                initialPosition: {
                    x: (index % 3) * SPREAD_X,
                    y: Math.floor(index / 3) * SPREAD_Y,
                },
            }));
        }
        return [];
    });
    const [recipes, setRecipes] = useState<CombinationRecipe[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [zoneOccupants, setZoneOccupants] = useState<Array<number | null>>([null, null]);
    const nextId = useRef(
        restoredSpells && restoredSpells.length > 0
            ? Math.max(...restoredSpells.map((s) => s.id)) + 1
            : 1
    );

    useEffect(() => {
        const loadRecipesAndEnemies = (buffer: ArrayBuffer) => {
            const wb = XLSX.read(buffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<ElementRow>(ws);

            const parsedRows = rows
                .map((row) => ({
                    name: (row.name ?? row.Name ?? "").trim(),
                    element1: (row["Element 1"] ?? "").trim(),
                    element2: (row["Element 2"] ?? "").trim(),
                    damage: Number(row.damage ?? row.Damage ?? 0) || 0,
                }))
                .filter((row) => row.name.length > 0);

            const combinationRecipes = parsedRows
                .filter((row) => row.element1.length > 0 && row.element2.length > 0)
                .map((row) => ({
                    element1: row.element1,
                    element2: row.element2,
                    result: row.name,
                    damage: row.damage,
                }));

            setRecipes(combinationRecipes);

            if (!restoredSpells || restoredSpells.length === 0) {
                const baseElements = parsedRows.filter(
                    (row) => row.element1.length === 0 && row.element2.length === 0,
                );
                const items: DraggableItem[] = baseElements.map((row, index) => ({
                    id: nextId.current++,
                    letter: row.name,
                    damage: row.damage,
                    initialPosition: {
                        x: (index % 3) * SPREAD_X,
                        y: Math.floor(index / 3) * SPREAD_Y,
                    },
                }));
                setDraggables(items);
            }
        };

        fetch("/elements.xlsx")
            .then((res) => res.arrayBuffer())
            .then(loadRecipesAndEnemies);

        fetch("/enemies.xlsx")
            .then((res) => res.arrayBuffer())
            .then((buffer) => {
                const wb = XLSX.read(buffer, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<EnemyRow>(ws);
                const parsed: Enemy[] = rows
                    .map((row) => ({
                        name: ((row.Name ?? row.name ?? "") as string).trim(),
                        hp: Number(row.HP ?? row.hp ?? 0) || 0,
                    }))
                    .filter((e) => e.name.length > 0);
                setEnemies(parsed);
            });
    }, []);

    const canCombine = zoneOccupants.every((occupantId) => occupantId !== null);

    const handleSnapChange = (draggableId: number, zoneIndex: number | null) => {
        setZoneOccupants((previous) => {
            const next = previous.map((occupantId) =>
                occupantId === draggableId ? null : occupantId,
            );

            if (zoneIndex !== null) {
                next[zoneIndex] = draggableId;
            }

            return next;
        });
    };

    const canSnapToZone = (draggableId: number, zoneIndex: number) => {
        const occupantId = zoneOccupants[zoneIndex];
        return occupantId === null || occupantId === draggableId;
    };

    const handleCombine = () => {
        if (!canCombine) {
            return;
        }

        const consumedIds = zoneOccupants.filter((occupantId): occupantId is number => occupantId !== null);
        const occupantItems = zoneOccupants.map((occupantId) =>
            draggables.find((draggable) => draggable.id === occupantId),
        );
        const occupantLetters = occupantItems.map((item) => item?.letter ?? "");
        const occupantDamage = occupantItems.reduce((total, item) => total + (item?.damage ?? 0), 0);
        const [leftElement, rightElement] = occupantLetters;

        const matchingRecipe = recipes.find(
            (recipe) =>
                (recipe.element1 === leftElement && recipe.element2 === rightElement) ||
                (recipe.element1 === rightElement && recipe.element2 === leftElement),
        );

        const combinedLetter = matchingRecipe ? matchingRecipe.result : occupantLetters.join("");
        const combinedDamage = matchingRecipe ? matchingRecipe.damage : occupantDamage;

        if (consumedIds.length !== dropZoneRefs.length || combinedLetter.length === 0) {
            return;
        }

        const containerRect = gameRef.current?.getBoundingClientRect();
        const outputRect = outputRef.current?.getBoundingClientRect();
        if (!containerRect || !outputRect) {
            return;
        }

        const sampleDragRect = gameRef.current?.querySelector(".draggable")?.getBoundingClientRect();
        const dragWidth = sampleDragRect?.width ?? 32;
        const dragHeight = sampleDragRect?.height ?? 32;

        const newDraggable: DraggableItem = {
            id: nextId.current,
            letter: combinedLetter,
            damage: combinedDamage,
            initialPosition: {
                x: outputRect.left - containerRect.left + (outputRect.width - dragWidth) / 2,
                y: outputRect.top - containerRect.top + (outputRect.height - dragHeight) / 2,
            },
        };

        nextId.current += 1;

        setDraggables((previous) => [
            ...previous.filter((draggable) => !consumedIds.includes(draggable.id)),
            newDraggable,
        ]);
        setZoneOccupants([null, null]);
    };

    const handleFight = () => {
        const enemy = enemies.length > 0
            ? enemies[Math.floor(Math.random() * enemies.length)]
            : { name: "Unknown", hp: 0 };
        navigate("/fight", {
            state: {
                enemy,
                spells: draggables.map((draggable) => ({
                    id: draggable.id,
                    letter: draggable.letter,
                    damage: draggable.damage,
                })),
            },
        });
    };

    return (
        <div id="Game" ref={gameRef} style={{ position: "relative", width: "100%", height: "100%" }} >
            {draggables.map((draggable) => (
                <Draggable
                    key={draggable.id}
                    id={draggable.id}
                    letter={draggable.letter}
                    containerRef={gameRef}
                    dropZoneRefs={dropZoneRefs}
                    initialPosition={draggable.initialPosition}
                    onSnapChange={handleSnapChange}
                    canSnapToZone={canSnapToZone}
                />
            ))}

            <div className="element-start"></div>
            <div className="combination-station">
                <div className="combination-equation">
                    <div className="drop-zone-area">
                        <div className="drop-zone" ref={dropZoneRefA} />
                        <div>+</div>
                        <div className="drop-zone" ref={dropZoneRefB} />
                        <div>=</div>
                    </div>
                    <div className="output" ref={outputRef} />
                </div>

                <button className="combine-button" disabled={!canCombine} onClick={handleCombine}>
                    COMBINE!
                </button>
                <button className="fight-button" onClick={handleFight}>
                    FIGHT!
                </button>
            </div>
        </div>
    );
}

export default Game;