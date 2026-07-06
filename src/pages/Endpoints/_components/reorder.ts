import type { Endpoint } from "@/services/modules/endpoint";

export interface ReorderTarget {
  beforeId?: number;
  afterId?: number;
}

export function sameEndpointOrder(a: Pick<Endpoint, "id">[], b: Pick<Endpoint, "id">[]) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

export function moveInGlobalOrder(
  allIds: number[],
  activeId: number,
  target: ReorderTarget,
): number[] {
  if (!allIds.includes(activeId)) {
    throw new Error(`Invalid active endpoint: ${activeId}`);
  }

  const withoutActive = allIds.filter((id) => id !== activeId);
  const targetIndex = (() => {
    if (target.beforeId != null) return withoutActive.indexOf(target.beforeId);
    if (target.afterId != null) {
      const afterIndex = withoutActive.indexOf(target.afterId);
      return afterIndex < 0 ? -1 : afterIndex + 1;
    }
    return withoutActive.length;
  })();

  if (targetIndex < 0) throw new Error("Invalid reorder target");

  return [
    ...withoutActive.slice(0, targetIndex),
    activeId,
    ...withoutActive.slice(targetIndex),
  ];
}

export function visibleFromGlobal<T extends Pick<Endpoint, "id">>(
  globalOrder: T[],
  visibleIds: Set<number>,
): T[] {
  return globalOrder.filter((endpoint) => visibleIds.has(endpoint.id));
}
