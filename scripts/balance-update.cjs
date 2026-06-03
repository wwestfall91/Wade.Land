const xlsx = require("xlsx");

// ── Enemy updates ─────────────────────────────────────────────────────────────
const ewb = xlsx.readFile("public/enemies.xlsx");
const ews = ewb.Sheets[ewb.SheetNames[0]];
const enemies = xlsx.utils.sheet_to_json(ews);

const enemyUpdates = {
    "Chad the Mad":       { HP: 55,  Power: 15 },
    "Steven Invincible":  { HP: 210, Power: 25 },
    "Manly O'Well":       { HP: 400, Power: 36 },
    "Jessica Johannson":  { HP: 600, Power: 52 },
    "Lil' Phil":          { HP: 750, Power: 80 },
};

const updatedEnemies = enemies.map(e => {
    const u = enemyUpdates[e.Name];
    if (!u) return e;
    return { ...e, HP: String(u.HP), Power: String(u.Power) };
});

const newEws = xlsx.utils.json_to_sheet(updatedEnemies);
const newEwb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(newEwb, newEws, ewb.SheetNames[0]);
xlsx.writeFile(newEwb, "public/enemies.xlsx");
console.log("enemies.xlsx updated:");
updatedEnemies.forEach(e => console.log(" ", e.Name, "HP:", e.HP, "Power:", e.Power));

// ── Spell updates ─────────────────────────────────────────────────────────────
// Per-spell overrides: { Damage, optionally "Effect 1 Amount" }
// Level 0 elements are left alone (category != spell).
// Notes on design:
//   Lv0 elements: ~10 dmg, 3/turn = 30/turn → Chad (55 HP) dies in 2 turns ✓
//   Lv4 spells: ~170 dmg → Phil (750 HP) dies in ~4-5 casts ✓
//   Lv5 spells: ~380-420 dmg → Phil (750 HP) dies in 1-2 casts ✓
const spellUpdates = {
    // ── Level 1 ──────────────────────────────────────────────────────────────
    "Bulwark":         { Damage: 0,   "Effect 1 Amount": "20" },   // shield-only, upgrade shield
    "Pyreball":        { Damage: 75 },                              // 75 + burn 10/3t ≈ 105 total

    // ── Level 2 ──────────────────────────────────────────────────────────────
    "Worble":          { Damage: 100 },                             // 100 + soak
    "Blaze":           { Damage: 100 },                             // 100 + burn
    "Regen":           { Damage: 90,  "Effect 1 Amount": "12" },    // 90 + shield 12
    "Thorns":          { Damage: 90,  "Effect 1 Amount": "12" },    // 90 + shield 12
    "Blaze Blade":     { Damage: 100 },                             // 100 + burn
    "Aqua Blade":      { Damage: 100 },                             // 100 + soak
    "Earth Blade":     { Damage: 100, "Effect 1 Amount": "12" },    // 100 + shield 12

    // ── Level 3 ──────────────────────────────────────────────────────────────
    "Levitate":        { Damage: 130, "Effect 1 Amount": "12" },    // 130 + shield 12
    "Photosynthesis":  { Damage: 145 },                             // 145 + soak (was 210, brought in line)
    "Leaf Blade":      { Damage: 140, "Effect 1 Amount": "12" },    // 140 + shield 12
    "Sand Shield":     { Damage: 120, "Effect 1 Amount": "20" },    // 120 + shield 20
    "Water Bolt":      { Damage: 65 },                              // 65×2 hits + soak = 130 total
    "Mud Shot":        { Damage: 65,  "Effect 1 Amount": "20" },    // 65 + shield 20 + soak
    "Tornado":         { Damage: 145 },                             // 145 pure
    "Air Blade":       { Damage: 135 },                             // 135 pure
    "Ice Shield":      { Damage: 55,  "Effect 1 Amount": "28" },    // 55 + shield 28 (strong shield spell)
    "Glacier":         { Damage: 145 },                             // 145 pure

    // ── Level 4 ──────────────────────────────────────────────────────────────
    "Blizzard":        { Damage: 165, "Effect 1 Amount": "15" },    // 165 + shield 15
    "Needle Storm":    { Damage: 175, "Effect 1 Amount": "12" },    // 175 + shield 12
    "Desert Blade":    { Damage: 175, "Effect 1 Amount": "12" },    // 175 + shield 12
    "Sandstorm":       { Damage: 165, "Effect 1 Amount": "15" },    // 165 + shield 15
    "Thunder Blade":   { Damage: 85 },                              // 85×2 hits = 170 total
    "Hailstorm":       { Damage: 165 },                             // 165 pure (was 58 — major fix)
    "Ice Blade":       { Damage: 170 },                             // 170 pure

    // ── Level 5 ──────────────────────────────────────────────────────────────
    "Iceblast":        { Damage: 370, "Effect 1 Amount": "20" },    // 370 + shield 20
    "Ice Bolt":        { Damage: 190 },                             // 190×2 hits = 380 total
    "Thunder":         { Damage: 140 },                             // 140×3 hits = 420 total
};

const elwb = xlsx.readFile("public/elements.xlsx");
const elws = elwb.Sheets[elwb.SheetNames[0]];
const elements = xlsx.utils.sheet_to_json(elws);

let updatedCount = 0;
const updatedElements = elements.map(el => {
    const category = (el.Category || el.category || "").toLowerCase();
    if (category !== "spell") return el;

    const u = spellUpdates[el.name];
    if (!u) return el;

    const updated = { ...el };
    if (u.Damage !== undefined)            updated.Damage = String(u.Damage);
    if (u["Effect 1 Amount"] !== undefined) updated["Effect 1 Amount"] = u["Effect 1 Amount"];
    updatedCount++;
    return updated;
});

const newElws = xlsx.utils.json_to_sheet(updatedElements);
const newElwb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(newElwb, newElws, elwb.SheetNames[0]);
xlsx.writeFile(newElwb, "public/elements.xlsx");
console.log(`\nelements.xlsx updated: ${updatedCount} spells modified`);

// Verification
const spells = updatedElements.filter(e => (e.Category || e.category || "").toLowerCase() === "spell");
console.log("\nSpell damage by level:");
[1, 2, 3, 4, 5].forEach(lv => {
    const lvSpells = spells.filter(s => String(s.Level) === String(lv));
    lvSpells.forEach(s => {
        const hits = s["Effect 1 Kind"] === "multi_hit" ? `×${s["Effect 1 Hits"]}hits` : "";
        console.log(`  Lv${lv} ${s.name}: ${s.Damage}${hits} dmg`);
    });
});
