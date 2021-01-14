import { config, getConfig } from './config';

describe('config', () => {
  it('changes the default options', () => {
    config({ api: { cors: true, blacklist: ['foobar'] } });
    expect(getConfig()).toEqual({ api: { cors: true, blacklist: ['foobar'] } });
  });
});
