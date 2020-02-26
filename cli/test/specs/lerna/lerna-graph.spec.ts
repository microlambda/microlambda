/**
 Lerna graph is one of the most important class of the project.
 The dependency graph is built at the beginning of the start command.
 It is very important to know the dependencies between package to:
 - compile packages in the correct order: if package B depends on A and you try to compile package B before A, it
   will fail.
 - stop all impacted services when watcher is triggered because a shared dependency is modified.

 The LernaGraph constructor is responsible for building this graph from lerna commands outputs.
 Let's take this dependency graph for testing purpose.


                                          service C
                                        /   |       \
                                      /     |        \
               service A  service B ---      \        \
                  \        /               / \         \
                   \       /             /  \      package G
                   package D           /   \      /
                  /                   /    \     /
                 /                   /     \    /
            package E------------- /       package F
 */

describe('The LernaGraph class', () => {
  describe('The constructor', () => {
    test.todo('should build 7 lerna nodes');
    test.todo('A should have children D');
    test.todo('B should have children D');
    test.todo('C should have children B,E,F,G');
    test.todo('D should have children E');
    test.todo('E should not have children');
    test.todo('F should not have children');
    test.todo('All nodes should be disabled');
    test.todo('should map ports according to the config if given');
    test.todo('should map ports with default port fallback');
  });
  describe('The get root nodes method', () => {
    test.todo('should return A, C');
  });
  describe('The get nodes method', () => {
    test.todo('should return A, B, C, D, E, F');
  });
  describe('The get packages method', () => {
    test.todo('should return D, E, F');
  });
  describe('The get services method', () => {
    test.todo('should return A, B, C');
  });
  describe('The get method', () => {
    test.todo('should return given node');
  });
  describe('The getPort method', () => {
    test.todo('should return port for a given service');
  });
  describe('The bootstrap method', () => {
    test.todo('should spawn lerna bootstrap process');
    test.todo('should resolve on close with code 0');
    test.todo('should reject on close with code != 0');
    test.todo('should reject on error');
  });
  describe('The compile method [given all nodes enabled]', () => {
    test.todo('should compile B, D, E, F, G');
    test.todo('should compile E before D');
    test.todo('should compile D before B');
    test.todo('should compile F before G');
  });
  describe('The compile method [given A, B, D, E enabled]', () => {
    test.todo('should compile D, E');
    test.todo('should compile E before D');
  });
  describe('The enable nodes method', () => {
    test.todo('given A enabled, should enable A, D, E');
    test.todo('given B enabled, should enable B, D, E');
    test.todo('given C enabled, should enable C, B, D, E, F, G');
    test.todo('given A, B enabled, should enable A, B, D, E');
    test.todo('given A, C enabled, should enable A, C, B, D, E, F, G');
    test.todo('given B, C enabled, should enable C, B, D, E, F, G');
    test.todo('given A, B, C enabled, should enable A, B, C, B, D, E, F, G');
  });
});
