describe('the checksums helper', () => {
  describe('the calculate method', () => {
    it.todo('should return hashes for this node and all its dependencies');
  });
  describe('the read method', () => {
    it.todo('should return null if hashes directory does not exist');
    it.todo('should throw if file cannot be read');
    it.todo('should throw if file content is invalid');
    it.todo('should read the correct file and extract hashes');
  });
  describe('the compare method', () => {
    it.todo('should return true if no old hashes');
    it.todo('should return true if old and current hashes has not the same number of keys');
    it.todo('should return true if old and current are different');
    it.todo('should return false if old and current are the same');
  });
  describe('the write method', () => {
    it.todo('should create hashes directory if not exist');
    it.todo('should serialize and write hashes in the correct file');
    it.todo('should throw if file cannot be written');
  });
});
