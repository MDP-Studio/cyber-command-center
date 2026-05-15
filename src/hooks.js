import { useState, useEffect, useCallback } from 'react';
import { apiConfigured, authApi, c3Api } from './apiClient';

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
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signUp = async (email, password, displayName) => {
    try {
      const data = await authApi.signUp(email, password, displayName);
      setUser(data.user ?? null);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const data = await authApi.signIn(email, password);
      setUser(data.user ?? null);
      return { data, error: null };
    } catch (error) {
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
      return { data: null, error };
    }
  };

  const confirmPasswordReset = async (token, password) => {
    try {
      const data = await authApi.confirmPasswordReset(token, password);
      return { data, error: null };
    } catch (error) {
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

  return { user, loading, signUp, signIn, signOut, resetPassword, confirmPasswordReset, signInWithGoogle, continueAsGuest };
}

const isGuest = (userId) => userId === "guest";

export function useProgress(userId) {
  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (isGuest(userId)) {
      try { setProgress(JSON.parse(localStorage.getItem("ccc_progress") || "{}")); } catch { /* ignore */ }
      setLoaded(true);
      return;
    }
    c3Api.getProgress()
      .then(({ progress: rows }) => {
        const map = {};
        (rows || []).forEach((row) => { if (row.completed) map[row.task_id] = true; });
        setProgress(map);
      })
      .finally(() => setLoaded(true));
  }, [userId]);

  const toggleTask = useCallback(async (taskId) => {
    const newVal = !progress[taskId];
    setProgress((p) => {
      const next = { ...p, [taskId]: newVal };
      if (isGuest(userId)) localStorage.setItem("ccc_progress", JSON.stringify(next));
      return next;
    });

    if (!isGuest(userId)) {
      await c3Api.setProgress(taskId, newVal);
    }
  }, [userId, progress]);

  return { progress, loaded, toggleTask };
}

export function useNotes(userId) {
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (!userId) return;
    if (isGuest(userId)) {
      try { setNotes(JSON.parse(localStorage.getItem("ccc_notes") || "{}")); } catch { /* ignore */ }
      return;
    }
    c3Api.getNotes()
      .then(({ notes: rows }) => {
        const map = {};
        (rows || []).forEach((row) => { if (row.content) map[row.task_id] = row.content; });
        setNotes(map);
      })
      .catch(() => setNotes({}));
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
      try { setLogs(JSON.parse(localStorage.getItem("ccc_sessions") || "{}")); } catch { /* ignore */ }
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
      .catch(() => setLogs({}));
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
