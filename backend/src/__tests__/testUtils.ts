/**
 * ============================================================================
 * Toroloom WebSocket Test Utilities
 * ============================================================================
 *
 * Shared helpers used across WebSocket test suites to avoid duplicating
 * the buffered-client and event-waiting machinery.
 *
 * ============================================================================
 */

import WebSocket from 'ws';

// ──── Helpers ───────────────────────────────────────────────────────────────

/** Race a promise against a timeout — rejects if the promise doesn't settle in ms. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * Consume messages from a buffered client until one satisfies `predicate`.
 * Non-matching messages are discarded.  Rejects after `timeoutMs`.
 */
export function waitForEvent(
  client: { nextMessage: () => Promise<any> },
  predicate: (msg: any) => boolean,
  timeoutMs: number,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out (${timeoutMs}ms) waiting for matching event`));
    }, timeoutMs);

    const poll = () => {
      client.nextMessage().then((msg) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          resolve(msg);
        } else {
          poll();
        }
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    };
    poll();
  });
}

// ──── Buffered WebSocket Client ─────────────────────────────────────────────

export interface BufferedClient {
  ws: WebSocket;
  /** Dequeue the next buffered message, waiting if the buffer is empty. */
  nextMessage: () => Promise<any>;
  /**
   * Wait for `count` tick messages, ignoring non-tick messages.
   * Default timeout is 15s per call.
   */
  waitForTicks: (count: number, timeoutMs?: number) => Promise<any[]>;
  /** Close the underlying WebSocket connection. */
  close: () => void;
}

/**
 * Creates a WebSocket client that buffers all incoming messages.
 *
 * Use `nextMessage()` to dequeue the next buffered message. Messages
 * received between connection and the first `nextMessage()` call are
 * not lost — they remain in the buffer.
 */
export function createBufferedClient(port: number): Promise<BufferedClient> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timed out after 5s'));
    }, 5000);

    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    // Message buffer — stores all incoming messages as they arrive
    const buffer: any[] = [];
    let resolveNext: ((msg: any) => void) | null = null;
    let rejectNext: ((err: Error) => void) | null = null;
    let closedOrErrored = false;

    ws.on('message', (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString());

      if (resolveNext) {
        // Someone is already waiting for a message — resolve immediately
        const resolve = resolveNext;
        resolveNext = null;
        rejectNext = null;
        resolve(msg);
      } else {
        // No one is waiting — buffer the message
        buffer.push(msg);
      }
    });

    ws.on('open', () => {
      clearTimeout(timeout);

      const nextMessage = (): Promise<any> => {
        if (closedOrErrored) {
          return Promise.reject(new Error('WebSocket is closed or errored'));
        }
        if (buffer.length > 0) {
          return Promise.resolve(buffer.shift()!);
        }
        return new Promise((resolve, reject) => {
          resolveNext = resolve;
          rejectNext = reject;
        });
      };

      const waitForTicks = (count: number, timeoutMs = 15000): Promise<any[]> => {
        const ticks: any[] = [];
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Timed out waiting for ${count} ticks after ${timeoutMs}ms`));
          }, timeoutMs);

          const poll = () => {
            nextMessage().then((msg) => {
              if (msg.type === 'tick') {
                ticks.push(msg);
                if (ticks.length >= count) {
                  clearTimeout(timer);
                  resolve(ticks);
                } else {
                  poll();
                }
              } else {
                poll();
              }
            }).catch((err) => {
              clearTimeout(timer);
              reject(err);
            });
          };
          poll();
        });
      };

      const close = () => {
        ws.close();
      };

      resolve({ ws, nextMessage, waitForTicks, close });
    });

    ws.on('close', () => {
      closedOrErrored = true;
      clearTimeout(timeout);
      reject(new Error('WebSocket closed unexpectedly'));
      if (rejectNext) {
        const rejectFn = rejectNext;
        rejectNext = null;
        resolveNext = null;
        rejectFn(new Error('WebSocket closed unexpectedly'));
      }
    });

    ws.on('error', (err) => {
      closedOrErrored = true;
      clearTimeout(timeout);
      reject(err);
      if (rejectNext) {
        const rejectFn = rejectNext;
        rejectNext = null;
        resolveNext = null;
        rejectFn(err);
      }
    });
  });
}
