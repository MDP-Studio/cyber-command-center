import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeSimulationEvents } from '../src/simulationEvents.js';

test('guest assessment summaries retain first-to-latest outcome evidence', () => {
  const events = [
    {
      id: 'first',
      eventType: 'incident-response',
      outcome: 'reviewed',
      title: 'Incident handoff summary',
      riskDelta: -4,
      occurredAt: '2026-07-01T00:00:00.000Z',
      details: { drillId: 'handoff', score: '2', maxScore: '5' },
    },
    {
      id: 'latest',
      eventType: 'incident-response',
      outcome: 'completed',
      title: 'Incident handoff summary',
      riskDelta: -6,
      occurredAt: '2026-07-08T00:00:00.000Z',
      details: { drillId: 'handoff', score: '5', maxScore: '5' },
    },
  ];
  const summary = summarizeSimulationEvents(events);
  assert.equal(summary.assessments.totalAttempts, 2);
  assert.equal(summary.assessments.improvingDrills, 1);
  assert.equal(summary.assessments.byDrill[0].change, 60);
  assert.deepEqual(summary.assessments.byDrill[0].history.map((attempt) => attempt.percent), [100, 40]);
});
