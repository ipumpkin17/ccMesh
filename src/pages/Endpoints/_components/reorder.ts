import type { Endpoint } from "@/services/modules/endpoint";

export function sameEndpointOrder(a: Pick<Endpoint, "id">[], b: Pick<Endpoint, "id">[]) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

export function mergeVisibleOrder<T extends Pick<Endpoint, "id">>(
  globalOrder: T[],
  visibleIds: Set<number>,
  nextVisibleOrder: T[],
): T[] {
  const nextVisible = [...nextVisibleOrder];
  return globalOrder.map((endpoint) =>
    visibleIds.has(endpoint.id) ? nextVisible.shift()! : endpoint,
  );
}
