import { useState, useEffect, useCallback } from 'react';
import { apiConfigured, authApi, c3Api } from './apiClient';
import { buildGuestSimulationEvent, summarizeSimulationEvents } from './simulationEvents';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiConfigured) {
      setLoading(false);
      return;
    }
    authApi.getSession()
      .then(({ user: sessionUser }) => setUser(sessionUser ?? null))
      .catch((error) => {
        console.warn("Session lookup failed", error);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = async (email, password, displayName) => {
    try {
      const data = await authApi.signUp(email, password, displayName);
      setUser(data.user ?? null);
      return { data, error: null };
    } catch (error) {
      console.warn("Sign in failed", error);
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const data = await authApi.signIn(email, password);
      setUser(data.user ?? null);
      return { data, error: null };
    } catch (error) {
      console.warn("MFA login verification failed", error);
      return { data: null, error };
    }
  };

  const verifyMfaLogin = async (ticket, code) => {
    try {
      const data = await authApi.verifyMfaLogin(ticket, code);
      setUser(data.user ?? null);
      return { data, error: null };
    } catch (error) {
      console.warn("Sign up failed", error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    if (apiConfigured && user?.id !== "guest") await authApi.signOut();
    setUser(null);
  };

  const resetPassword = async (email) => {
    try {
      const data = await authApi.resetPassword(email);
      return { data, error: null };
    } catch (error) {
      console.warn("Password reset request failed", error);
      return { data: null, error };
    }
  };

  const confirmPasswordReset = async (token, password) => {
    try {
      const data = await authApi.confirmPasswordReset(token, password);
      return { data, error: null };
    } catch (error) {
      console.warn("Password reset confirmation failed", error);
      return { data: null, error };
    }
  };

  const signInWithGoogle = async () => {
    authApi.signInWithGoogle();
    return { data: null, error: null };
  };

  const continueAsGuest = () => {
    setUser({ id: "guest", email: "guest" });
  };

  return { user, loading, signUp, signIn, verifyMfaLogin, signOut, resetPassword, confirmPasswordReset, signInWithGoogle, continueAsGuest };
}

const isGuest = (userId) => userId === "guest";

export function useProgress(userId) {
  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    setLoaded(false);
    setError("");
    if (isGuest(userId)) {
      try { setProgress(JSON.parse(localStorage.getItem("ccc_progress") || "{}")); } catch (error) { console.warn("Guest progress could not be parsed", error); }
      setLoaded(true);
      return;
    }
    c3Api.getProgress()
      .then(({ progress: rows }) => {
        const map = {};
        (rows || []).forEach((row) => { if (row.completed) map[row.task_id] = true; });
        setProgress(map);
      })
      .catch((error) => {
        console.warn("Progress load failed", error);
        setProgress({});
        setError("Progress could not be loaded. Try refreshing.");
      })
      .finally(() => setLoaded(true));
  }, [userId]);

  const toggleTask = useCallback(async (taskId) => {
    const newVal = !progress[taskId];
    setError("");
    setProgress((p) => {
      const next = { ...p, [taskId]: newVal };
      if (isGuest(userId)) localStorage.setItem("ccc_progress", JSON.stringify(next));
      return next;
    });

    if (!isGuest(userId)) {
      try {
        await c3Api.setProgress(taskId, newVal);
      } catch (error) {
        console.warn("Progress save failed", error);
        setProgress((p) => ({ ...p, [taskId]: !newVal }));
        setError("Progress could not be saved. Please retry.");
      }
    }
  }, [userId, progress]);

  return { progress, loaded, toggleTask, error };
}

export function useNotes(userId) {
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (!userId) return;
    if (isGuest(userId)) {
      try { setNotes(JSON.parse(localStorage.getItem("ccc_notes") || "{}")); } catch (error) { console.warn("Guest notes could not be parsed", error); }
      return;
    }
    c3Api.getNotes()
      .then(({ notes: rows }) => {
        const map = {};
        (rows || []).forEach((row) => { if (row.content) map[row.task_id] = row.content; });
        setNotes(map);
      })
      .catch((error) => {
        console.warn("Notes load failed", error);
        setNotes({});
      });
  }, [userId]);

  const updateNote = useCallback(async (taskId, content) => {
    setNotes((n) => {
      const next = { ...n, [taskId]: content };
      if (isGuest(userId)) localStorage.setItem("ccc_notes", JSON.stringify(next));
      return next;
    });
    if (!isGuest(userId)) {
      await c3Api.setNote(taskId, content);
    }
  }, [userId]);

  return { notes, updateNote };
}

