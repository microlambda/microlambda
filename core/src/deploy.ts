import {RunCommandEvent, Runner, Workspace} from "@microlambda/runner-core";
import {Project} from "./graph/project";
import {ConfigReader} from "./config/read-config";
import {from, mergeAll, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {getDefaultThreads} from "./platform";
import { EventsLog } from '@microlambda/logger';

export type DeployEvent = RunCommandEvent & { region: string };
// test
export interface IDeployOptions {
  project: Project;
  concurrency?: number;
  targets?: Workspace[];
  affected?: { rev1: string, rev2: string };
  force: boolean;
  environment: string;
}

export class Deployer {
  private readonly _reader: ConfigReader;

  constructor(
    readonly options: IDeployOptions,
    readonly mode: 'deploy' | 'remove' = 'deploy',
    readonly logger?: EventsLog,
  ) {
    this._reader = new ConfigReader(logger);
    this._reader.validate(options.project);
  }

  get concurrency(): number {
    return this.options.concurrency || getDefaultThreads();
  }

  private _run(region: string, services: Workspace[]): Observable<DeployEvent> {
    const runner = new Runner(this.options.project, this.concurrency, {
      dir: `deploy-${region}`,
    });
    return runner.runCommand(this.mode, {
      workspaces: services,
      mode: 'parallel',
      affected: this.options.affected,
      force: this.options.force,
    }, [], {
      AWS_REGION: region,
    }).pipe(map((evt) => ({...evt, region})));
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

  deploy(service?: Workspace): Observable<DeployEvent> {
    if (service) {
      return this._deployOne(service);
    } else {
      return this._deployAll()
    }
  }
}
