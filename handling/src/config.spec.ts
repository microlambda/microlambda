import { config, getConfig } from './config';

describe('config', () => {
  it('changes the default options', () => {
    config({ api: { cors: true, blacklist: ['foobar'] } });
    expect(getConfig()).toStrictEqual({ api: { cors: true, blacklist: ['foobar'] } });
  });
});
