import type { Endpoint } from "@/services/modules/endpoint";

export function sameEndpointOrder(a: Pick<Endpoint, "id">[], b: Pick<Endpoint, "id">[]) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

export function visibleFromGlobal<T extends Pick<Endpoint, "id">>(
  globalOrder: T[],
  visibleIds: Set<number>,
): T[] {
  return globalOrder.filter((endpoint) => visibleIds.has(endpoint.id));
}
