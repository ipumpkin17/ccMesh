export function moveBeforeEndpoint<T extends { id: number }>(
  order: T[],
  activeId: number,
  targetId: number,
): T[] {
  if (activeId === targetId) return order;
  const activeIndex = order.findIndex((endpoint) => endpoint.id === activeId);
  const targetIndex = order.findIndex((endpoint) => endpoint.id === targetId);
  if (activeIndex < 0 || targetIndex < 0) return order;

  const next = [...order];
  const [active] = next.splice(activeIndex, 1);
  next.splice(targetIndex > activeIndex ? targetIndex - 1 : targetIndex, 0, active);
  return next;
}
