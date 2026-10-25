// The town's small scenery layer (flowers, grass tufts, fallen leaves, snow drifts), drawn on the grass just above the
// weather and under every building, tree-sorted by depth, so it can never cover a name sign, a clock, a bubble or a walker.

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { AreaSegment } from '../../utils/townAreas';
import { isoPoint, type TownLayout } from '../../utils/townLayout';
import type { SeasonLook } from '../../utils/townSeasons';
import { bandProps, propBudget, type FreeTest, type Spot, type TownProp } from '../../utils/townProps';
import type { SceneLevel } from '../../utils/townWeather';

/** Drawn width of a prop picture (px); the 32 px pictures are enlarged. */
export const PROP_PX = 56;

export interface PropsData extends Record<string, unknown> {
  w: number;
  h: number;
  items: Array<{ prop: TownProp; x: number; y: number }>;
  /** Fade a new prop in (Full scene only, never with reduced motion). */
  fade: boolean;
}

/** Every band's props: pure, from who owns which ground, each owner's days and look, and the scene settings. */
export function buildTownProps(o: {
  layout: Pick<TownLayout, 'trees' | 'seats'>;
  spots: Spot[];
  free: FreeTest;
  segments: AreaSegment[];
  looks: SeasonLook[];
  days: number[];
  seed: string;
  level: SceneLevel;
  light: boolean;
  tile: number;
  originX: number;
  originY: number;
}): TownProp[] {
  if (o.level === 'off') return [];
  const budget = propBudget(o.segments.length, o.light);
  const out: TownProp[] = [];
  for (const seg of o.segments) {
    const inBand = (row: number) => row >= seg.from && row < seg.to;
    out.push(...bandProps({
      spots: o.spots.filter(s => inBand(s.row)),
      free: o.free,
      trees: o.layout.trees.filter(t => inBand(t.row)),
      days: o.days[seg.seat] ?? 0,
      look: o.looks[seg.seat],
      seed: o.seed, seat: seg.seat, budget, light: o.light,
    }));
  }
  return out.sort((a, b) => (a.col + a.row) - (b.col + b.row));
}

const CSS = `@keyframes uc-prop-in { from { opacity: 0; } to { opacity: 1; } }`;

export function TownPropsNode({ data }: NodeProps<Node<PropsData>>) {
  const { w, h, items, fade } = data;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }} data-testid="town-props">
      {fade && <style>{CSS}</style>}
      {items.map(({ prop, x, y }) => (
        <image
          key={prop.id} href={`/images/props/${prop.pic}.png`} x={x - PROP_PX / 2} y={y - PROP_PX * 0.9} width={PROP_PX} height={PROP_PX}
          data-testid={`town-prop-${prop.kind}`}
          style={{ imageRendering: 'pixelated', ...(fade ? { animation: 'uc-prop-in 0.8s ease-out' } : {}) }}
        />
      ))}
    </svg>
  );
}

/** Where a prop is drawn on the layer. */
export function propPoint(p: Pick<TownProp, 'col' | 'row'>, tile: number, originX: number, originY: number): { x: number; y: number } {
  const pt = isoPoint(p.col, p.row, 0, tile);
  return { x: pt.x - originX, y: pt.y - originY };
}