export function useSessions(userId) {
  const [logs, setLogs] = useState({});

  useEffect(() => {
    if (!userId) return;
    if (isGuest(userId)) {
      try { setLogs(JSON.parse(localStorage.getItem("ccc_sessions") || "{}")); } catch (error) { console.warn("Guest sessions could not be parsed", error); }
      return;
    }
    c3Api.getSessions()
      .then(({ sessions: rows }) => {
        const map = {};
        (rows || []).forEach((row) => {
          const key = row.session_date;
          if (!map[key]) map[key] = [];
          map[key].push({ label: row.label, duration: row.duration_seconds });
        });
        setLogs(map);
      })
      .catch((error) => {
        console.warn("Sessions load failed", error);
        setLogs({});
      });
  }, [userId]);

  const addSession = useCallback(async (session) => {
    setLogs((prev) => {
      const day = prev[session.date] || [];
      const next = { ...prev, [session.date]: [{ label: session.label, duration: session.duration }, ...day] };
      if (isGuest(userId)) localStorage.setItem("ccc_sessions", JSON.stringify(next));
      return next;
    });

    if (!isGuest(userId)) {
      await c3Api.addSession(session);
    }
  }, [userId]);

  return { logs, addSession };
}

export function useSimulationEvents(userId) {
  const [summary, setSummary] = useState(() => summarizeSimulationEvents([]));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadGuestEvents = useCallback(() => {
    try {
      const events = JSON.parse(localStorage.getItem('ccc_simulation_events') || '[]');
      setSummary(summarizeSimulationEvents(Array.isArray(events) ? events : []));
    } catch (parseError) {
      console.warn('Guest simulation events could not be parsed', parseError);
      setSummary(summarizeSimulationEvents([]));
    }
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setError('');
    if (isGuest(userId)) {
      loadGuestEvents();
      return;
    }
    try {
      setSummary(await c3Api.getRiskSummary());
    } catch (loadError) {
      console.warn('Risk summary load failed', loadError);
      setError('Simulation risk summary could not be loaded.');
      setSummary(summarizeSimulationEvents([]));
    }
  }, [loadGuestEvents, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const addEvent = useCallback(async (event) => {
    setBusy(true);
    setError('');
    try {
      if (isGuest(userId)) {
        const current = JSON.parse(localStorage.getItem('ccc_simulation_events') || '[]');
        const next = [buildGuestSimulationEvent(event), ...(Array.isArray(current) ? current : [])].slice(0, 100);
        localStorage.setItem('ccc_simulation_events', JSON.stringify(next));
        setSummary(summarizeSimulationEvents(next));
        return;
      }
      const result = await c3Api.addSimulationEvent(event);
      setSummary(result.riskSummary || summarizeSimulationEvents([]));
    } catch (saveError) {
      console.warn('Simulation event save failed', saveError);
      setError(saveError.message || 'Simulation event could not be saved.');
    } finally {
      setBusy(false);
    }
  }, [userId]);

  return { summary, error, busy, addEvent, reload: load };
}

export function useAccountSecurity(userId, isGuestMode) {
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId || isGuestMode) {
      setStatus(null);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setError('');
    try {
      const data = await c3Api.getAccountSecurity();
      setStatus(data);
    } catch (loadError) {
      console.warn("Account security load failed", loadError);
      setStatus(null);
      setError(loadError.message || 'Account security could not be loaded.');
    } finally {
      setLoaded(true);
    }
  }, [isGuestMode, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, loaded, error, reload: load };
}
