// Test-only stub for @jalez/react-flow-smart-edge.
//
// The real package ships a CJS dist/index.js inside an ESM package, and
// its ESM build named-imports CJS-only `pathfinding`. Both crash Node's
// loader when Vitest evaluates BoardCanvas.tsx under jsdom.
//
// None of our tests assert on edge geometry — they only need the import
// to succeed so the component tree can mount. This stub exports the same
// component names with React Flow's built-in smoothstep behavior so any
// future render-path test that mounts BoardCanvas still sees an edge.

import { BezierEdge, StraightEdge, StepEdge, SmoothStepEdge } from '@xyflow/react';

export const SmartBezierEdge = BezierEdge;
export const SmartStraightEdge = StraightEdge;
export const SmartStepEdge = StepEdge;
export const SmartEdge = SmoothStepEdge;
export const getSmartEdge = () => null;
