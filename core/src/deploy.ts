import {RunCommandEvent, Runner} from "@centipod/core";
import {Project} from "./graph/project";
import { Workspace } from "./graph/workspace";
import {ConfigReader} from "./config/read-config";
import {from, mergeAll, Observable} from "rxjs";

export type DeployEvent = RunCommandEvent<{ region: string }>;

export interface IDeployOptions {
  project: Project;
  concurrency?: number;
  target?: Workspace;
  affected: { rev1: string, rev2: string };
  force: boolean;
  environment: string;
}

class Deployer {
  private _reader = new ConfigReader();

  constructor(readonly options: IDeployOptions) {}

  private _run(region: string, services: Workspace): Observable<DeployEvent> {
    const runner = new Runner(this.options.project, this.concurrency);
    return runner.runCommand<{ region: string }>('deploy', {
      to: services,
      parallel: true,
      affected: this.options.affected,
      force: this.options.force,
    }, {
      region,
    })
  }

  private _deployOne(target: Workspace): Observable<DeployEvent> {
    const regions = this._reader.getRegions(target.name, this.options.environment);
    return from(regions.map((region) => this._run(region, target))).pipe(mergeAll(1));
  }

  private _deployAll(): Observable<DeployEvent> {
    const steps = this._reader.scheduleDeployments(this.options.environment);
    for (const step of steps) {
      for (const [region, services] of step.entries()) {
        from(Array.from(services).map((service) => this._run(region, this.options.project.services.get(service)))).pipe(mergeAll(this.concurrency))
      }
    }

  }

  deploy() {
    if (this.options.target) {
      this._deployOne(this.options.target);
    } else {
      this._deployAll()
    }
  }
}
