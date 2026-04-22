import { describe, it, expect } from "vitest";
import { validateDraw } from "../services/contestService";

describe("Defensive API Sync Validation (Lotomania Strict Rules)", () => {
    it("must ACCEPT an array of exactly 20 unique drawn numbers in standard domain (0..99)", () => {
        const valid20 = Array.from({ length: 20 }, (_, i) => i);
        const result = validateDraw(valid20);
        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(result)) {
            expect(result.length).toBe(20);
            expect(result[0]).toBe(0);
            expect(result[19]).toBe(19);
        }
    });

    it("must REJECT arrays with less than 20 numbers", () => {
        const drawn19 = Array.from({ length: 19 }, (_, i) => i);
        const result = validateDraw(drawn19);
        expect(result).toHaveProperty("error");
        if (!Array.isArray(result)) {
            expect(result.error).toMatch(/invalid_length_expected_20/);
        }
    });

    it("must REJECT arrays with more than 20 numbers", () => {
        const invalid21 = Array.from({ length: 21 }, (_, i) => i);
        const result = validateDraw(invalid21);
        expect(result).toHaveProperty("error");
    });

    it("must REJECT domains out of bounds (<0 or >99)", () => {
        const outBounds = Array.from({ length: 19 }, (_, i) => i);
        outBounds.push(100); // Invalid lotomania number
        const result = validateDraw(outBounds);
        expect(result).toHaveProperty("error");
    });

    it("must REJECT duplicate numbers internally", () => {
        const duplicates = Array.from({ length: 19 }, (_, i) => i);
        duplicates.push(0); // Duplicate the zero to make length 20 but unique 19
        const result = validateDraw(duplicates);
        expect(result).toHaveProperty("error");
        if (!Array.isArray(result)) {
            expect(result.error).toBe("duplicate_numbers");
        }
    });

    it("must NORMALISE inputs correctly from string representations", () => {
        const strInput = Array.from({ length: 20 }, (_, i) => `${i}`);
        const result = validateDraw(strInput);
        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(result)) {
            expect(result[0]).toBe(0);
            expect(result[19]).toBe(19);
        }
    });
});
