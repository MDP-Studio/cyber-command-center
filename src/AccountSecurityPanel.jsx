import { useState } from 'react';
import { c3Api } from './apiClient';

const mono = "'JetBrains Mono', monospace";
const sans = "'Space Grotesk', sans-serif";
const accent = "#00ffc8";
const danger = "#ff2d6b";
const warn = "#ffa500";
const dim = "rgba(255,255,255,0.55)";
const dimmer = "rgba(255,255,255,0.35)";
const cardBg = "rgba(255,255,255,0.03)";
const cardBorder = "rgba(255,255,255,0.1)";

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding: "11px 13px",
  color: "#fff",
  fontSize: 14,
  fontFamily: mono,
  outline: "none",
};

function ActionButton({ children, onClick, disabled, tone = "accent" }) {
  const color = tone === "danger" ? danger : accent;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "11px 16px",
      background: color + (disabled ? "08" : "15"),
      border: `1px solid ${color}${disabled ? "20" : "45"}`,
      borderRadius: 8,
      color: disabled ? dimmer : color,
      fontSize: 12,
      fontFamily: mono,
      fontWeight: 800,
      letterSpacing: "0.08em",
      cursor: disabled ? "not-allowed" : "pointer",
    }}>
      {children}
    </button>
  );
}

export default function AccountSecurityPanel({ status, loaded, error: loadError, onChanged }) {
  const [setup, setSetup] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!loaded) return null;

  const mfaEnabled = Boolean(status?.mfa?.enabled);
  const passwordEnabled = Boolean(status?.auth?.passwordEnabled);
  const highRiskActions = status?.mfa?.highRiskActions || ["delete_account"];

  const resetNotice = () => {
    setError("");
    setMessage("");
  };

  const startSetup = async () => {
    setBusy("setup");
    resetNotice();
    try {
      const data = await c3Api.startMfaSetup();
      setSetup(data);
      setVerifyCode("");
      setMessage("Setup key generated. Verify one authenticator code to enable MFA.");
    } catch (setupError) {
      console.error("MFA setup failed", setupError);
      setError(setupError.message || "MFA setup failed.");
    } finally {
      setBusy("");
    }
  };

  const copySetupUri = async () => {
    resetNotice();
    try {
      await navigator.clipboard.writeText(setup.otpauthUri);
      setMessage("Authenticator URI copied.");
    } catch (copyError) {
      console.error("Authenticator URI copy failed", copyError);
      setError(copyError.message || "Could not copy the authenticator URI.");
    }
  };

  const enableMfa = async () => {
    setBusy("enable");
    resetNotice();
    try {
      await c3Api.enableMfa(verifyCode);
      setSetup(null);
      setVerifyCode("");
      setMessage("MFA enabled for this account.");
      await onChanged();
    } catch (enableError) {
      console.error("MFA enable failed", enableError);
      setError(enableError.message || "MFA could not be enabled.");
    } finally {
      setBusy("");
    }
  };

  const disableMfa = async () => {
    setBusy("disable");
    resetNotice();
    try {
      await c3Api.disableMfa(disableCode);
      setDisableCode("");
      setMessage("MFA disabled.");
      await onChanged();
    } catch (disableError) {
      console.error("MFA disable failed", disableError);
      setError(disableError.message || "MFA could not be disabled.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section aria-labelledby="account-security-title" style={{
      marginTop: 24,
      padding: 20,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: "0.15em", marginBottom: 10 }}>
        ACCOUNT SECURITY
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h2 id="account-security-title" style={{ margin: 0, color: "#fff", fontSize: 20, fontFamily: sans, fontWeight: 700 }}>
            {mfaEnabled ? "Authenticator MFA is on" : "Authenticator MFA is off"}
          </h2>
          <p style={{ margin: "8px 0 0", color: dim, fontSize: 14, lineHeight: 1.6 }}>
            {mfaEnabled
              ? "Password sign-in and marked account-risk actions require a 6-digit authenticator code."
              : "Email/password accounts can add a 6-digit authenticator code before sync access is granted."}
          </p>
        </div>
        <div style={{
          border: `1px solid ${mfaEnabled ? accent + "45" : warn + "45"}`,
          color: mfaEnabled ? accent : warn,
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 12,
          fontFamily: mono,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}>
          {mfaEnabled ? "MFA ACTIVE" : "MFA OPTIONAL"}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {highRiskActions.map((action) => (
          <span key={action} style={{
            display: "inline-flex",
            border: `1px solid ${danger}35`,
            borderRadius: 999,
            padding: "6px 10px",
            color: danger,
            fontSize: 11,
            fontFamily: mono,
            letterSpacing: "0.06em",
          }}>
            HIGH RISK: {action.replace("_", " ").toUpperCase()}
          </span>
        ))}
      </div>

      {(loadError || error) && (
        <div role="alert" style={{
          marginTop: 14,
          color: danger,
          fontSize: 13,
          fontFamily: mono,
          padding: "10px 14px",
          background: "rgba(255,45,107,0.1)",
          borderRadius: 8,
        }}>{error || loadError}</div>
      )}
      {message && (
        <div role="status" style={{
          marginTop: 14,
          color: accent,
          fontSize: 13,
          fontFamily: mono,
          padding: "10px 14px",
          background: accent + "14",
          borderRadius: 8,
        }}>{message}</div>
      )}

      {!passwordEnabled && (
        <p style={{ margin: "14px 0 0", color: dimmer, fontSize: 12, lineHeight: 1.6, fontFamily: mono }}>
          Google-only account detected. Use Google 2-Step Verification for sign-in; app MFA is available when email/password login is enabled.
        </p>
      )}

      {!mfaEnabled && passwordEnabled && (
        <div style={{ marginTop: 16 }}>
          {!setup ? (
            <ActionButton onClick={startSetup} disabled={Boolean(busy)}>
              {busy === "setup" ? "GENERATING..." : "SET UP MFA"}
            </ActionButton>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{
                padding: 14,
                border: `1px solid ${accent}30`,
                borderRadius: 8,
                background: "rgba(0,255,200,0.05)",
              }}>
                <div style={{ color: accent, fontSize: 12, fontFamily: mono, fontWeight: 800, marginBottom: 8 }}>
                  SETUP KEY
                </div>
                <code style={{ display: "block", color: "#fff", fontSize: 16, lineHeight: 1.5, wordBreak: "break-word" }}>
                  {setup.secretFormatted}
                </code>
                <code style={{ display: "block", color: dimmer, fontSize: 11, lineHeight: 1.5, marginTop: 8, wordBreak: "break-all" }}>
                  {setup.otpauthUri}
                </code>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ ...inputStyle, flex: "1 1 180px" }}
                />
                <ActionButton onClick={copySetupUri} disabled={Boolean(busy)}>COPY URI</ActionButton>
                <ActionButton onClick={enableMfa} disabled={busy === "enable" || verifyCode.length !== 6}>
                  {busy === "enable" ? "VERIFYING..." : "ENABLE"}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      )}

      {mfaEnabled && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={disableCode}
            onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ ...inputStyle, flex: "1 1 180px" }}
          />
          <ActionButton tone="danger" onClick={disableMfa} disabled={busy === "disable" || disableCode.length !== 6}>
            {busy === "disable" ? "DISABLING..." : "DISABLE MFA"}
          </ActionButton>
        </div>
      )}
    </section>
  );
}
