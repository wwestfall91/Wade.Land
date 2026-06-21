import { describe, expect, it } from "vitest";
import { getCombinationStationState } from "./CombinationStation";

describe("combination station state machine", () => {
    it("resolves the correct mode for each element slot key", () => {
        expect(getCombinationStationState("fire")).toMatchObject({ key: "incubate", actionLabel: "Incubate", elementKey: "fire" });
        expect(getCombinationStationState("earth")).toMatchObject({ key: "refine", actionLabel: "Refine", elementKey: "earth" });
        expect(getCombinationStationState("water")).toMatchObject({ key: "mix", actionLabel: "Mix", elementKey: "water" });
        expect(getCombinationStationState("air")).toMatchObject({ key: "divide", actionLabel: "Divide", elementKey: "air" });
        expect(getCombinationStationState("soul")).toMatchObject({ key: "duplicate", actionLabel: "Duplicate", elementKey: "soul" });
    });

    it("falls back to idle for unknown or empty elements", () => {
        expect(getCombinationStationState("unknown")).toMatchObject({ key: "idle", actionLabel: "-" });
        expect(getCombinationStationState("")).toMatchObject({ key: "idle", actionLabel: "-" });
    });
});
