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

function assessmentBand(percent) {
  if (percent >= 85) return 'strong';
  if (percent >= 60) return 'developing';
  return 'needs_review';
}

export function summarizeAssessmentAttempts(events = []) {
  const attempts = events
    .map((event) => {
      const details = event.details || {};
      const drillId = String(details.drillId || '').trim().slice(0, 120);
      const score = Number.parseInt(details.score, 10);
      const maxScore = Number.parseInt(details.maxScore, 10);
      if (!drillId || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore < 1 || score < 0 || score > maxScore) return null;
      const percent = Math.round((score / maxScore) * 100);
      return {
        id: event.id,
        drillId,
        title: event.title,
        score,
        maxScore,
        percent,
        evidenceQuality: assessmentBand(percent),
        outcome: event.outcome,
        occurredAt: event.occurredAt || event.occurred_at,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  const grouped = new Map();
  attempts.forEach((attempt) => grouped.set(attempt.drillId, [...(grouped.get(attempt.drillId) || []), attempt]));
  const byDrill = [...grouped.entries()].map(([drillId, history]) => {
    const first = history[0];
    const latest = history[history.length - 1];
    return {
      drillId,
      title: latest.title,
      attempts: history.length,
      firstPercent: first.percent,
      latestPercent: latest.percent,
      change: latest.percent - first.percent,
      bestPercent: Math.max(...history.map((attempt) => attempt.percent)),
      latestScore: latest.score,
      maxScore: latest.maxScore,
      evidenceQuality: latest.evidenceQuality,
      latestOutcome: latest.outcome,
      latestAt: latest.occurredAt,
      history: history.slice(-5).reverse(),
    };
  }).sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt));
  return {
    totalAttempts: attempts.length,
    assessedDrills: byDrill.length,
    averagePercent: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length) : 0,
    improvingDrills: byDrill.filter((drill) => drill.attempts > 1 && drill.change > 0).length,
    latestAttemptAt: byDrill[0]?.latestAt || null,
    byDrill,
  };
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
    assessments: summarizeAssessmentAttempts(normalized),
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
