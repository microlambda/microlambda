import {RunCommandEvent, Runner} from "@centipod/core";
import {Project} from "./graph/project";
import { Workspace } from "./graph/workspace";
import {ConfigReader} from "./config/read-config";
import {from, mergeAll, Observable} from "rxjs";
import {getDefaultThreads} from "./platform";

export type DeployEvent = RunCommandEvent<{ region: string }>;
// test
export interface IDeployOptions {
  project: Project;
  concurrency?: number;
  target?: Workspace;
  affected?: { rev1: string, rev2: string };
  force: boolean;
  environment: string;
}

export class Deployer {
  private _reader = new ConfigReader();

  constructor(readonly options: IDeployOptions, readonly mode: 'deploy' | 'remove' = 'deploy') {}

  get concurrency(): number {
    return this.options.concurrency || getDefaultThreads();
  }

  private _run(region: string, services: Workspace[]): Observable<DeployEvent> {
    const runner = new Runner(this.options.project, this.concurrency);
    return runner.runCommand<{ region: string }>(this.mode, {
      workspaces: services,
      mode: 'parallel',
      affected: this.options.affected,
      force: this.options.force,
    }, {
      region,
    })
  }

  private _deployOne(target: Workspace): Observable<DeployEvent> {
    const regions = this._reader.getRegions(target.name, this.options.environment);
    return from(regions.map((region) => this._run(region, [target]))).pipe(mergeAll(1));
  }

  private _deployAll(): Observable<DeployEvent> {
    const rawSteps = this._reader.scheduleDeployments(this.options.environment);
    const steps = this.mode === 'deploy' ? rawSteps : rawSteps.reverse();
    const runs: Array<Observable<DeployEvent>> = []
    for (const step of steps) {
      const regionalRuns: Array<Observable<DeployEvent>> = []
      for (const [region, servicesNames] of step.entries()) {
        const services = Array.from(servicesNames).map((name) => this.options.project.services.get(name)!);
        regionalRuns.push(this._run(region, services));
      }
      runs.push(from(regionalRuns).pipe(mergeAll(1)));
    }
    return from(runs).pipe(mergeAll(1));
  }

  deploy(): Observable<DeployEvent> {
    if (this.options.target) {
      return this._deployOne(this.options.target);
    } else {
      return this._deployAll()
    }
  }
}
