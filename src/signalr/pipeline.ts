/**
 * Pipeline: wires SignalR client → state accumulator → event detectors.
 * Emits F1Events for downstream consumers (MQTT, WebSocket, etc.).
 */

import { EventEmitter } from 'node:events';
import { StateAccumulator } from '../data/state-accumulator.js';
import { detectEvents } from '../events/detector.js';
import { createChildLogger } from '../util/logger.js';
import type { SignalRMessage } from './client.js';
import type { F1Event } from '../events/types.js';
import type { SessionState } from '../data/types.js';

const log = createChildLogger('pipeline');

export interface PipelineMessage {
  state: SessionState;
  events: F1Event[];
  rawMessage: SignalRMessage;
}

export class SignalRPipeline extends EventEmitter {
  private accumulator: StateAccumulator;

  constructor() {
    super();
    this.accumulator = new StateAccumulator();
  }

  getState(): SessionState {
    return this.accumulator.getState();
  }

  reset(): void {
    this.accumulator.reset();
  }

  /** Process a raw SignalR message through the pipeline */
  processMessage(msg: SignalRMessage): PipelineMessage {
    const prevState = this.accumulator.snapshot();
    this.accumulator.applyMessage(msg.topic, msg.data, msg.timestamp);
    const currState = this.accumulator.getState();

    const events = detectEvents(prevState, currState);

    if (events.length > 0) {
      log.info({ eventCount: events.length, topic: msg.topic }, 'Events detected');
      for (const event of events) {
        this.emit('event', event);
      }
    }

    const pipelineMsg: PipelineMessage = {
      state: currState,
      events,
      rawMessage: msg,
    };
    this.emit('update', pipelineMsg);
    return pipelineMsg;
  }

  /** Load initial state (e.g., from a recording's subscribe.json) */
  loadInitialState(state: SessionState): void {
    this.accumulator = new StateAccumulator(state);
  }
}
