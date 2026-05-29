export const SIMULATION_EVENT_TYPES = [
  { value: 'phishing-email', label: 'Phishing email drill' },
  { value: 'sms-phishing', label: 'SMS phishing drill' },
  { value: 'voice-social-engineering', label: 'Voice social engineering' },
  { value: 'credential-hygiene', label: 'Credential hygiene review' },
  { value: 'incident-response', label: 'Incident response tabletop' },
  { value: 'awareness-drill', label: 'Awareness drill' },
  { value: 'manual-observation', label: 'Manual observation' },
];

export const SIMULATION_OUTCOMES = [
  { value: 'completed', label: 'Completed', riskDelta: -6 },
  { value: 'reported', label: 'Reported', riskDelta: -10 },
  { value: 'reviewed', label: 'Reviewed', riskDelta: -4 },
  { value: 'ignored', label: 'Ignored', riskDelta: 8 },
  { value: 'clicked', label: 'Clicked', riskDelta: 18 },
  { value: 'failed', label: 'Failed drill', riskDelta: 12 },
  { value: 'credential_submitted', label: 'Credential submitted', riskDelta: 35 },
];

export function riskDeltaForOutcome(outcome) {
  return SIMULATION_OUTCOMES.find((item) => item.value === outcome)?.riskDelta ?? 0;
}

export function formatOutcome(outcome) {
  return SIMULATION_OUTCOMES.find((item) => item.value === outcome)?.label || outcome.replace(/_/g, ' ');
}

export function summarizeSimulationEvents(events = []) {
  const normalized = events
    .map((event) => ({ ...event, riskDelta: Number(event.riskDelta ?? event.risk_delta ?? 0) }))
    .sort((a, b) => new Date(b.occurredAt || b.occurred_at) - new Date(a.occurredAt || a.occurred_at));
  const byDate = new Map();
  const outcomes = {};
  normalized.forEach((event) => {
    const occurredAt = event.occurredAt || event.occurred_at || new Date().toISOString();
    const day = new Date(occurredAt).toISOString().slice(0, 10);
    byDate.set(day, (byDate.get(day) || 0) + event.riskDelta);
    outcomes[event.outcome] = (outcomes[event.outcome] || 0) + 1;
  });
  let score = 0;
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => {
      score = Math.min(100, Math.max(0, score + delta));
      return { date, score };
    });
  return {
    summary: {
      totalEvents: normalized.length,
      currentRiskScore: trend.length ? trend[trend.length - 1].score : 0,
      highRiskEvents: normalized.filter((event) => event.riskDelta >= 15).length,
      completedOutcomes: (outcomes.completed || 0) + (outcomes.reported || 0),
      lastEventAt: normalized[0]?.occurredAt || normalized[0]?.occurred_at || null,
    },
    outcomes,
    trend: trend.slice(-14),
    recentEvents: normalized.slice(0, 8),
  };
}

export function buildGuestSimulationEvent(input) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `guest-${Date.now()}`,
    eventType: input.eventType,
    outcome: input.outcome,
    title: String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Simulation event',
    riskDelta: riskDeltaForOutcome(input.outcome),
    occurredAt: now,
    details: input.details || {},
    createdAt: now,
  };
}
