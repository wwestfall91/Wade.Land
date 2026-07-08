import * as XLSX from "xlsx";

// Core column headers (case-insensitive) that are mapped to typed fields.
const CORE_HEADERS = new Set(["name", "base element", "element"]);
// Any column whose name matches this pattern is collected into `rewards`.
const REWARD_COLUMN_RE = /^reward(\d+)?$/i;

/**
 * A single parsed row from the homunculus workbook.
 *
 * Core fields (`name`, `baseElement`, `element`) are always present.
 * `rewards` is built dynamically from any Reward1, Reward2, … columns — add
 * more reward columns to the sheet and they appear here automatically, in order.
 * `extras` captures every other column so that new columns added to the sheet
 * are immediately accessible without any code changes.
 */
export type HomunculusRow = {
    /** Creature name. */
    name: string;
    /** Primary element driving this creature's base stats. */
    baseElement: string;
    /** Secondary elemental affinity. */
    element: string;
    /**
     * Reward values from Reward1, Reward2, … columns, sorted by column number
     * and filtered to non-empty values.
     */
    rewards: string[];
    /**
     * Any columns that are not `Name`, `Base Element`, `Element`, or `Reward{N}`.
     * Keyed by the original header text from the spreadsheet.
     */
    extras: Record<string, unknown>;
};

/**
 * Thin, read-only wrapper around the homunculus.xlsx workbook.
 *
 * Usage:
 * ```ts
 * const wb = await HomunculusWorkbook.load();
 * const slimes = wb.filterByBaseElement("water");
 * ```
 *
 * The class is intentionally data-only — it stores whatever the sheet contains
 * and exposes simple query helpers. Adding rows or columns to the spreadsheet
 * requires no code changes.
 */
export class HomunculusWorkbook {
    /** All rows from the workbook, in sheet order, with empty-name rows omitted. */
    readonly rows: readonly HomunculusRow[];

    private constructor(rows: HomunculusRow[]) {
        this.rows = rows;
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Fetches and parses the homunculus workbook.
     *
     * @param url - Path to the `.xlsx` file. Defaults to `"/homunculus.xlsx"`.
     *              Pass `import.meta.env.BASE_URL + "homunculus.xlsx"` when a
     *              non-root base path is in use (mirrors `resolvePublicAssetUrl`).
     */
    static async load(url = "/homunculus.xlsx"): Promise<HomunculusWorkbook> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HomunculusWorkbook: failed to fetch "${url}" (HTTP ${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        // Always read the first sheet, regardless of its name.
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const rows = rawRows.map((raw) => parseRow(raw)).filter((r) => r.name.length > 0);
        return new HomunculusWorkbook(rows);
    }

    // ── Query helpers ─────────────────────────────────────────────────────────

    /** Looks up a single row by creature name (case-insensitive). */
    findByName(name: string): HomunculusRow | undefined {
        const key = name.trim().toLowerCase();
        return this.rows.find((r) => r.name.toLowerCase() === key);
    }

    /** Returns every row whose `baseElement` matches (case-insensitive). */
    filterByBaseElement(baseElement: string): readonly HomunculusRow[] {
        const key = baseElement.trim().toLowerCase();
        return this.rows.filter((r) => r.baseElement.toLowerCase() === key);
    }

    /** Returns every row whose `element` matches (case-insensitive). */
    filterByElement(element: string): readonly HomunculusRow[] {
        const key = element.trim().toLowerCase();
        return this.rows.filter((r) => r.element.toLowerCase() === key);
    }

    /**
     * Returns rows matching both `baseElement` and `element` (case-insensitive).
     * Useful for looking up a specific base/element combination.
     */
    filterByCombination(baseElement: string, element: string): readonly HomunculusRow[] {
        const baseKey = baseElement.trim().toLowerCase();
        const elemKey = element.trim().toLowerCase();
        return this.rows.filter(
            (r) => r.baseElement.toLowerCase() === baseKey && r.element.toLowerCase() === elemKey,
        );
    }

    /** The distinct base element values present in the workbook. */
    get baseElements(): string[] {
        return [...new Set(this.rows.map((r) => r.baseElement).filter((v) => v.length > 0))];
    }

    /** The distinct element values present in the workbook. */
    get elements(): string[] {
        return [...new Set(this.rows.map((r) => r.element).filter((v) => v.length > 0))];
    }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseRow(raw: Record<string, unknown>): HomunculusRow {
    const name = coerceString(raw["Name"] ?? raw["name"]);
    const baseElement = coerceString(raw["Base Element"] ?? raw["base element"]);
    const element = coerceString(raw["Element"] ?? raw["element"]);

    // Collect reward columns: sort by their trailing number so the array is ordered.
    const rewardEntries: Array<[number, string]> = [];
    const extras: Record<string, unknown> = {};

    for (const [header, value] of Object.entries(raw)) {
        const normalized = header.trim().toLowerCase();
        if (CORE_HEADERS.has(normalized)) {
            continue;
        }
        if (REWARD_COLUMN_RE.test(normalized)) {
            const numPart = normalized.replace(/[^0-9]/g, "");
            const index = numPart.length > 0 ? parseInt(numPart, 10) : 0;
            const text = coerceString(value);
            if (text.length > 0) {
                rewardEntries.push([index, text]);
            }
        } else {
            extras[header] = value;
        }
    }

    const rewards = rewardEntries.sort(([a], [b]) => a - b).map(([, v]) => v);

    return { name, baseElement, element, rewards, extras };
}

function coerceString(value: unknown): string {
    return String(value ?? "").trim();
}
