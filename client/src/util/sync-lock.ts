export type Options = {
  channelFactory: (name: string) => {
    onmessage: ((event: MessageEvent<number>) => void) | null;
    postMessage: (number: number) => void;
    close: () => void;
  };
  intervalMs: number;
  nextNumber: () => number;
  visible: boolean;
};

const defaultOptions: Options = {
  channelFactory: name => {
    return new BroadcastChannel(name);
  },
  intervalMs: 100,
  nextNumber: () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
  // hidden docs have their timers slowed down
  // so we'll just take them out of the equation
  // This isn't exactly ideal if someone wants to load data in the background.
  get visible() {
    return !document.hidden;
  },
};

/**
 * Coordinates access to a named resource between tabs or workers (aka actors).
 *
 * Each actor is assigned a number.
 * The actor with the highest number obtains the named resource.
 *
 * Actors with lesser numbers may not use the resource.
 *
 * Actors broadcast their numbers to each other every INTERVAL / 4 milliseconds.
 *
 * Actors check if they are the greatest every INTERVAL milliseconds.
 * If they are, they will acquire the resource.
 * If they are not, they may not use the resource and will release the resources if the previously had it.
 *
 * Actors that have not broadcasted their number in INTERVAL milliseconds are considered to have left.
 *
 * Listen to `onStatusChange` to know when the current actor receives or loses the resource.
 *
 * @param name
 * @returns
 */
export function lock(name: string, options: Options = defaultOptions) {
  return new SyncLock(name, options);
}

type Time = number;
type Value = number;

class SyncLock {
  #number;
  #channel;
  #acquired = false;
  readonly #peers: Map<Value, Time> = new Map();
  readonly #listeners = new Set<(held: boolean) => void>();
  readonly #options: Options;
  readonly #destroyers: (() => void)[] = [];

  constructor(public name: string, options: Options) {
    this.#number = options.nextNumber();
    this.#channel = options.channelFactory(`sync-lock-${name}`);
    this.#options = options;

    this.#channel.onmessage = event => {
      const number = event.data;
      const now = Date.now();
      this.#peers.set(number, now);
      if (number > this.#number && this.#acquired) {
        this.#acquired = false;
        this.#notify();
      }
    };

    const expireAndBroadcastHandle = setInterval(() => {
      const now = Date.now();
      for (const [number, time] of this.#peers.entries()) {
        if (now - time >= options.intervalMs) {
          this.#peers.delete(number);
        }
      }
      if (options.visible) {
        this.#channel.postMessage(this.#number);
      }
    }, options.intervalMs / 4);
    const acquireHandle = setInterval(() => {
      this.#maybeAcquire();
    }, options.intervalMs);

    this.#destroyers.push(() => clearInterval(expireAndBroadcastHandle));
    this.#destroyers.push(() => clearInterval(acquireHandle));
    this.#destroyers.push(() => this.#channel.close());
  }

  onStatusChange(cb: (held: boolean) => void) {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  get held() {
    return this.#acquired;
  }

  #maybeAcquire() {
    if (!this.#options.visible && this.#acquired) {
      this.#acquired = false;
      this.#notify();
      return;
    }

    if (!this.#options.visible) {
      // Don't acquire if we're not visible
      return;
    }

    let hasMax = true;
    for (const n of this.#peers.keys()) {
      if (this.#number < n) {
        hasMax = false;
      }
    }

    if (hasMax) {
      if (!this.#acquired) {
        this.#acquired = true;
        this.#notify();
      }
    } else {
      if (this.#acquired) {
        this.#acquired = false;
        this.#notify();
      }
    }
  }

  #notify() {
    for (const listener of this.#listeners) {
      listener(this.#acquired);
    }
  }

  destroy() {
    for (const destroyer of this.#destroyers) {
      destroyer();
    }
  }
}

export type {SyncLock};
