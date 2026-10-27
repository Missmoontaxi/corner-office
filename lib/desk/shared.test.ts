import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { COFFEE, DEEP_LINK_NAMES, coffeeComparison, parseWeather } from "./shared";

const cup = COFFEE.pricePerPound / COFFEE.cupsPerPound;

describe("coffee comparison", () => {
  it("prices a cup from the BLS pound and the SCA ratio", () => {
    expect(cup).toBeCloseTo(0.27, 2);
  });

  it("reads Paula's line for today's morning", () => {
    expect(coffeeComparison(0.16)).toBe("just over half the cost of a cup of coffee");
  });

  it("stays true when the morning costs more or less", () => {
    expect(coffeeComparison(cup * 0.5)).toBe("about half the cost of a cup of coffee");
    expect(coffeeComparison(cup * 0.3)).toBe("less than half the cost of a cup of coffee");
    expect(coffeeComparison(cup)).toBe("about the cost of a cup of coffee");
    expect(coffeeComparison(cup * 2)).toBe("about the cost of 2 cups of coffee");
  });
});

describe("weather line", () => {
  it("reads the seed's weather into numbers and an emoji", () => {
    expect(parseWeather("High 58 Low 42 Sunny")).toMatchObject({ high: 58, low: 42, sky: "Sunny", emoji: "☀️" });
    expect(parseWeather("")).toBeNull();
  });
});

describe("deep links", () => {
  it("rewrites exactly the names that have prebuilt pages", () => {
    const config = fs.readFileSync("next.config.ts", "utf8");
    const listed = config.match(/\(\?<view>([a-z|]+)\)/)?.[1]?.split("|").sort();
    expect(listed).toEqual([...DEEP_LINK_NAMES].sort());
  });
});
