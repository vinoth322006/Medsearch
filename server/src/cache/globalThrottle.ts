// Global throttle — see comments. (logger removed; not used here.)
export class GlobalThrottle {
  private chain: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number, private name = 'throttle') {
    this.minIntervalMs = minIntervalMs;
  }

  async acquire(): Promise<void> {
    const ticket = this.chain.then(() => this.wait());
    this.chain = ticket.catch(() => undefined);
    return ticket;
  }

  private wait(): Promise<void> {
    return new Promise<void>((resolve) => {
      const now = Date.now();
      const elapsed = now - this.lastRequestAt;
      const delay = Math.max(0, this.minIntervalMs - elapsed);
      setTimeout(() => {
        this.lastRequestAt = Date.now();
        resolve();
      }, delay);
    });
  }

  get stats() {
    return { name: this.name, minIntervalMs: this.minIntervalMs };
  }
}
