import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccountSecurity, useAuth, useProgress, useNotes, useSessions, useSimulationEvents } from './hooks';
import { apiConfigured } from './apiClient';
import { ASSESSMENT_DRILLS, PHASES, PLATFORMS } from './data';
import { SIMULATION_EVENT_TYPES, SIMULATION_OUTCOMES, formatOutcome } from './simulationEvents';
import Auth from './Auth';
import AccountSecurityPanel from './AccountSecurityPanel';
import PrivacyPanel from './PrivacyPanel';

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const sans = "'Space Grotesk', sans-serif";
const cardBg = "rgba(255,255,255,0.03)";
const cardBorder = "rgba(255,255,255,0.1)";
const dim = "rgba(255,255,255,0.55)";
const dimmer = "rgba(255,255,255,0.35)";
const accent = "#00ffc8";
const mdpProjectUrl = "https://mdpstudio.com.au/projects/cybersecurity-study-roadmap/";

function fmt(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }

/* Progress Ring */
function ProgressRing({ percent, color, size = 54, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a2e" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.22} fontFamily={mono} fontWeight="700"
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

/* Study Timer */
function StudyTimer({ onSessionEnd }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("");
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsed(baseRef.current + Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(intervalRef.current);
    }
    clearInterval(intervalRef.current);
  }, [running]);

  const handleStart = () => { baseRef.current = elapsed; startRef.current = Date.now(); setRunning(true); };
  const handlePause = () => { baseRef.current = elapsed; setRunning(false); };
  const handleStop = () => {
    setRunning(false);
    if (elapsed > 0) onSessionEnd({ duration: elapsed, label: label || "Untitled session", date: todayKey() });
    setElapsed(0); baseRef.current = 0; setLabel("");
  };

  return (
    <div style={{
      background: cardBg, border: `1px solid ${running ? accent + "50" : cardBorder}`,
      borderRadius: 12, padding: 20, marginBottom: 16, transition: "border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: "0.15em" }}>STUDY TIMER</div>
        {running && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff2d6b", animation: "pulse-glow 1.5s ease-in-out infinite" }} />}
      </div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 48, fontFamily: mono, fontWeight: 800, color: running ? "#fff" : dim, letterSpacing: "0.05em", transition: "color 0.3s" }}>
          {fmt(elapsed)}
        </div>
      </div>
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
        placeholder="What are you studying?"
        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${dimmer}`, borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: sans, outline: "none", marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {!running ? (
          <button onClick={handleStart} style={{
            flex: 1, padding: "10px 0", background: accent + "15", border: `1px solid ${accent}40`,
            borderRadius: 6, color: accent, fontSize: 12, fontFamily: mono, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em",
          }}>{elapsed > 0 ? "\u25B6 RESUME" : "\u25B6 START"}</button>
        ) : (
          <button onClick={handlePause} style={{
            flex: 1, padding: "10px 0", background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.3)",
            borderRadius: 6, color: "#ffa500", fontSize: 12, fontFamily: mono, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em",
          }}>PAUSE</button>
        )}
        <button onClick={handleStop} disabled={elapsed === 0} style={{
          flex: 1, padding: "10px 0",
          background: elapsed > 0 ? "rgba(255,45,107,0.1)" : "transparent",
          border: `1px solid ${elapsed > 0 ? "rgba(255,45,107,0.3)" : dimmer}`,
          borderRadius: 6, color: elapsed > 0 ? "#ff2d6b" : dimmer,
          fontSize: 12, fontFamily: mono, fontWeight: 700, cursor: elapsed > 0 ? "pointer" : "default", letterSpacing: "0.1em",
        }}>STOP & LOG</button>
      </div>
    </div>
  );
}

/* Daily Log */
function DailyLog({ logs, isOpen, onToggle }) {
  const sortedDates = Object.keys(logs).sort().reverse();
  const totalSeconds = Object.values(logs).reduce((sum, day) => sum + day.reduce((s, e) => s + e.duration, 0), 0);
  const totalHrs = (totalSeconds / 3600).toFixed(1);
  const streakDays = (() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (logs[d.toISOString().slice(0, 10)]?.length > 0) streak++; else break;
    }
    return streak;
  })();

  return (
    <div style={{
      background: cardBg, border: `1px solid ${isOpen ? "#ff6b35" + "40" : cardBorder}`,
      borderRadius: 12, overflow: "hidden", marginBottom: 16, transition: "border-color 0.3s",
    }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", cursor: "pointer", userSelect: "none",
      }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: mono, color: "#ff6b35", letterSpacing: "0.15em", marginBottom: 4 }}>TRAINING LOG</div>
          <div style={{ fontSize: 14, fontFamily: sans, color: dim }}>
            {sortedDates.length} days * {totalHrs}h total * {streakDays} day streak
          </div>
        </div>
        <span style={{ color: dim, fontSize: 18, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>{"\u25BE"}</span>
      </div>
      {isOpen && (
        <div style={{ padding: "0 24px 24px", maxHeight: 400, overflowY: "auto" }}>
          {sortedDates.length === 0 ? (
            <div style={{ color: dimmer, fontSize: 13, fontFamily: sans, padding: "12px 0" }}>No sessions yet. Start the timer to begin.</div>
          ) : sortedDates.map((date) => {
            const dayTotal = logs[date].reduce((s, e) => s + e.duration, 0);
            return (
              <div key={date} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${cardBorder}` }}>
                  <span style={{ fontSize: 12, fontFamily: mono, color: "#ff6b35" }}>{date}</span>
                  <span style={{ fontSize: 11, fontFamily: mono, color: dim }}>{fmt(dayTotal)}</span>
                </div>
                {logs[date].map((entry, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, fontFamily: sans }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{entry.label}</span>
                    <span style={{ color: dim, fontFamily: mono, fontSize: 11 }}>{fmt(entry.duration)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Task Item */
function TaskItem({ task, done, onToggle, note, onNoteChange }) {
  const [showNote, setShowNote] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", cursor: "pointer", userSelect: "none" }}>
        <div style={{
          width: 20, height: 20, minWidth: 20, borderRadius: 4,
          border: done ? `2px solid ${accent}` : `2px solid ${dimmer}`,
          background: done ? "rgba(0,255,200,0.15)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, transition: "all 0.2s",
        }}>
          {done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{
            color: done ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
            textDecoration: done ? "line-through" : "none", fontSize: 15, lineHeight: 1.5, fontFamily: sans, transition: "color 0.2s",
          }}>{task.label}</span>
          {task.link && (
            <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              style={{ display: "inline-block", marginLeft: 8, color: accent, fontSize: 12, textDecoration: "none", opacity: 0.8, fontFamily: mono }}>
              {"\u2197"} LINK
            </a>
          )}
          {task.hours > 0 && <span style={{ display: "inline-block", marginLeft: 8, color: dimmer, fontSize: 12, fontFamily: mono }}>~{task.hours}h</span>}
          <button onClick={(e) => { e.stopPropagation(); setShowNote(!showNote); }}
            style={{ display: "inline-block", marginLeft: 8, background: "none", border: "none", color: note ? "#a855f7" : dimmer, fontSize: 12, fontFamily: mono, cursor: "pointer", padding: 0 }}>
            {note ? "\u270E notes" : "+ note"}
          </button>
        </div>
      </div>
      {showNote && (
        <div style={{ paddingLeft: 32, paddingBottom: 10 }}>
          <textarea value={note || ""} onChange={(e) => onNoteChange(task.id, e.target.value)}
            onClick={(e) => e.stopPropagation()} placeholder="Notes, commands, flags, findings..."
            rows={3} style={{
              width: "100%", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 8, padding: "10px 12px", color: "rgba(255,255,255,0.85)", fontSize: 13,
              fontFamily: mono, lineHeight: 1.6, outline: "none", resize: "vertical",
            }} />
        </div>
      )}
    </div>
  );
}

/* Phase Card */
function PhaseCard({ phase, progress, notes, onToggleTask, onNoteChange, isOpen, onToggleOpen }) {
  const allTasks = phase.modules.flatMap((m) => m.tasks);
  const doneCount = allTasks.filter((t) => progress[t.id]).length;
  const percent = allTasks.length > 0 ? (doneCount / allTasks.length) * 100 : 0;
  return (
    <div style={{
      background: cardBg, border: `1px solid ${isOpen ? phase.color + "40" : cardBorder}`,
      borderRadius: 12, overflow: "hidden", transition: "border-color 0.3s", marginBottom: 16,
    }}>
      <div onClick={onToggleOpen} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", cursor: "pointer", userSelect: "none",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: phase.color, fontFamily: mono, fontWeight: 800, letterSpacing: "0.04em" }}>{phase.title}</span>
          </div>
          <div style={{ color: dim, fontSize: 14, fontFamily: sans }}>{phase.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ color: dim, fontSize: 13, fontFamily: mono, textAlign: "right" }}>
            {doneCount}/{allTasks.length}
            {phase.hours > 0 && <span style={{ display: "block", fontSize: 11, opacity: 0.7 }}>~{phase.hours}h</span>}
          </div>
          <ProgressRing percent={percent} color={phase.color} />
          <span style={{ color: dim, fontSize: 18, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>{"\u25BE"}</span>
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: "0 24px 24px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: sans, lineHeight: 1.6, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${cardBorder}` }}>
            {phase.description}
          </p>
          {phase.modules.map((mod) => (
            <div key={mod.name} style={{ marginBottom: 20 }}>
              <div style={{ color: phase.color, fontSize: 12, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, opacity: 0.8 }}>{mod.name}</div>
              {mod.tasks.map((task) => (
                <TaskItem key={task.id} task={task} done={!!progress[task.id]} onToggle={() => onToggleTask(task.id)}
                  note={notes[task.id] || ""} onNoteChange={onNoteChange} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Nav Tab */
function NavTab({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      padding: "10px 0", background: "transparent", border: "none",
      color: active ? accent : dimmer, cursor: "pointer", transition: "color 0.2s",
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 11, fontFamily: mono, letterSpacing: "0.1em" }}>{label}</span>
    </button>
  );
}

/* Main Dashboard */
function ProjectAboutPanel() {
  const items = [
    {
      label: "Training plan",
      text: "49 tasks across 6 phases, covering foundations, SOC operations, ethical hacking, forensics, governance, and certification prep.",
    },
    {
      label: "Progress system",
      text: "Guest mode stores progress in the browser. Signed-in accounts sync progress, notes, and study sessions through the self-hosted API.",
    },
    {
      label: "Security boundary",
      text: "The API enforces per-user access, while guest mode avoids account setup entirely.",
    },
    {
      label: "Who it is for",
      text: "Cyber Command Center is for cybersecurity students and junior analysts who need a repeatable study roadmap, not a certified training provider or enterprise learning platform.",
    },
  ];

  return (
    <section aria-labelledby="about-project-title" style={{
      margin: "18px 16px 0",
      padding: 20,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: 0, marginBottom: 10 }}>ABOUT THIS PROJECT</div>
          <h2 id="about-project-title" style={{ margin: 0, color: "#fff", fontSize: 22, fontFamily: sans, fontWeight: 700, lineHeight: 1.25 }}>
            A cybersecurity training command center for self-directed study.
          </h2>
          <p style={{ margin: "10px 0 0", color: dim, fontSize: 14, lineHeight: 1.6 }}>
            Cyber Command Center helps organize hands-on security learning with task tracking, a study timer, training logs, notes, guest access, and optional account sync.
          </p>
          <p style={{ margin: "10px 0 0", color: dimmer, fontSize: 13, lineHeight: 1.6 }}>
            Built by Meidie Fei as part of a cybersecurity portfolio focused on practical training workflows and safe account boundaries.
          </p>
          <a href={mdpProjectUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex",
            marginTop: 14,
            color: accent,
            fontSize: 12,
            fontFamily: mono,
            fontWeight: 800,
            letterSpacing: 0,
            textDecoration: "none",
          }}>
            View the MDP Studio project page
          </a>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <article key={item.label} style={{ borderLeft: `2px solid ${accent}55`, paddingLeft: 12 }}>
              <h3 style={{ margin: 0, color: accent, fontSize: 12, fontFamily: mono, letterSpacing: 0 }}>{item.label}</h3>
              <p style={{ margin: "5px 0 0", color: dim, fontSize: 13, lineHeight: 1.55 }}>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StudyResourcesPanel() {
  const resources = [
    {
      title: "Cybersecurity study roadmap",
      text: "A six-phase learning path for foundations, SOC work, offensive basics, forensics, governance, and certification prep.",
      href: "/roadmap",
    },
    {
      title: "SOC analyst checklist",
      text: "A practical checklist for alerts, evidence capture, triage notes, escalation, and daily study habits.",
      href: "/soc-checklist",
    },
  ];

  return (
    <section aria-labelledby="public-resources-title" style={{
      margin: "18px 16px 0",
      padding: 20,
      background: "rgba(0,255,200,0.035)",
      border: `1px solid ${accent}25`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: 0, marginBottom: 10 }}>PUBLIC STUDY RESOURCES</div>
          <h2 id="public-resources-title" style={{ margin: 0, color: "#fff", fontSize: 20, fontFamily: sans, fontWeight: 700 }}>
            Searchable guides for students and junior security analysts.
          </h2>
          <p style={{ margin: "9px 0 0", color: dim, fontSize: 14, lineHeight: 1.6 }}>
            These pages explain the learning path behind the tracker, so visitors can use the project even before creating progress data.
          </p>
        </div>
        <div style={{ display: "grid", gap: 10, flex: "1 1 360px" }}>
          {resources.map((resource) => (
            <a key={resource.href} href={resource.href} style={{
              display: "block",
              padding: 14,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${cardBorder}`,
              borderRadius: 8,
              textDecoration: "none",
            }}>
              <strong style={{ display: "block", color: accent, fontSize: 13, fontFamily: mono, marginBottom: 5 }}>{resource.title}</strong>
              <span style={{ display: "block", color: dim, fontSize: 13, lineHeight: 1.5 }}>{resource.text}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimulationRiskPanel({ simulation }) {
  const [eventType, setEventType] = useState('phishing-email');
  const [outcome, setOutcome] = useState('reported');
  const [title, setTitle] = useState('');
  const data = simulation.summary || {};
  const summary = data.summary || {};
  const recent = data.recentEvents || [];
  const trend = data.trend || [];
  const outcomes = data.outcomes || {};
  const riskScore = summary.currentRiskScore || 0;
  const riskColor = riskScore >= 60 ? '#ff2d6b' : riskScore >= 25 ? '#ffa500' : accent;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await simulation.addEvent({
      eventType,
      type: eventType,
      outcome,
      title: title || SIMULATION_EVENT_TYPES.find((item) => item.value === eventType)?.label,
      details: { channel: eventType.includes('sms') ? 'sms' : eventType.includes('voice') ? 'voice' : 'lab' },
    });
    setTitle('');
  };

  return (
    <section aria-labelledby="simulation-risk-title" style={{
      marginTop: 24,
      padding: 20,
      background: 'rgba(56,189,248,0.035)',
      border: '1px solid rgba(56,189,248,0.2)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: '#38bdf8', letterSpacing: '0.15em', marginBottom: 10 }}>
            SIMULATION RISK
          </div>
          <h2 id="simulation-risk-title" style={{ margin: 0, color: '#fff', fontSize: 20, fontFamily: sans, fontWeight: 700 }}>
            Track drill outcomes without sending campaigns.
          </h2>
          <p style={{ margin: '8px 0 0', color: dim, fontSize: 13, lineHeight: 1.6 }}>
            Log tabletop or lab simulation outcomes, watch the risk trend, and keep this as visibility only. No outbound phishing sender, learner automation, or enterprise admin console is included.
          </p>
        </div>
        <div style={{
          minWidth: 160,
          padding: 14,
          background: 'rgba(255,255,255,0.035)',
          border: `1px solid ${riskColor}45`,
          borderRadius: 10,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, fontFamily: mono, color: dimmer, letterSpacing: '0.12em' }}>CURRENT RISK</div>
          <div style={{ marginTop: 4, fontSize: 34, fontFamily: mono, fontWeight: 800, color: riskColor }}>{riskScore}</div>
          <div style={{ fontSize: 11, fontFamily: mono, color: dimmer }}>{summary.totalEvents || 0} events</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 16 }}>
        <select value={eventType} onChange={(event) => setEventType(event.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${cardBorder}`, color: '#fff', borderRadius: 8, padding: '10px 12px', fontFamily: mono, fontSize: 12 }}>
          {SIMULATION_EVENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={outcome} onChange={(event) => setOutcome(event.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${cardBorder}`, color: '#fff', borderRadius: 8, padding: '10px 12px', fontFamily: mono, fontSize: 12 }}>
          {SIMULATION_OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional drill label" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${cardBorder}`, color: '#fff', borderRadius: 8, padding: '10px 12px', fontFamily: sans, fontSize: 13 }} />
        <button disabled={simulation.busy} style={{ padding: '10px 14px', background: '#38bdf815', border: '1px solid rgba(56,189,248,0.45)', borderRadius: 8, color: '#38bdf8', fontSize: 12, fontFamily: mono, fontWeight: 800, cursor: simulation.busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          {simulation.busy ? 'LOGGING...' : 'LOG EVENT'}
        </button>
      </form>
      {simulation.error && <div role="alert" style={{ marginTop: 10, color: '#ff2d6b', fontSize: 12, fontFamily: mono }}>{simulation.error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
          <div style={{ color: dimmer, fontSize: 11, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 8 }}>OUTCOMES</div>
          {Object.keys(outcomes).length === 0 ? (
            <div style={{ color: dimmer, fontSize: 13 }}>No simulation outcomes yet.</div>
          ) : Object.entries(outcomes).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', color: dim, fontSize: 12, fontFamily: mono, marginTop: 5 }}>
              <span>{formatOutcome(key)}</span><strong style={{ color: '#fff' }}>{value}</strong>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
          <div style={{ color: dimmer, fontSize: 11, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 8 }}>TREND</div>
          {trend.length === 0 ? (
            <div style={{ color: dimmer, fontSize: 13 }}>Trend appears after the first event.</div>
          ) : trend.slice(-5).map((point) => (
            <div key={point.date} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 74, color: dimmer, fontSize: 11, fontFamily: mono }}>{point.date}</span>
              <div style={{ flex: 1, height: 6, background: cardBorder, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${point.score}%`, height: '100%', background: riskColor }} />
              </div>
              <span style={{ width: 28, color: dim, fontSize: 11, fontFamily: mono, textAlign: 'right' }}>{point.score}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
          <div style={{ color: dimmer, fontSize: 11, fontFamily: mono, letterSpacing: '0.1em', marginBottom: 8 }}>RECENT EVENTS</div>
          {recent.length === 0 ? (
            <div style={{ color: dimmer, fontSize: 13 }}>No recent drills logged.</div>
          ) : recent.slice(0, 4).map((event) => (
            <div key={event.id} style={{ marginTop: 8, color: dim, fontSize: 12, lineHeight: 1.4 }}>
              <strong style={{ display: 'block', color: '#fff', fontFamily: sans }}>{event.title}</strong>
              <span style={{ fontFamily: mono }}>{formatOutcome(event.outcome)} | risk {event.riskDelta > 0 ? '+' : ''}{event.riskDelta}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssessmentDrillsPanel({ simulation }) {
  const logDrill = async (drill, outcome, score) => {
    await simulation.addEvent({
      eventType: 'incident-response',
      type: 'incident-response',
      outcome,
      title: drill.title,
      details: {
        scenario: drill.title,
        drillId: drill.id,
        attackTechnique: drill.attackTechnique,
        rubric: `${score}/${drill.maxScore}`,
        score: String(score),
        maxScore: String(drill.maxScore),
        reference: drill.reference,
        evidenceFields: drill.evidenceFields?.join(', '),
        expectedArtifacts: drill.expectedArtifacts?.join(', '),
        scoringFocus: drill.scoringFocus,
      },
    });
  };

  return (
    <section aria-labelledby="assessment-drills-title" style={{
      marginTop: 24,
      padding: 20,
      background: 'rgba(250,204,21,0.035)',
      border: '1px solid rgba(250,204,21,0.2)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: '#facc15', letterSpacing: '0.15em', marginBottom: 10 }}>
            ASSESSMENT DRILLS
          </div>
          <h2 id="assessment-drills-title" style={{ margin: 0, color: '#fff', fontSize: 20, fontFamily: sans, fontWeight: 700 }}>
            Score hands-on work against a small rubric.
          </h2>
          <p style={{ margin: '8px 0 0', color: dim, fontSize: 13, lineHeight: 1.6 }}>
            Log only the assessment result and mapping. Keep raw evidence, lab flags, secrets, and client data out of task notes and drill metadata.
          </p>
        </div>
        <div style={{ minWidth: 150, padding: 14, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: mono, color: dimmer, letterSpacing: '0.12em' }}>DRILLS</div>
          <div style={{ marginTop: 4, fontSize: 34, fontFamily: mono, fontWeight: 800, color: '#facc15' }}>{ASSESSMENT_DRILLS.length}</div>
          <div style={{ fontSize: 11, fontFamily: mono, color: dimmer }}>mapped rubrics</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 16 }}>
        {ASSESSMENT_DRILLS.map((drill) => (
          <article key={drill.id} style={{ padding: 14, background: 'rgba(255,255,255,0.035)', border: `1px solid ${cardBorder}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: '#facc15', fontSize: 11, fontFamily: mono, letterSpacing: '0.1em' }}>{drill.phase}</span>
              <span style={{ color: dimmer, fontSize: 11, fontFamily: mono }}>{drill.attackTechnique}</span>
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 15, fontFamily: sans, lineHeight: 1.3 }}>{drill.title}</h3>
            <ul style={{ margin: '10px 0 12px', paddingLeft: 18, color: dim, fontSize: 12, lineHeight: 1.5 }}>
              {drill.checklist.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
            </ul>
            {drill.evidenceFields && (
              <div style={{ marginBottom: 10, color: dimmer, fontSize: 11, fontFamily: mono, lineHeight: 1.45 }}>
                Evidence: {drill.evidenceFields.slice(0, 4).join(', ')}
              </div>
            )}
            {drill.expectedArtifacts && (
              <div style={{ marginBottom: 12, color: dimmer, fontSize: 11, fontFamily: mono, lineHeight: 1.45 }}>
                Artifacts: {drill.expectedArtifacts.slice(0, 4).join(', ')}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
              <button type="button" disabled={simulation.busy} onClick={() => logDrill(drill, 'completed', drill.maxScore)} style={{ padding: '8px 4px', borderRadius: 6, border: '1px solid rgba(0,255,200,0.35)', background: 'rgba(0,255,200,0.08)', color: accent, fontSize: 11, fontFamily: mono, fontWeight: 800, cursor: simulation.busy ? 'wait' : 'pointer' }}>PASS</button>
              <button type="button" disabled={simulation.busy} onClick={() => logDrill(drill, 'reviewed', Math.max(1, drill.maxScore - 2))} style={{ padding: '8px 4px', borderRadius: 6, border: '1px solid rgba(56,189,248,0.35)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontSize: 11, fontFamily: mono, fontWeight: 800, cursor: simulation.busy ? 'wait' : 'pointer' }}>REVIEW</button>
              <button type="button" disabled={simulation.busy} onClick={() => logDrill(drill, 'failed', 1)} style={{ padding: '8px 4px', borderRadius: 6, border: '1px solid rgba(255,45,107,0.35)', background: 'rgba(255,45,107,0.08)', color: '#ff2d6b', fontSize: 11, fontFamily: mono, fontWeight: 800, cursor: simulation.busy ? 'wait' : 'pointer' }}>FAIL</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedbackPanel() {
  const feedbackLink = "mailto:meidie@mdpstudio.com.au?subject=Feedback:%20Cyber%20Command%20Center&body=Project:%20Cyber%20Command%20Center%0ALink:%20https%3A%2F%2Fc3.mdpstudio.com.au%0AWhat%20happened:%0AWhat%20you%20expected:%0A%0APlease%20do%20not%20include%20passwords%2C%20API%20keys%2C%20private%20account%20data%2C%20client%20data%2C%20or%20payment%20details.";

  return (
    <section aria-labelledby="project-feedback-title" style={{
      marginTop: 24,
      padding: 20,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: "0.15em", marginBottom: 10 }}>PROJECT FEEDBACK</div>
          <h2 id="project-feedback-title" style={{ margin: 0, color: "#fff", fontSize: 20, fontFamily: sans, fontWeight: 700 }}>Found a bug or improvement idea?</h2>
          <p style={{ margin: "8px 0 0", color: dim, fontSize: 14, lineHeight: 1.6 }}>
            Send the tab you were using, what happened, and what you expected so I can reproduce it cleanly.
          </p>
          <p style={{ margin: "8px 0 0", color: dimmer, fontSize: 12, lineHeight: 1.6, fontFamily: mono }}>
            Do not include passwords, API keys, private account data, client data, or payment details.
          </p>
        </div>
        <a href={feedbackLink} style={{
          padding: "11px 16px",
          background: accent + "15",
          border: `1px solid ${accent}45`,
          borderRadius: 8,
          color: accent,
          fontSize: 12,
          fontFamily: mono,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}>SEND FEEDBACK</a>
      </div>
    </section>
  );
}

function Dashboard({ user, signOut, isGuest }) {
  const { progress, loaded, toggleTask, error: progressError } = useProgress(user.id);
  const { notes, updateNote } = useNotes(user.id);
  const { logs, addSession } = useSessions(user.id);
  const simulation = useSimulationEvents(user.id);
  const accountSecurity = useAccountSecurity(user.id, isGuest);
  const [openPhases, setOpenPhases] = useState({});
  const [tab, setTab] = useState("phases");
  const [logOpen, setLogOpen] = useState(true);

  const togglePhase = (id) => setOpenPhases((p) => ({ ...p, [id]: !p[id] }));

  // Debounce notes
  const noteTimers = useRef({});
  const handleNoteChange = useCallback((taskId, val) => {
    // Immediate local update via hook
    clearTimeout(noteTimers.current[taskId]);
    noteTimers.current[taskId] = setTimeout(() => updateNote(taskId, val), 800);
    // Optimistic local - hook handles this
    updateNote(taskId, val);
  }, [updateNote]);

  const handleSessionEnd = useCallback((session) => {
    addSession(session);
    setTab("log");
    setLogOpen(true);
  }, [addSession]);

  const allTasks = PHASES.flatMap((p) => p.modules.flatMap((m) => m.tasks));
  const totalDone = allTasks.filter((t) => progress[t.id]).length;
  const totalPercent = allTasks.length > 0 ? (totalDone / allTasks.length) * 100 : 0;
  const totalHours = PHASES.reduce((sum, p) => sum + p.hours, 0);
  const loggedSeconds = Object.values(logs).reduce((s, d) => s + d.reduce((a, e) => a + e.duration, 0), 0);

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: accent, fontFamily: mono, fontSize: 14, animation: "pulse-glow 1.5s ease-in-out infinite" }}>LOADING OPERATOR DATA...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#fff", fontFamily: sans, maxWidth: 960, margin: "0 auto" }}>
      {/* Scan line */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(0,255,200,0.15), transparent)",
        animation: "scan-line 8s linear infinite", pointerEvents: "none", zIndex: 100,
      }} />

      {/* Guest banner */}
      {isGuest && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 16px", background: "rgba(0,255,200,0.06)",
          borderBottom: "1px solid rgba(0,255,200,0.15)",
          fontSize: 13, fontFamily: mono, color: accent, letterSpacing: "0.05em",
        }}>
          <span style={{ opacity: 0.9 }}>GUEST MODE</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span style={{ opacity: 0.5 }}>progress saved in this browser</span>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: "32px 24px 24px", borderBottom: `1px solid ${cardBorder}`, position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "100%",
          background: "radial-gradient(ellipse at 20% 50%, rgba(0,255,200,0.03) 0%, transparent 60%)", pointerEvents: "none",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontFamily: mono, color: accent + "88", letterSpacing: "0.2em", marginBottom: 8 }}>
              SYSTEM://CYBER-COMMAND
            </div>
            <h1 style={{ fontSize: 28, fontFamily: mono, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 4 }}>
              <span style={{ color: accent }}>CYBER</span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}> COMMAND</span>
            </h1>
          </div>
          <button onClick={signOut} style={{
            background: "transparent", border: `1px solid ${dimmer}`, borderRadius: 8,
            color: dim, fontSize: 12, fontFamily: mono, padding: "8px 14px", cursor: "pointer",
          }}>{isGuest ? "SIGN IN" : "SIGN OUT"}</button>
        </div>
        <p style={{ color: dim, fontSize: 13, fontFamily: mono, marginTop: 4 }}>
          {isGuest ? "Guest operator" : user.email}
        </p>
      </header>

      {/* Stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
        background: "rgba(255,255,255,0.04)", borderBottom: `1px solid ${cardBorder}`,
      }}>
        {[
          { label: "PROGRESS", value: `${Math.round(totalPercent)}%`, sub: "complete" },
          { label: "TASKS", value: `${totalDone}/${allTasks.length}`, sub: "done" },
          { label: "PLANNED", value: `${totalHours}h`, sub: "curriculum" },
          { label: "LOGGED", value: `${(loggedSeconds/3600).toFixed(1)}h`, sub: "actual" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "16px 8px", background: "#0a0a12", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: dimmer, letterSpacing: "0.15em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontFamily: mono, fontWeight: 700, color: accent }}>{s.value}</div>
            <div style={{ fontSize: 11, color: dimmer, fontFamily: mono }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${cardBorder}` }}>
        <div style={{ height: 4, background: cardBorder, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${totalPercent}%`,
            background: "linear-gradient(90deg, #00ffc8, #38bdf8, #a855f7, #ff2d6b)",
            borderRadius: 2, transition: "width 0.5s ease",
          }} />
        </div>
        {progressError && (
          <div role="status" style={{ marginTop: 10, color: "#ff2d6b", fontSize: 12, fontFamily: mono }}>
            {progressError}
          </div>
        )}
      </div>

      <ProjectAboutPanel />
      <StudyResourcesPanel />

      {/* Content */}
      <main style={{ padding: "20px 16px 120px" }}>
        {tab === "timer" && (
          <>
            <StudyTimer onSessionEnd={handleSessionEnd} />
            <SimulationRiskPanel simulation={simulation} />
            <AssessmentDrillsPanel simulation={simulation} />
            <DailyLog logs={logs} isOpen={logOpen} onToggle={() => setLogOpen(!logOpen)} />
          </>
        )}
        {tab === "log" && (
          <>
            <SimulationRiskPanel simulation={simulation} />
            <AssessmentDrillsPanel simulation={simulation} />
            <DailyLog logs={logs} isOpen={true} onToggle={() => {}} />
          </>
        )}
        {tab === "phases" && (
          <>
            <SimulationRiskPanel simulation={simulation} />
            <AssessmentDrillsPanel simulation={simulation} />
            {PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} progress={progress} notes={notes}
                onToggleTask={toggleTask} onNoteChange={handleNoteChange}
                isOpen={!!openPhases[phase.id]} onToggleOpen={() => togglePhase(phase.id)} />
            ))}
            <div style={{ marginTop: 24, padding: 20, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: "0.15em", marginBottom: 12 }}>FREE PLATFORMS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORMS.map((p) => (
                  <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${cardBorder}`,
                      borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: mono, textDecoration: "none",
                    }}>{p.name}</a>
                ))}
              </div>
            </div>
          </>
        )}
        {!isGuest && (
          <AccountSecurityPanel
            status={accountSecurity.status}
            loaded={accountSecurity.loaded}
            error={accountSecurity.error}
            onChanged={accountSecurity.reload}
          />
        )}
        <PrivacyPanel user={user} isGuest={isGuest} accountSecurity={accountSecurity.status} />
        <FeedbackPanel />
      </main>

      {/* Nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(10,10,18,0.95)", borderTop: `1px solid ${cardBorder}`,
        backdropFilter: "blur(12px)", display: "flex", zIndex: 50, paddingBottom: 8,
      }}>
        <NavTab label="PHASES" icon={"\u25C8"} active={tab === "phases"} onClick={() => setTab("phases")} />
        <NavTab label="TIMER" icon={"\u23F1"} active={tab === "timer"} onClick={() => setTab("timer")} />
        <NavTab label="LOG" icon={"\u2630"} active={tab === "log"} onClick={() => setTab("log")} />
      </nav>
    </div>
  );
}

/* App Root */
export default function App() {
  const auth = useAuth();

  // No API? Skip auth entirely and run in guest mode.
  if (!apiConfigured) {
    const guestUser = { id: "guest", email: "guest" };
    return <Dashboard user={guestUser} signOut={() => {}} isGuest={true} />;
  }

  if (auth.loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00ffc8", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, animation: "pulse-glow 1.5s ease-in-out infinite" }}>
          INITIALIZING...
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <Auth onAuth={auth} />;
  }

  const isGuest = auth.user.id === "guest";

  return <Dashboard user={auth.user} signOut={auth.signOut} isGuest={isGuest} />;
}
