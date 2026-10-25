// The office's "Move" list, grouped by stage (the space's `phase` in GAME_CONFIG.csv), one group open at a
// time. Inside a group the places stay in the order the student FIRST VISITED them (player.visitedSpaces);
// places never visited come after, in the order the engine gave them. Pure: lookups are injected.

export interface StageGroup<T extends { id: string }> {
  phase: string;
  items: T[];
}

/** Only a long list from the office is grouped; short lists and ordinary forks stay flat. */
export const GROUP_MIN_OPTIONS = 5;

export function groupMoveOptions<T extends { id: string }>(
  options: T[],
  visited: string[],
  phaseOf: (id: string) => string,
  phaseOrder: string[],
): StageGroup<T>[] {
  const rank = (id: string) => {
    const i = visited.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byPhase = new Map<string, T[]>();
  options.forEach((o) => {
    const ph = phaseOf(o.id) || '';
    byPhase.set(ph, [...(byPhase.get(ph) ?? []), o]);
  });
  const order = (ph: string) => {
    const i = phaseOrder.indexOf(ph);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...byPhase.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([phase, items]) => ({
      phase,
      // Array.sort is stable, so places never visited keep the engine's order.
      items: [...items].sort((a, b) => rank(a.id) - rank(b.id)),
    }));
}

/** The group to open first: the one holding the place picked, else the one with the newest first visit, else the first. */
export function defaultOpenStage<T extends { id: string }>(
  groups: StageGroup<T>[],
  visited: string[],
  selectedId: string | null,
): string | null {
  if (groups.length === 0) return null;
  if (selectedId) {
    const g = groups.find((x) => x.items.some((o) => o.id === selectedId));
    if (g) return g.phase;
  }
  let best: { phase: string; at: number } | null = null;
  for (const g of groups) {
    for (const o of g.items) {
      const at = visited.indexOf(o.id);
      if (at >= 0 && (!best || at > best.at)) best = { phase: g.phase, at };
    }
  }
  return best ? best.phase : groups[0].phase;
}
