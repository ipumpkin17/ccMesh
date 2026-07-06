import { describe, expect, it } from "vitest";

import {
  moveInGlobalOrder,
  sameEndpointOrder,
  visibleFromGlobal,
} from "@/pages/Endpoints/_components/reorder";

const ep = (id: number) => ({ id });

describe("endpoint filtered reorder", () => {
  it("moves an endpoint before a global target", () => {
    expect(moveInGlobalOrder([1, 2, 3, 4, 5], 5, { beforeId: 1 })).toEqual([
      5, 1, 2, 3, 4,
    ]);
  });

  it("moves an endpoint after a global target", () => {
    expect(moveInGlobalOrder([1, 2, 3, 4, 5], 5, { afterId: 2 })).toEqual([
      1, 2, 5, 3, 4,
    ]);
  });

  it("rejects invalid active or target ids", () => {
    expect(() => moveInGlobalOrder([1, 2, 3], 9, { beforeId: 1 })).toThrow(
      "Invalid active endpoint",
    );
    expect(() => moveInGlobalOrder([1, 2, 3], 3, { afterId: 9 })).toThrow(
      "Invalid reorder target",
    );
  });

  it("keeps visible items derived from global order", () => {
    expect(visibleFromGlobal([ep(1), ep(2), ep(3), ep(4)], new Set([3, 1]))).toEqual([
      ep(1),
      ep(3),
    ]);
  });

  it("compares endpoint order by id", () => {
    expect(sameEndpointOrder([ep(1), ep(2)], [ep(1), ep(2)])).toBe(true);
    expect(sameEndpointOrder([ep(1), ep(2)], [ep(2), ep(1)])).toBe(false);
  });
});
