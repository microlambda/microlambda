describe('the checksums helper', () => {
  describe('the calculate method', () => {
    test.todo('should return hashes for this node and all its dependencies');
  });
  describe('the read method', () => {
    test.todo('should return null if hashes directory does not exist');
    test.todo('should throw if file cannot be read');
    test.todo('should throw if file content is invalid');
    test.todo('should read the correct file and extract hashes');
  });
  describe('the compare method', () => {
    test.todo('should return true if no old hashes');
    test.todo('should return true if old and current hashes has not the same number of keys');
    test.todo('should return true if old and current are different');
    test.todo('should return false if old and current are the same');
  });
  describe('the write method', () => {
    test.todo('should create hashes directory if not exist');
    test.todo('should serialize and write hashes in the correct file');
    test.todo('should throw if file cannot be written');
  });
});
