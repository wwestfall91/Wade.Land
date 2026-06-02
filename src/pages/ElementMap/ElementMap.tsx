import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import type { SpellEffectConfig } from "../../combat/spellEffects";
import { parseSpellEffectsFromRow } from "../../combat/spellEffects";
import FloatingTooltip from "../Game/FloatingTooltip";
import ElementIcon from "../../components/ElementIcon";
import "./ElementMap.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

type ElementNode = {
    letter: string;
    damage: number;
    energy?: number;
    level: number;
    description: string;
    type1?: string;
    type2?: string;
    effects?: SpellEffectConfig[];
};

type Recipe = {
    element1: string;
    element2: string;
    result: string;
};

type SortKey = "power" | "energy" | "type" | "level";

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 68;
const NODE_H = 68;
const COL_GAP = 8;    // horizontal gap between elements within a level row
const ROW_GAP = 130;  // vertical gap between level rows (room for bezier lines)
const ROW_PADDING_TOP = 48;
const ROW_PADDING_LEFT = 68;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeType = (v?: string) => (v ?? "").trim().toLowerCase();
const normalizeElementName = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function typeColorClass(type?: string): string {
    const t = normalizeType(type);
    if (!t) return "em-node--none";
    return `em-node--${t}`;
}

function sortNodes(nodes: ElementNode[], key: SortKey): ElementNode[] {
    return [...nodes].sort((a, b) => {
        switch (key) {
            case "power":
                return b.damage - a.damage;
            case "energy":
                return (b.energy ?? 0) - (a.energy ?? 0);
            case "type": {
                const ta = normalizeType(a.type1) || normalizeType(a.type2) || "zzz";
                const tb = normalizeType(b.type1) || normalizeType(b.type2) || "zzz";
                return ta.localeCompare(tb) || a.letter.localeCompare(b.letter);
            }
            case "level":
                return a.level - b.level || a.letter.localeCompare(b.letter);
            default:
                return 0;
        }
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ElementMap() {
    const navigate = useNavigate();

    const [nodes, setNodes] = useState<ElementNode[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("level");
    const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [pinnedLetter, setPinnedLetter] = useState<string | null>(null);
    const [pinnedAnchorEl, setPinnedAnchorEl] = useState<HTMLElement | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
    const [ctrlHeld, setCtrlHeld] = useState(false);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [, forceRedraw] = useState(0);

    // Close on Escape / Ctrl+M; track Ctrl held for tooltip suppression
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            if (e.key === "Control" || e.key === "Meta") setCtrlHeld(true);
            if (e.key === "Escape") navigate("/game");
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
                e.preventDefault();
                navigate("/game");
            }
        };
        const onUp = (e: KeyboardEvent) => {
            if (e.key === "Control" || e.key === "Meta") setCtrlHeld(false);
        };
        const onBlur = () => setCtrlHeld(false);
        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
            window.removeEventListener("blur", onBlur);
        };
    }, [navigate]);

    // Load elements.xlsx
    useEffect(() => {
        fetch("/elements.xlsx")
            .then((r) => r.arrayBuffer())
            .then((buf) => {
                const wb = XLSX.read(buf, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rows = XLSX.utils.sheet_to_json<any>(ws);

                const parsed: ElementNode[] = rows
                    .map((row) => ({
                        letter: String(row.name ?? row.Name ?? "").trim(),
                        damage: Number(row.damage ?? row.Damage ?? 0) || 0,
                        energy: Math.max(0, Number(row.energy ?? row.Energy ?? 0) || 0),
                        level: (() => {
                            const raw = row.Level ?? row.level;
                            if (raw !== undefined && raw !== null && String(raw).trim() !== "") return Number(raw);
                            return (String(row["Element 1"] ?? "")).trim().length === 0 ? 1 : 2;
                        })(),
                        description: String(row.Description ?? row.description ?? "").trim(),
                        type1: normalizeType(row.Type1 || ""),
                        type2: normalizeType(row.Type2 || ""),
                        effects: parseSpellEffectsFromRow(row),
                    }))
                    .filter((n) => n.letter.length > 0);

                const recipeList: Recipe[] = rows
                    .map((row) => ({
                        element1: String(row["Element 1"] ?? "").trim(),
                        element2: String(row["Element 2"] ?? "").trim(),
                        result: String(row.name ?? row.Name ?? "").trim(),
                    }))
                    .filter((r) => r.element1.length > 0 && r.element2.length > 0 && r.result.length > 0);

                setNodes(parsed);
                setRecipes(recipeList);
            });
    }, []);

    // Re-draw lines after layout
    useEffect(() => {
        const id = window.requestAnimationFrame(() => forceRedraw((n) => n + 1));
        return () => window.cancelAnimationFrame(id);
    }, [nodes, sortKey, searchQuery]);

    // Build lookup
    const nodeMap = useMemo(
        () => new Map(nodes.map((n) => [normalizeElementName(n.letter), n])),
        [nodes],
    );

    const toggleType = useCallback((type: string) => {
        setHiddenTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    // Filter
    const filteredNodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        const typeFilter = (n: ElementNode) => {
            const primaryType = n.type1 || n.type2 || "";
            return !(hiddenTypes.size > 0 && primaryType && hiddenTypes.has(primaryType));
        };

        if (!q) return nodes.filter(typeFilter);

        // Find direct matches first
        const directMatches = new Set(
            nodes
                .filter((n) =>
                    n.letter.toLowerCase().includes(q) ||
                    normalizeType(n.type1).includes(q) ||
                    normalizeType(n.type2).includes(q),
                )
                .map((n) => normalizeElementName(n.letter)),
        );

        // Walk ancestors (ingredients) and descendants (products) transitively
        const related = new Set(directMatches);

        const addAncestors = (key: string) => {
            for (const r of recipes) {
                if (normalizeElementName(r.result) === key) {
                    const k1 = normalizeElementName(r.element1);
                    const k2 = normalizeElementName(r.element2);
                    if (!related.has(k1)) { related.add(k1); addAncestors(k1); }
                    if (!related.has(k2)) { related.add(k2); addAncestors(k2); }
                }
            }
        };

        const addDescendants = (key: string) => {
            for (const r of recipes) {
                if (normalizeElementName(r.element1) === key || normalizeElementName(r.element2) === key) {
                    const rk = normalizeElementName(r.result);
                    if (!related.has(rk)) { related.add(rk); addDescendants(rk); }
                }
            }
        };

        for (const key of directMatches) {
            addAncestors(key);
            addDescendants(key);
        }

        return nodes.filter((n) => typeFilter(n) && related.has(normalizeElementName(n.letter)));
    }, [nodes, recipes, searchQuery, hiddenTypes]);

    // Group by level then sort within group
    const levelGroups = useMemo(() => {
        const map = new Map<number, ElementNode[]>();
        const sorted = sortNodes(filteredNodes, sortKey);
        for (const n of sorted) {
            const lvl = n.level;
            if (!map.has(lvl)) map.set(lvl, []);
            map.get(lvl)!.push(n);
        }
        return [...map.entries()].sort((a, b) => a[0] - b[0]);
    }, [filteredNodes, sortKey]);

    // Position map: letter → {x, y} center
    const posMap = useMemo(() => {
        const m = new Map<string, { x: number; y: number }>();
        levelGroups.forEach(([, group], rowIdx) => {
            group.forEach((node, colIdx) => {
                const cx = ROW_PADDING_LEFT + colIdx * (NODE_W + COL_GAP) + NODE_W / 2;
                const cy = ROW_PADDING_TOP + rowIdx * (NODE_H + ROW_GAP) + NODE_H / 2;
                m.set(normalizeElementName(node.letter), { x: cx, y: cy });
            });
        });
        return m;
    }, [levelGroups]);

    // Canvas dimensions
    const canvasW = useMemo(() => {
        const maxCols = Math.max(...levelGroups.map(([, g]) => g.length), 0);
        return Math.max(800, ROW_PADDING_LEFT + maxCols * (NODE_W + COL_GAP) + 32);
    }, [levelGroups]);

    const canvasH = useMemo(() => {
        const rows = levelGroups.length;
        return Math.max(600, ROW_PADDING_TOP * 2 + rows * (NODE_H + ROW_GAP));
    }, [levelGroups]);

    // Hover takes priority over pin; active letter drives highlighting and tooltip
    const activeLetter = hoveredLetter ?? pinnedLetter;
    const activeAnchorEl = hoveredLetter ? anchorEl : pinnedAnchorEl;

    // Which elements are connected to active (hovered or pinned) node
    const connectedLetters = useMemo(() => {
        if (!activeLetter) return new Set<string>();
        const key = normalizeElementName(activeLetter);
        const set = new Set<string>();
        for (const r of recipes) {
            const rKey = normalizeElementName(r.result);
            const e1Key = normalizeElementName(r.element1);
            const e2Key = normalizeElementName(r.element2);
            if (rKey === key || e1Key === key || e2Key === key) {
                set.add(rKey);
                set.add(e1Key);
                set.add(e2Key);
            }
        }
        return set;
    }, [activeLetter, recipes]);

    // Upstream-only connections for pin: just the ingredients that produce the pinned element
    const pinnedConnections = useMemo(() => {
        if (!pinnedLetter) return new Set<string>();
        const key = normalizeElementName(pinnedLetter);
        const set = new Set<string>();
        for (const r of recipes) {
            if (normalizeElementName(r.result) === key) {
                set.add(normalizeElementName(r.element1));
                set.add(normalizeElementName(r.element2));
            }
        }
        return set;
    }, [pinnedLetter, recipes]);

    // Build SVG edges
    const edges = useMemo(() => {
        if (posMap.size === 0) return [];
        return recipes
            .map((r) => {
                const resultKey = normalizeElementName(r.result);
                const e1Key = normalizeElementName(r.element1);
                const e2Key = normalizeElementName(r.element2);
                const rPos = posMap.get(resultKey);
                const e1Pos = posMap.get(e1Key);
                const e2Pos = posMap.get(e2Key);
                if (!rPos || !e1Pos || !e2Pos) return null;
                return { r: r.result, e1: r.element1, e2: r.element2, rPos, e1Pos, e2Pos };
            })
            .filter(Boolean) as {
                r: string; e1: string; e2: string;
                rPos: { x: number; y: number };
                e1Pos: { x: number; y: number };
                e2Pos: { x: number; y: number };
            }[];
    }, [posMap, recipes]);

    const setNodeRef = useCallback((letter: string, el: HTMLDivElement | null) => {
        if (el) nodeRefs.current.set(letter, el);
        else nodeRefs.current.delete(letter);
    }, []);

    const handleNodeEnter = useCallback((letter: string, el: HTMLDivElement) => {
        setHoveredLetter(letter);
        setAnchorEl(el);
    }, []);

    const handleNodeLeave = useCallback(() => {
        setHoveredLetter(null);
        setAnchorEl(null);
    }, []);

    const handleNodeClick = useCallback((letter: string, el: HTMLDivElement) => {
        setPinnedLetter((prev) => {
            const key = normalizeElementName(letter);
            if (prev !== null && normalizeElementName(prev) === key) {
                setPinnedAnchorEl(null);
                return null;
            }
            setPinnedAnchorEl(el);
            return letter;
        });
    }, []);

    // Hover takes priority over pin for tooltip anchor; pin persists when not hovering
    const activeNode = activeLetter ? nodeMap.get(normalizeElementName(activeLetter)) ?? null : null;
    const hoveredNode = activeNode;

    const SORT_LABELS: { key: SortKey; label: string }[] = [
        { key: "level", label: "Level" },
        { key: "power", label: "Power" },
        { key: "energy", label: "Energy" },
        { key: "type", label: "Type" },
    ];

    const ALL_TYPES = ["fire", "water", "earth", "air", "lightning", "steel", "leaf", "ice", "arcane", "light", "dark"];

    return (
        <div className="element-map-root">
            {/* ── Toolbar ── */}
            <div className="em-toolbar">
                <button className="em-close-btn" onClick={() => navigate("/game")} title="Back to Game (Esc)">
                    ✕
                </button>
                <span className="em-title">Element Map</span>
                <div className="em-sort-group">
                    <span className="em-sort-label">Sort:</span>
                    {SORT_LABELS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`em-sort-btn${sortKey === key ? " is-active" : ""}`}
                            onClick={() => setSortKey(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <input
                    className="em-search"
                    placeholder="Search elements…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="em-hint">Ctrl+M to close</span>
            </div>

            {/* ── Scroll canvas ── */}
            <div className="em-scroll-area" ref={containerRef}>
                <div
                    className="em-canvas"
                    style={{ width: canvasW, height: canvasH }}
                    onClick={() => { setPinnedLetter(null); setPinnedAnchorEl(null); }}
                >
                    {/* SVG layer: connection lines */}
                    <svg
                        ref={svgRef}
                        className="em-svg"
                        width={canvasW}
                        height={canvasH}
                        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
                    >
                        <defs>
                            <marker id="em-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.22)" />
                            </marker>
                        </defs>
                        {edges.map((edge, i) => {
                            const rKey = normalizeElementName(edge.r);
                            const e1Key = normalizeElementName(edge.e1);
                            const e2Key = normalizeElementName(edge.e2);

                            // When hovering: highlight edges touching the hovered node (all directions)
                            // When pinned (no hover): highlight only edges where result === pinned node
                            let isHighlighted = false;
                            if (hoveredLetter !== null) {
                                const hKey = normalizeElementName(hoveredLetter);
                                isHighlighted = (
                                    (rKey === hKey || e1Key === hKey || e2Key === hKey) &&
                                    (connectedLetters.has(rKey) || connectedLetters.has(e1Key) || connectedLetters.has(e2Key))
                                );
                            } else if (pinnedLetter !== null) {
                                const pKey = normalizeElementName(pinnedLetter);
                                isHighlighted = rKey === pKey;
                            }

                            const hasActive = hoveredLetter !== null || pinnedLetter !== null;
                            const isDimmedEdge = hasActive && !isHighlighted;
                            const opacity = isDimmedEdge ? 0.06 : isHighlighted ? 0.85 : 0.18;
                            const strokeW = isHighlighted ? 2 : 1;
                            const color = isHighlighted ? "#88cfff" : "rgba(255,255,255,0.7)";

                            // Bezier from ingredient to result (vertical flow)
                            const midY1 = (edge.e1Pos.y + edge.rPos.y) / 2;
                            const midY2 = (edge.e2Pos.y + edge.rPos.y) / 2;

                            return (
                                <g key={i} opacity={opacity}>
                                    <path
                                        d={`M${edge.e1Pos.x},${edge.e1Pos.y} C${edge.e1Pos.x},${midY1} ${edge.rPos.x},${midY1} ${edge.rPos.x},${edge.rPos.y}`}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={strokeW}
                                        markerEnd={isHighlighted ? "url(#em-arrow)" : undefined}
                                    />
                                    <path
                                        d={`M${edge.e2Pos.x},${edge.e2Pos.y} C${edge.e2Pos.x},${midY2} ${edge.rPos.x},${midY2} ${edge.rPos.x},${edge.rPos.y}`}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={strokeW}
                                        markerEnd={isHighlighted ? "url(#em-arrow)" : undefined}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Row headers */}
                    {levelGroups.map(([lvl], rowIdx) => (
                        <div
                            key={`header-${lvl}`}
                            className="em-row-header"
                            style={{
                                left: 8,
                                top: ROW_PADDING_TOP + rowIdx * (NODE_H + ROW_GAP),
                                height: NODE_H,
                            }}
                        >
                            Lv {lvl}
                        </div>
                    ))}

                    {/* Nodes */}
                    {levelGroups.map(([lvl, group], rowIdx) =>
                        group.map((node, colIdx) => {
                            const nodeKey = normalizeElementName(node.letter);
                            const isPinned = pinnedLetter !== null && normalizeElementName(pinnedLetter) === nodeKey;
                            // When hovering: show all direct connections; when pinned: upstream ingredients only
                            const activeConnections = hoveredLetter ? connectedLetters : pinnedConnections;
                            const isActive = activeLetter !== null && normalizeElementName(activeLetter) === nodeKey;
                            const isConnected = activeLetter !== null && activeConnections.has(nodeKey);
                            const isDimmed = activeLetter !== null && !isActive && !isConnected;
                            const primaryType = node.type1 || node.type2;

                            const x = ROW_PADDING_LEFT + colIdx * (NODE_W + COL_GAP);
                            const y = ROW_PADDING_TOP + rowIdx * (NODE_H + ROW_GAP);

                            // Ingredients & products for recipe info strip
                            const ingredients = recipes.filter(
                                (r) => normalizeElementName(r.result) === nodeKey,
                            );
                            const products = recipes.filter(
                                (r) =>
                                    normalizeElementName(r.element1) === nodeKey ||
                                    normalizeElementName(r.element2) === nodeKey,
                            );

                            return (
                                <div
                                    key={`${lvl}-${node.letter}`}
                                    className={[
                                        "em-node",
                                        typeColorClass(primaryType),
                                        isActive ? "is-hovered" : "",
                                        isPinned && !isActive ? "is-pinned" : "",
                                        isConnected && !isActive ? "is-connected" : "",
                                        isDimmed ? "is-dimmed" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    style={{ left: x, top: y, width: NODE_W, height: NODE_H, cursor: "pointer" }}
                                    ref={(el) => setNodeRef(node.letter, el)}
                                    onMouseEnter={(e) => handleNodeEnter(node.letter, e.currentTarget)}
                                    onMouseLeave={handleNodeLeave}
                                    onClick={(e) => { e.stopPropagation(); handleNodeClick(node.letter, e.currentTarget); }}
                                    title={`${node.letter} | Uses: ${ingredients.length} recipe(s) | Used in: ${products.length} recipe(s)`}
                                >
                                    <div className="em-node__icon">
                                        <ElementIcon name={node.letter} />
                                    </div>
                                    <div className="em-node__name">{node.letter}</div>
                                    {node.damage > 0 ? (
                                        <div className="em-node__damage">{node.damage}</div>
                                    ) : null}
                                    {isConnected && !isActive ? (
                                        <div className="em-node__recipe-count">
                                            {ingredients.length > 0 ? `↙${ingredients.length}` : ""}
                                            {products.length > 0 ? ` ↗${products.length}` : ""}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }),
                    )}
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="em-legend">
                {ALL_TYPES.map((t) => (
                    <button
                        key={t}
                        className={`em-legend-chip em-node--${t}${hiddenTypes.has(t) ? " is-hidden" : ""}`}
                        onClick={() => toggleType(t)}
                        title={hiddenTypes.has(t) ? `Show ${t} elements` : `Hide ${t} elements`}
                    >
                        {t}
                    </button>
                ))}
                {hiddenTypes.size === 0 ? (
                    <button
                        className="em-legend-reset"
                        onClick={() => setHiddenTypes(new Set(ALL_TYPES))}
                    >
                        hide all
                    </button>
                ) : (
                    <button
                        className="em-legend-reset"
                        onClick={() => setHiddenTypes(new Set())}
                    >
                        show all
                    </button>
                )}
            </div>

            {/* ── Floating tooltip ── */}
            {hoveredNode && ctrlHeld ? (
                <FloatingTooltip
                    anchorElement={activeAnchorEl}
                    open={hoveredNode !== null}
                    className="drag-description-popup"
                    clampHorizontal={true}
                    elementDetails={{
                        letter: hoveredNode.letter,
                        damage: hoveredNode.damage,
                        energy: hoveredNode.energy,
                        description: hoveredNode.description,
                        type1: hoveredNode.type1,
                        type2: hoveredNode.type2,
                        effects: hoveredNode.effects,
                        level: hoveredNode.level,
                    }}
                />
            ) : null}

            {/* ── Stats bar ── */}
            <div className="em-stats-bar">
                <span>{nodes.length} elements</span>
                <span>·</span>
                <span>{recipes.length} recipes</span>
                {searchQuery ? (
                    <>
                        <span>·</span>
                        <span>{filteredNodes.length} matching</span>
                    </>
                ) : null}
            </div>
        </div>
    );
}
