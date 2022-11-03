describe('The @microlambda/server', () => {
  describe('The fetch logs endpoint', () => {
    const fakeLogs = new Array(10 * 1000).map(() => new Array(2).map(() => '12345'));
    // 10 bytes per line, 10.000 * 10 bytes = 100KB overall
    it('should send all logs if requested slice is null and slice bellow limit');
    it('should send all logs if requested slice is [0] and slice bellow limit');
  });
});
