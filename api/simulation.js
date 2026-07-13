const EVENT_TYPES = new Set([
  'phishing-email',
  'sms-phishing',
  'voice-social-engineering',
  'credential-hygiene',
  'incident-response',
  'awareness-drill',
  'manual-observation',
]);

const OUTCOMES = new Set([
  'completed',
  'reported',
  'reviewed',
  'ignored',
  'clicked',
  'failed',
  'credential_submitted',
]);

const DEFAULT_RISK_DELTA = {
  completed: -6,
  reported: -10,
  reviewed: -4,
  ignored: 8,
  clicked: 18,
  failed: 12,
  credential_submitted: 35,
};

const DETAIL_KEYS = new Set([
  'channel',
  'scenario',
  'lesson',
  'taskId',
  'reference',
  'drillId',
  'attackTechnique',
  'rubric',
  'score',
  'maxScore',
  'evidenceFields',
  'expectedArtifacts',
  'scoringFocus',
  'rubricDimensions',
]);
const BLOCKED_DETAIL_KEYS = /body|password|secret|token|apikey|api_key|cookie|credential/i;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function text(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizedDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const output = {};
  for (const [key, value] of Object.entries(details)) {
    if (BLOCKED_DETAIL_KEYS.test(key)) throw badRequest('Simulation details must not contain raw bodies, secrets, tokens, or credentials.');
    if (!DETAIL_KEYS.has(key)) continue;
    const cleanValue = text(value, 120);
    if (cleanValue) output[key] = cleanValue;
  }
  return output;
}

export function normalizeSimulationEventPayload(payload = {}) {
  const eventType = text(payload.event_type || payload.type, 80);
  if (!EVENT_TYPES.has(eventType)) throw badRequest('Simulation event type is not supported.');

  const outcome = text(payload.outcome, 40);
  if (!OUTCOMES.has(outcome)) throw badRequest('Simulation outcome is not supported.');

  const parsedDelta = Number.parseInt(payload.risk_delta ?? payload.riskDelta ?? DEFAULT_RISK_DELTA[outcome], 10);
  if (!Number.isFinite(parsedDelta)) throw badRequest('Risk delta must be a number.');

  let occurredAt = payload.occurred_at || payload.occurredAt || new Date().toISOString();
  const occurredDate = new Date(occurredAt);
  if (Number.isNaN(occurredDate.getTime())) throw badRequest('Simulation event date is invalid.');
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  if (occurredDate.getTime() > tomorrow) throw badRequest('Simulation event date is too far in the future.');
  occurredAt = occurredDate.toISOString();

  const title = text(payload.title, 120) || `${eventType.replace(/-/g, ' ')} ${outcome.replace(/_/g, ' ')}`;

  return {
    event_type: eventType,
    outcome,
    title,
    risk_delta: clamp(parsedDelta, -25, 50),
    occurred_at: occurredAt,
    details: normalizedDetails(payload.details),
  };
}

export function formatSimulationEvent(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    outcome: row.outcome,
    title: row.title,
    riskDelta: Number(row.risk_delta || 0),
    occurredAt: row.occurred_at,
    details: row.details || {},
    createdAt: row.created_at,
  };
}

function assessmentBand(percent) {
  if (percent >= 85) return 'strong';
  if (percent >= 60) return 'developing';
  return 'needs_review';
}

export function summarizeAssessmentAttempts(events = []) {
  const attempts = events
    .map((event) => {
      const formatted = event.eventType ? event : formatSimulationEvent(event);
      const drillId = text(formatted.details?.drillId, 120);
      const score = Number.parseInt(formatted.details?.score, 10);
      const maxScore = Number.parseInt(formatted.details?.maxScore, 10);
      if (!drillId || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore < 1 || score < 0 || score > maxScore) return null;
      const percent = Math.round((score / maxScore) * 100);
      return {
        id: formatted.id,
        drillId,
        title: formatted.title,
        score,
        maxScore,
        percent,
        evidenceQuality: assessmentBand(percent),
        outcome: formatted.outcome,
        occurredAt: formatted.occurredAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  const grouped = new Map();
  for (const attempt of attempts) {
    const history = grouped.get(attempt.drillId) || [];
    history.push(attempt);
    grouped.set(attempt.drillId, history);
  }

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
    averagePercent: attempts.length
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length)
      : 0,
    improvingDrills: byDrill.filter((drill) => drill.attempts > 1 && drill.change > 0).length,
    latestAttemptAt: byDrill[0]?.latestAt || null,
    byDrill,
  };
}

export function summarizeSimulationEvents(rows = []) {
  const events = rows.map(formatSimulationEvent).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const byDate = new Map();
  const outcomes = {};
  for (const event of events) {
    const day = new Date(event.occurredAt).toISOString().slice(0, 10);
    byDate.set(day, (byDate.get(day) || 0) + event.riskDelta);
    outcomes[event.outcome] = (outcomes[event.outcome] || 0) + 1;
  }

  let score = 0;
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, delta]) => {
      score = clamp(score + delta, 0, 100);
      return { date, score };
    });

  const latestScore = trend.length ? trend[trend.length - 1].score : 0;
  return {
    summary: {
      totalEvents: events.length,
      currentRiskScore: latestScore,
      highRiskEvents: events.filter((event) => event.riskDelta >= 15).length,
      completedOutcomes: (outcomes.completed || 0) + (outcomes.reported || 0),
      lastEventAt: events[0]?.occurredAt || null,
    },
    outcomes,
    trend: trend.slice(-14),
    recentEvents: events.slice(0, 8),
    assessments: summarizeAssessmentAttempts(events),
  };
}
