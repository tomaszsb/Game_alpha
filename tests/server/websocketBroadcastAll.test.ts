// tests/server/websocketBroadcastAll.test.ts
// Integration test for broadcastToAllRooms — the primitive behind the
// deploy-update shutdown notice (TODO "📣 Active — deploy-update warning").
// Runs a real http server + initializeWebSocket with an in-memory games
// Map, same harness as websocketAuth.test.ts, and drives it with real `ws`
// clients so the room-fan-out is verified against actual socket delivery,
// not a mocked rooms Map.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type Server } from 'http';
import { WebSocket } from 'ws';
import { initializeWebSocket, broadcastToAllRooms } from '../../server/websocket.js';

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

describe('broadcastToAllRooms', () => {
  it("sends each room its OWN gameId baked into the message (a game's code IS its gameId)", async () => {
    games.set('BC1', { state: validState('a'), version: 1, token: 'tok-bc1' });
    games.set('BC2', { state: validState('b'), version: 1, token: 'tok-bc2' });

    // Spectator reads are open by design: connect bare, subscribe via a
    // message (a gameId in the connect URL without a token fails auth and
    // gets closed — see websocketAuth.test.ts).
    const wsA = await connect('');
    const wsB = await connect('');
    const subA = nextMessage(wsA, (m) => m.type === 'state_update');
    const subB = nextMessage(wsB, (m) => m.type === 'state_update');
    wsA.send(JSON.stringify({ type: 'subscribe', gameId: 'BC1' }));
    wsB.send(JSON.stringify({ type: 'subscribe', gameId: 'BC2' }));
    await Promise.all([subA, subB]);

    const noticeA = nextMessage(wsA, (m) => m.type === 'server_shutdown_notice');
    const noticeB = nextMessage(wsB, (m) => m.type === 'server_shutdown_notice');

    broadcastToAllRooms((gameId) => ({ type: 'server_shutdown_notice', gameId }));

    const [msgA, msgB] = await Promise.all([noticeA, noticeB]);
    expect(msgA.gameId).toBe('BC1');
    expect(msgB.gameId).toBe('BC2');
  });

  it('a client in one room never receives another room\'s broadcast content', async () => {
    games.set('BC3', { state: validState('c'), version: 1, token: 'tok-bc3' });
    games.set('BC4', { state: validState('d'), version: 1, token: 'tok-bc4' });

    const wsC = await connect('');
    const subC = nextMessage(wsC, (m) => m.type === 'state_update');
    wsC.send(JSON.stringify({ type: 'subscribe', gameId: 'BC3' }));
    await subC;

    let receivedForC: string | undefined;
    wsC.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'server_shutdown_notice') receivedForC = msg.gameId;
    });

    broadcastToAllRooms((gameId) => ({ type: 'server_shutdown_notice', gameId }));

    // Give the fan-out a moment to deliver, then confirm only BC3 arrived.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(receivedForC).toBe('BC3');
  });

  it('rooms with no subscribed clients are skipped without throwing', () => {
    // No connect() call for this game — its room never gets created.
    expect(() => broadcastToAllRooms((gameId) => ({ type: 'server_shutdown_notice', gameId }))).not.toThrow();
  });
});
