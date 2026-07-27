import { describe, expect, it } from "vitest";
import {
  buildYearMonthStats,
  parseStatsYear,
  sumMonthStats,
} from "./transaction-stats.js";

describe("buildYearMonthStats", () => {
  it("returns all 12 months with zero for missing counts", () => {
    expect(buildYearMonthStats(2026, { 6: 3 })).toEqual([
      { month: 1, mes: "2026-01", qtd: 0 },
      { month: 2, mes: "2026-02", qtd: 0 },
      { month: 3, mes: "2026-03", qtd: 0 },
      { month: 4, mes: "2026-04", qtd: 0 },
      { month: 5, mes: "2026-05", qtd: 0 },
      { month: 6, mes: "2026-06", qtd: 3 },
      { month: 7, mes: "2026-07", qtd: 0 },
      { month: 8, mes: "2026-08", qtd: 0 },
      { month: 9, mes: "2026-09", qtd: 0 },
      { month: 10, mes: "2026-10", qtd: 0 },
      { month: 11, mes: "2026-11", qtd: 0 },
      { month: 12, mes: "2026-12", qtd: 0 },
    ]);
  });
});

describe("sumMonthStats", () => {
  it("sums month quantities", () => {
    const months = buildYearMonthStats(2026, { 1: 2, 6: 3 });
    expect(sumMonthStats(months)).toBe(5);
  });
});

describe("parseStatsYear", () => {
  it("defaults to current year when omitted", () => {
    expect(parseStatsYear(undefined)).toBe(new Date().getFullYear());
  });

  it("parses valid year", () => {
    expect(parseStatsYear("2024")).toBe(2024);
  });

  it("rejects invalid year", () => {
    expect(parseStatsYear("abc")).toBeNull();
    expect(parseStatsYear("1800")).toBeNull();
  });
});
