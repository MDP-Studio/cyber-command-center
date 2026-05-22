import { useState } from 'react';
import { apiConfigured } from './apiClient';

const mono = "'JetBrains Mono', monospace";
const sans = "'Space Grotesk', sans-serif";
const accent = "#00ffc8";
const dim = "rgba(255,255,255,0.55)";
const dimmer = "rgba(255,255,255,0.35)";
const mdpProjectUrl = "https://mdpstudio.com.au/projects/cybersecurity-study-roadmap/";

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding: "14px 16px",
  color: "#fff",
  fontSize: 15,
  fontFamily: sans,
  outline: "none",
  marginBottom: 14,
};

const btnPrimary = {
  width: "100%",
  padding: "14px 0",
  background: accent + "18",
  border: `1px solid ${accent}50`,
  borderRadius: 8,
  color: accent,
  fontSize: 14,
  fontFamily: mono,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.08em",
  marginBottom: 14,
};

export default function Auth({ onAuth }) {
  const initialResetToken = apiConfigured
    ? new URLSearchParams(window.location.search).get("resetToken") || ""
    : "";
  const [mode, setMode] = useState(initialResetToken ? "confirmReset" : "login"); // login | signup | reset | confirmReset | mfa
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [mfaTicket, setMfaTicket] = useState("");
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await onAuth.signIn(email, password);
        if (error) setError(error.message);
        else if (data?.mfaRequired) {
          setMfaTicket(data.ticket);
          setMfaEmail(data.email || email);
          setMfaCode("");
          setPassword("");
          setMode("mfa");
          setMessage("Enter your authenticator code to finish signing in.");
        }
      } else if (mode === "mfa") {
        if (!mfaTicket) { setError("MFA challenge is missing. Log in again."); setLoading(false); return; }
        const { error } = await onAuth.verifyMfaLogin(mfaTicket, mfaCode);
        if (error) setError(error.message);
      } else if (mode === "signup") {
        if (!name.trim()) { setError("Enter a display name"); setLoading(false); return; }
        const { error } = await onAuth.signUp(email, password, name);
        if (error) setError(error.message);
        else setMessage("Check your email for a confirmation link.");
      } else if (mode === "reset") {
        const { error } = await onAuth.resetPassword(email);
        if (error) setError(error.message);
        else setMessage("Password reset email sent.");
      } else if (mode === "confirmReset") {
        if (!resetToken) { setError("Reset token is missing."); setLoading(false); return; }
        const { error } = await onAuth.confirmPasswordReset(resetToken, password);
        if (error) setError(error.message);
        else {
          setPassword("");
          setResetToken("");
          setMode("login");
          setMessage("Password updated. You can log in now.");
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    } catch (e) {
      console.error("Authentication action failed", e);
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a12",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: accent + "88", letterSpacing: "0.2em", marginBottom: 14 }}>
            SYSTEM://AUTHENTICATE
          </div>
          <h1 style={{ fontSize: 32, fontFamily: mono, fontWeight: 800, lineHeight: 1.2 }}>
            <span style={{ color: accent }}>CYBER</span>
            <span style={{ color: "rgba(255,255,255,0.85)" }}> COMMAND</span>
          </h1>
          <p style={{ color: dim, fontSize: 14, fontFamily: mono, marginTop: 10 }}>
            {mode === "login" && "Log in to sync your progress"}
            {mode === "signup" && "Create your operator account"}
            {mode === "reset" && "Reset your access credentials"}
            {mode === "confirmReset" && "Set a new password"}
            {mode === "mfa" && "Verify your authenticator code"}
          </p>
        </div>

        <section aria-labelledby="auth-about-title" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: 0, marginBottom: 10 }}>ABOUT THIS PROJECT</div>
          <h2 id="auth-about-title" style={{ margin: 0, color: "#fff", fontSize: 18, fontFamily: sans, lineHeight: 1.35 }}>
            Self-directed cybersecurity training with progress tracking.
          </h2>
          <p style={{ margin: "10px 0 0", color: dim, fontSize: 13, lineHeight: 1.6 }}>
            Track 49 tasks across 6 phases, log study sessions, keep task notes, and use guest mode instantly without creating an account.
          </p>
          <a href={mdpProjectUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex",
            marginTop: 12,
            color: accent,
            fontSize: 12,
            fontFamily: mono,
            fontWeight: 800,
            letterSpacing: 0,
            textDecoration: "none",
          }}>
            View the MDP Studio project page
          </a>
        </section>

        {/* Form only shows when the self-hosted API is configured */}
        {apiConfigured && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: 28,
          }}>
            {/* Google OAuth */}
            {mode !== "reset" && mode !== "confirmReset" && mode !== "mfa" && (
              <>
                <button onClick={() => { setError(""); onAuth.signInWithGoogle(); }} style={{
                  width: "100%", padding: "14px 0", background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff",
                  fontSize: 15, fontFamily: sans, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  marginBottom: 18,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 18,
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                  <span style={{ fontSize: 11, fontFamily: mono, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
                </div>
              </>
            )}

            {mode === "mfa" && (
              <p style={{ margin: "0 0 14px", color: dim, fontSize: 13, lineHeight: 1.6 }}>
                Code required for {mfaEmail || "this account"}.
              </p>
            )}
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            )}
            {mode !== "confirmReset" && mode !== "mfa" && (
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            )}
            {mode !== "reset" && mode !== "mfa" && (
              <input
                type="password"
                placeholder={mode === "confirmReset" ? "New password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            )}
            {mode === "mfa" && (
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            )}

            {error && (
              <div style={{
                color: "#ff2d6b",
                fontSize: 13,
                fontFamily: mono,
                padding: "10px 14px",
                background: "rgba(255,45,107,0.1)",
                borderRadius: 8,
                marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                color: accent,
                fontSize: 13,
                fontFamily: mono,
                padding: "10px 14px",
                background: accent + "14",
                borderRadius: 8,
                marginBottom: 14,
              }}>
                {message}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              ...btnPrimary,
              opacity: loading ? 0.5 : 1,
            }}>
              {loading ? "..." :
                mode === "login" ? "LOG IN" :
                mode === "signup" ? "CREATE ACCOUNT" :
                mode === "confirmReset" ? "UPDATE PASSWORD" :
                mode === "mfa" ? "VERIFY CODE" :
                "SEND RESET LINK"
              }
            </button>

            {/* Mode switching */}
            <div style={{ textAlign: "center", fontSize: 13, fontFamily: mono }}>
              {mode === "login" && (
                <>
                  <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
                    style={{ background: "none", border: "none", color: dim, cursor: "pointer", fontFamily: mono, fontSize: 13 }}>
                    Create account
                  </button>
                  <span style={{ color: dimmer, margin: "0 8px" }}>|</span>
                  <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
                    style={{ background: "none", border: "none", color: dim, cursor: "pointer", fontFamily: mono, fontSize: 13 }}>
                    Forgot password
                  </button>
                </>
              )}
              {(mode === "signup" || mode === "reset" || mode === "confirmReset" || mode === "mfa") && (
                <button onClick={() => { if (mode === "confirmReset") window.history.replaceState(null, "", window.location.pathname); setMode("login"); setError(""); setMessage(""); setResetToken(""); setMfaTicket(""); setMfaCode(""); }}
                  style={{ background: "none", border: "none", color: dim, cursor: "pointer", fontFamily: mono, fontSize: 13 }}>
                  Back to login
                </button>
              )}
            </div>
          </div>
        )}

        {/* Guest mode */}
        <div style={{ textAlign: "center", marginTop: apiConfigured ? 24 : 0 }}>
          <button onClick={onAuth.continueAsGuest} style={
            apiConfigured
              ? { background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: mono, fontSize: 13, letterSpacing: "0.05em", padding: "10px 16px", transition: "color 0.2s" }
              : { ...btnPrimary, marginBottom: 8 }
          }
            onMouseEnter={(e) => { if (apiConfigured) e.target.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={(e) => { if (apiConfigured) e.target.style.color = "rgba(255,255,255,0.4)"; }}
          >
            {apiConfigured ? "Continue as guest" : "ENTER COMMAND CENTER"}
          </button>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: mono, marginTop: 8 }}>
            Progress saved locally only - won't sync across devices
          </p>
        </div>
      </div>
    </div>
  );
}
