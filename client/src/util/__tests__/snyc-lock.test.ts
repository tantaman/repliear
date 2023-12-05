import {test, expect, vi} from 'vitest';
import {lock} from '../sync-lock';

class BroadcastChannel {
  #listeners = new Set<(e: {data: number}) => void>();

  constructor(public readonly name: string) {}

  postMessage(message: number) {
    for (const cb of this.#listeners) {
      cb({data: message});
    }
  }

  close() {
    /* noop */
  }

  set onmessage(cb: ((e: {data: number}) => void) | null) {
    if (cb) {
      this.#listeners.add(cb);
    }
  }
}

// Inject a config we can control for testing.
function newOptions() {
  let num = 0;
  const channel = new BroadcastChannel('sync-lock-test');
  return {
    channelFactory: (_: string) => channel,
    intervalMs: 100,
    nextNumber: () => (num += 1),
    get visible() {
      return true;
    },
  };
}

test('acquires when there is only a single actor', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test1', options);

  // Lock is not held on construction
  // Must wait for full interval before acquiring.
  expect(l.held).toBe(false);

  vi.advanceTimersByTime(options.intervalMs + 1);

  expect(l.held).toBe(true);
});

test('drops as soon as a greater number arrives', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test2', options);

  vi.advanceTimersByTime(options.intervalMs + 1);

  // Lock is held by the only actor
  expect(l.held).toBe(true);

  // Broadcast a greater number to simulate a new actor arriving
  options.channelFactory('test2').postMessage(2);

  // Lock should be released
  expect(l.held).toBe(false);
});

test('drops expired peers and takes back the lock', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test3', options);

  vi.advanceTimersByTime(options.intervalMs);

  // Lock is held by the only actor
  expect(l.held).toBe(true);

  // Broadcast a greater number to simulate a new actor arriving
  options.channelFactory('test3').postMessage(2);

  // Lock should be released
  expect(l.held).toBe(false);

  // Advance time to expire the peer
  vi.advanceTimersByTime(options.intervalMs);

  // Lock should be reacquired by us
  expect(l.held).toBe(true);
});

test('does not take the lock too soon', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test4', options);

  vi.advanceTimersByTime(options.intervalMs - 1);

  // Lock is not held yet
  expect(l.held).toBe(false);

  // Advance time to acquire the lock
  vi.advanceTimersByTime(2);

  // Lock is held
  expect(l.held).toBe(true);
});

// peer is not dropped if it heartbeats in time
test('does not drop peers that heartbeat in time', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test5', options);

  vi.advanceTimersByTime(options.intervalMs);

  // Lock is held by the only actor
  expect(l.held).toBe(true);

  // Broadcast a greater number to simulate a new actor arriving
  options.channelFactory('test5').postMessage(2);

  // Lock should be released by us
  expect(l.held).toBe(false);

  // Advance time to almost expire the peer
  vi.advanceTimersByTime(options.intervalMs - 1);

  // Peer posts an update
  options.channelFactory('test5').postMessage(2);

  // Advance time to almost expire the peer
  vi.advanceTimersByTime(options.intervalMs - 1);

  // Lock should still be held by peer / released by us
  expect(l.held).toBe(false);
});

// Lock never changes hands if no heartbeats
test('acquires when there is only a single actor', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test6', options);

  // Lock is not held on construction
  // Must wait for full interval before acquiring.
  expect(l.held).toBe(false);

  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(options.intervalMs);
    expect(l.held).toBe(true);
  }
});

// We can observe the lock state
test('can observe lock state', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l = lock('test7', options);

  const states: boolean[] = [l.held];
  l.onStatusChange(state => {
    states.push(state);
  });

  // advance to acquire the lock
  vi.advanceTimersByTime(options.intervalMs);
  expect(l.held).toBe(true);
  // Peer posts an update
  options.channelFactory('test7').postMessage(2);
  vi.runAllTicks();

  expect(states).toEqual([false, true, false]);
});

test('stable lock', async () => {
  vi.useFakeTimers();
  const options = newOptions();
  const l1 = lock('test8', options);
  const l2 = lock('test8', options);
  const l3 = lock('test8', options);

  // advance to acquire the lock
  vi.advanceTimersByTime(options.intervalMs);
  expect(l1.held).toBe(false);
  expect(l2.held).toBe(false);
  expect(l3.held).toBe(true);

  // ensure lock doesn't change hands
  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(options.intervalMs);
    expect(l1.held).toBe(false);
    expect(l2.held).toBe(false);
    expect(l3.held).toBe(true);
  }

  // remove a peer
  l3.destroy();

  // check that next highest peer takes over
  vi.advanceTimersByTime(options.intervalMs);
  expect(l1.held).toBe(false);
  expect(l2.held).toBe(true);

  // repeat
  l2.destroy();
  vi.advanceTimersByTime(options.intervalMs);
  expect(l1.held).toBe(true);
});
