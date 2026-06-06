import { describe, expect, it } from "vitest";
import { getCombinationStationState } from "./Game";

describe("combination station state machine", () => {
    it("resolves the five actionable states from slot one element", () => {
        expect(getCombinationStationState("water")).toMatchObject({ key: "cleanse", actionLabel: "Cleanse", elementKey: "water" });
        expect(getCombinationStationState("air")).toMatchObject({ key: "polish", actionLabel: "Polish", elementKey: "air" });
        expect(getCombinationStationState("fire")).toMatchObject({ key: "purify", actionLabel: "Purify", elementKey: "fire" });
        expect(getCombinationStationState("earth")).toMatchObject({ key: "refine", actionLabel: "Refine", elementKey: "earth" });
        expect(getCombinationStationState("soul")).toMatchObject({ key: "enhance", actionLabel: "Enhance", elementKey: "soul" });
    });

    it("falls back to idle for unknown or empty elements", () => {
        expect(getCombinationStationState("unknown")).toMatchObject({ key: "idle", actionLabel: "-" });
        expect(getCombinationStationState("")).toMatchObject({ key: "idle", actionLabel: "-" });
    });
});
