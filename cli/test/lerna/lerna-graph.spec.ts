/**
 Lerna graph is one of the most important class of the project.
 The dependency graph is built at the beginning of the start command.
 It is very important to know the dependencies between package to:
 - compile packages in the correct order: if package B depends on A and you try to compile package B before A, it
   will fail.
 - stop all impacted services when watcher is triggered because a shared dependency is modified.

 The LernaGraph constructor is responsible for building this graph from lerna commands outputs.
 Let's take this dependency graph for testing purpose.


                                        root C
                                      /   |    \
                                    /     |     \
                  root A       root B    /\     \
                  \        /            / \      \
                  \       /            /  \      package G
                  package D           /   \      /
                  /                  /    \     /
                /                   /     \    /
            package E------------- /       package F
 */
