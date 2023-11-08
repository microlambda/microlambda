import { Server as WebSocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import { Scheduler, SchedulerEvent } from '@microlambda/core';
import { EventsLog } from '@microlambda/logger';
import {
  ICommandMetric,
  IEventLog,
  ILogsReceivedEvent,
  IRunCommandEvent,
  ServiceStatus,
  TranspilingStatus,
  TypeCheckStatus,
} from '@microlambda/types';
import {
  INodeInterruptedEvent,
  INodeInterruptingEvent,
  IRunCommandErrorEvent,
  IRunCommandStartedEvent,
  IRunCommandSuccessEvent,
  isNodeErroredEvent,
  isNodeInterruptedEvent,
  isNodeInterruptingEvent,
  isNodeStartedEvent,
  isNodeSucceededEvent,
  RunCommandEvent,
  RunCommandEventEnum,
} from '@microlambda/runner-core';

type EligibleSchedulerEvents =
  | (IRunCommandStartedEvent & { cmd: 'start' | 'transpile' | 'build' })
  | (IRunCommandSuccessEvent & { cmd: 'start' | 'transpile' | 'build' })
  | (IRunCommandErrorEvent & { cmd: 'start' | 'transpile' | 'build' })
  | (INodeInterruptedEvent & { cmd: 'start' | 'transpile' | 'build' })
  | (INodeInterruptingEvent & { cmd: 'start' | 'transpile' | 'build' });

export class IOSocketManager {
  private _io: WebSocketServer;
  private _scheduler: Scheduler;
  private _selectedWorkspace = new Map<string, Set<string>>();
  private _connections = new Map<string, Socket>();

  constructor(port: number, server: Server, scheduler: Scheduler, logger: EventsLog) {
    this._scheduler = scheduler;
    const log = logger.scope('@microlambda/server/io');
    log.info('Attaching Websocket');
    this._io = new WebSocketServer(server);
    this._io.on('connect_error', (err) => {
      log.error(`connect_error due to ${err.message}`);
    });
    this._io.on('connection', (socket) => {
      this._connections.set(socket.id, socket);
      // console.debug('New connection', socket.id);
      socket.on('disconnect', () => {
        // console.debug('Disconnected', socket.id);
        this._connections.delete(socket.id);
      });
      socket.on('subscribe.to.logs', (workspace: string) => {
        // console.debug('Subscribing to', workspace, socket.id);
        const socketsSubscribedToWorkspace = this._selectedWorkspace.get(workspace);
        if (socketsSubscribedToWorkspace) {
          socketsSubscribedToWorkspace.add(socket.id);
        } else {
          this._selectedWorkspace.set(workspace, new Set([socket.id]));
        }
        // console.debug(this._selectedWorkspace);
      });
    });
    this._scheduler.execution$.subscribe((evt) => {
      const formattedEvent = IOSocketManager.formatEvent(evt);
      if (formattedEvent) {
        this._io.emit('run.command.event', formattedEvent);
      }
    });
  }

  handleEventLog(log: IEventLog): void {
    this._io.emit('event.log.added', log);
  }

  handleTargetLog(target: string, log: string, workspace: string): void {
    const socketsSubscribedToWorkspace = this._selectedWorkspace.get(workspace);
    if (socketsSubscribedToWorkspace?.size) {
      const targetLog: ILogsReceivedEvent = {
        target,
        log,
        workspace,
      };
      for (const socketId of socketsSubscribedToWorkspace) {
        // console.debug('Forwarding to', socketId);
        const socket = this._connections.get(socketId);
        if (socket) {
          socket.emit('target.log.added', targetLog);
        } else {
          socketsSubscribedToWorkspace.delete(socketId);
        }
      }
    }
  }

  static getTranspileStatus(evt: EligibleSchedulerEvents): TranspilingStatus {
    switch (evt.type) {
      case RunCommandEventEnum.NODE_STARTED:
        return TranspilingStatus.TRANSPILING;
      case RunCommandEventEnum.NODE_ERRORED:
        return TranspilingStatus.ERROR_TRANSPILING;
      case RunCommandEventEnum.NODE_PROCESSED:
        return TranspilingStatus.TRANSPILED;
      case RunCommandEventEnum.NODE_INTERRUPTED:
      case RunCommandEventEnum.NODE_INTERRUPTING:
        return TranspilingStatus.NOT_TRANSPILED;
    }
  }

  static getTypeCheckStatus(evt: EligibleSchedulerEvents): TypeCheckStatus {
    switch (evt.type) {
      case RunCommandEventEnum.NODE_STARTED:
        return TypeCheckStatus.CHECKING;
      case RunCommandEventEnum.NODE_ERRORED:
        return TypeCheckStatus.ERROR;
      case RunCommandEventEnum.NODE_PROCESSED:
        return TypeCheckStatus.SUCCESS;
      case RunCommandEventEnum.NODE_INTERRUPTED:
      case RunCommandEventEnum.NODE_INTERRUPTING:
        return TypeCheckStatus.NOT_CHECKED;
    }
  }

  static getServiceStatus(evt: EligibleSchedulerEvents): ServiceStatus {
    switch (evt.type) {
      case RunCommandEventEnum.NODE_STARTED:
        return ServiceStatus.STARTING;
      case RunCommandEventEnum.NODE_ERRORED:
        return ServiceStatus.CRASHED;
      case RunCommandEventEnum.NODE_PROCESSED:
        return ServiceStatus.RUNNING;
      case RunCommandEventEnum.NODE_INTERRUPTING:
        return ServiceStatus.STOPPING;
      case RunCommandEventEnum.NODE_INTERRUPTED:
        return ServiceStatus.STOPPED;
    }
  }

  static formatMetrics(evt: RunCommandEvent): ICommandMetric | undefined {
    let metrics: ICommandMetric | undefined;
    if (isNodeSucceededEvent(evt)) {
      metrics = {
        finishedAt: new Date().toISOString(),
        fromCache: evt.result.fromCache,
        took: evt.result.overall,
      };
    }
    return metrics;
  }

  static formatEvent(evt: SchedulerEvent): IRunCommandEvent | undefined {
    if (
      isNodeErroredEvent(evt) ||
      isNodeSucceededEvent(evt) ||
      isNodeInterruptingEvent(evt) ||
      isNodeInterruptedEvent(evt) ||
      isNodeStartedEvent(evt)
    ) {
      switch (evt.cmd) {
        case 'transpile':
          return {
            type: evt.cmd,
            workspace: evt.target.workspace.name,
            status: this.getTranspileStatus(evt),
            metrics: this.formatMetrics(evt),
          };
        case 'build':
          return {
            type: evt.cmd,
            workspace: evt.target.workspace.name,
            status: this.getTypeCheckStatus(evt),
            metrics: this.formatMetrics(evt),
          };
        case 'start':
          return {
            type: evt.cmd,
            workspace: evt.target.workspace.name,
            status: this.getServiceStatus(evt),
            metrics: this.formatMetrics(evt),
          };
      }
    }
    return;
  }
}
