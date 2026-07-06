import { describe, expect, it } from "vitest";

import {
  sameEndpointOrder,
  visibleFromGlobal,
} from "@/pages/Endpoints/_components/reorder";

const ep = (id: number) => ({ id });

describe("endpoint filtered reorder", () => {
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
