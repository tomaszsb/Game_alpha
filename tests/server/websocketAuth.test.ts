// tests/server/websocketAuth.test.ts
// Integration tests for the WebSocket auth model (DEF-2 resolution,
// 2026-06-12 user decision):
// - READS open by design: spectators connect bare and subscribe — this is
//   a classroom spectator game.
// - WRITES per-game: state_push requires the token of the game being
//   written to (a game-A token must not write to game B).
//
// Runs a real http server + initializeWebSocket with an in-memory games
// Map, and drives it with real `ws` clients.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type Server } from 'http';
import { WebSocket } from 'ws';
import { initializeWebSocket } from '../../server/websocket.js';

interface FakeGame {
  state: Record<string, unknown> | null;
  version: number;
  token: string;
  lastActivity?: string;
}

function validState(marker: string) {
  return {
    players: [{ id: 'P1', name: marker, money: 100 }],
    gamePhase: 'PLAY',
    currentPlayerId: 'P1',
    gameRound: 1,
    isGameOver: false,
  };
}

let server: Server;
let port: number;
const games = new Map<string, FakeGame>();
const openSockets: WebSocket[] = [];

beforeAll(async () => {
  server = createServer();
  initializeWebSocket(server, games);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  port = addr.port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  for (const ws of openSockets.splice(0)) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
});

function connect(query: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
    openSockets.push(ws);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/** Wait for the next message matching the predicate (5s safety timeout). */
function nextMessage(
  ws: WebSocket,
  predicate: (msg: Record<string, any>) => boolean
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 5000);
    const onMessage = (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(msg);
      }
    };
    ws.on('message', onMessage);
  });
}

describe('WebSocket spectator reads (open by design)', () => {
  it('a bare client (no token) can subscribe and receive game state', async () => {
    games.set('SPEC1', { state: validState('spectate-me'), version: 7, token: 'tok-spec1' });

    const ws = await connect('');
    const reply = nextMessage(ws, (m) => m.type === 'state_update');
    ws.send(JSON.stringify({ type: 'subscribe', gameId: 'SPEC1' }));

    const msg = await reply;
    expect(msg.payload.stateVersion).toBe(7);
    expect(msg.payload.state.players[0].name).toBe('spectate-me');
  });

  it('a client connecting with a wrong token is still rejected at connect', async () => {
    games.set('SPEC2', { state: validState('x'), version: 1, token: 'tok-spec2' });

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?gameId=SPEC2&token=WRONG`);
    openSockets.push(ws);
    const code = await new Promise<number>((resolve) => ws.once('close', resolve));
    expect(code).toBe(4001);
  });
});

describe('WebSocket writes (per-game token required)', () => {
  it('a spectator without a token cannot state_push', async () => {
    games.set('W1', { state: validState('before'), version: 3, token: 'tok-w1' });

    const ws = await connect('');
    ws.send(JSON.stringify({ type: 'subscribe', gameId: 'W1' }));
    const reply = nextMessage(ws, (m) => m.type === 'error');
    ws.send(JSON.stringify({ type: 'state_push', gameId: 'W1', payload: { state: validState('hacked') } }));

    const msg = await reply;
    expect(msg.payload.message).toContain('Authentication required for state_push');
    expect((games.get('W1')!.state as any).players[0].name).toBe('before');
    expect(games.get('W1')!.version).toBe(3);
  });

  it("a valid token for game A cannot write to game B (cross-game write fix)", async () => {
    games.set('WA', { state: validState('a-state'), version: 1, token: 'tok-wa' });
    games.set('WB', { state: validState('b-state'), version: 5, token: 'tok-wb' });

    // Authenticated for WA...
    const ws = await connect('?gameId=WA&token=tok-wa');
    const reply = nextMessage(ws, (m) => m.type === 'error');
    // ...but pushing to WB
    ws.send(JSON.stringify({ type: 'state_push', gameId: 'WB', payload: { state: validState('vandalized') } }));

    const msg = await reply;
    expect(msg.payload.message).toContain('Authentication required for state_push');
    expect((games.get('WB')!.state as any).players[0].name).toBe('b-state');
    expect(games.get('WB')!.version).toBe(5);
  });

  it('a valid token for the same game CAN state_push (players unaffected)', async () => {
    games.set('WS', { state: validState('old'), version: 2, token: 'tok-ws' });

    const ws = await connect('?gameId=WS&token=tok-ws');
    const reply = nextMessage(ws, (m) => m.type === 'version_update');
    ws.send(JSON.stringify({
      type: 'state_push',
      gameId: 'WS',
      payload: { state: validState('new'), clientVersion: 2 },
    }));

    const msg = await reply;
    expect(msg.payload.stateVersion).toBe(3);
    expect((games.get('WS')!.state as any).players[0].name).toBe('new');
  });
});
