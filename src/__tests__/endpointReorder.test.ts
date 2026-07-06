import { describe, expect, it } from "vitest";

import {
  mergeVisibleOrder,
  sameEndpointOrder,
} from "@/pages/Endpoints/_components/reorder";

const ep = (id: number) => ({ id });

describe("endpoint filtered reorder", () => {
  it("maps filtered card order back into global slots", () => {
    expect(
      mergeVisibleOrder([ep(1), ep(2), ep(3), ep(4)], new Set([1, 3]), [ep(3), ep(1)]),
    ).toEqual([ep(3), ep(2), ep(1), ep(4)]);
  });

  it("compares endpoint order by id", () => {
    expect(sameEndpointOrder([ep(1), ep(2)], [ep(1), ep(2)])).toBe(true);
    expect(sameEndpointOrder([ep(1), ep(2)], [ep(2), ep(1)])).toBe(false);
  });
});
