import { describe, it, expect, vi } from 'vitest';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import type { SignalRMessage } from '../../src/signalr/client.js';

describe('SignalRPipeline', () => {
  it('processes a message and updates state', () => {
    const pipeline = new SignalRPipeline();
    const msg: SignalRMessage = {
      topic: 'LapCount',
      data: { CurrentLap: 5, TotalLaps: 52 },
      timestamp: '2025-01-01T00:00:00Z',
    };

    const result = pipeline.processMessage(msg);
    expect(result.state.lapCount).toEqual({ current: 5, total: 52 });
    expect(result.events).toHaveLength(0);
  });

  it('emits events on flag change', () => {
    const pipeline = new SignalRPipeline();
    const eventSpy = vi.fn();
    pipeline.on('event', eventSpy);

    pipeline.processMessage({
      topic: 'TrackStatus',
      data: { Status: '5' },
      timestamp: '2025-01-01T00:00:00Z',
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'flag_change',
        newFlag: 'red',
      }),
    );
  });

  it('emits update for every message', () => {
    const pipeline = new SignalRPipeline();
    const updateSpy = vi.fn();
    pipeline.on('update', updateSpy);

    pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 1 },
      timestamp: '2025-01-01T00:00:00Z',
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          lapCount: expect.objectContaining({ current: 1 }),
        }),
      }),
    );
  });

  it('detects overtake through full pipeline', () => {
    const pipeline = new SignalRPipeline();
    const eventSpy = vi.fn();
    pipeline.on('event', eventSpy);

    // Set up drivers
    pipeline.processMessage({
      topic: 'DriverList',
      data: {
        '1': { RacingNumber: '1', Tla: 'VER', TeamName: 'Red Bull Racing' },
        '44': { RacingNumber: '44', Tla: 'HAM', TeamName: 'Ferrari' },
      },
      timestamp: '2025-01-01T00:00:00Z',
    });

    // Initial positions
    pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '1': { Position: '1', InPit: false },
          '44': { Position: '2', InPit: false },
        },
      },
      timestamp: '2025-01-01T00:00:01Z',
    });

    // Overtake: HAM passes VER
    pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '1': { Position: '2' },
          '44': { Position: '1' },
        },
      },
      timestamp: '2025-01-01T00:00:02Z',
    });

    const overtakeEvents = eventSpy.mock.calls.filter(
      ([e]) => e.type === 'overtake',
    );
    expect(overtakeEvents).toHaveLength(1);
    expect(overtakeEvents[0]![0].overtakingAbbreviation).toBe('HAM');
    expect(overtakeEvents[0]![0].overtakenAbbreviation).toBe('VER');
  });

  it('reset clears state', () => {
    const pipeline = new SignalRPipeline();
    pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 42, TotalLaps: 57 },
      timestamp: '2025-01-01T00:00:00Z',
    });

    pipeline.reset();
    expect(pipeline.getState().lapCount.current).toBe(0);
  });
});
