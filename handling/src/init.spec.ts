import { runInitializers, init } from './init';

describe('init', () => {
  it('registers runInitializers functions without calling them', () => {
    let called = false;
    init(async () => (called = true));

    expect(called).toBe(false);
  });

  it('calls registered runInitializers functions', async () => {
    let called = false;
    init(async () => (called = true));

    await runInitializers();

    expect(called).toBe(true);
  });
});
