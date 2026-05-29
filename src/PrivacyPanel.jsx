import { useState } from 'react';
import { c3Api } from './apiClient';

const mono = "'JetBrains Mono', monospace";
const sans = "'Space Grotesk', sans-serif";
const accent = "#00ffc8";
const danger = "#ff2d6b";
const dim = "rgba(255,255,255,0.55)";
const dimmer = "rgba(255,255,255,0.35)";
const cardBg = "rgba(255,255,255,0.03)";
const cardBorder = "rgba(255,255,255,0.1)";

const GUEST_KEYS = ['ccc_progress', 'ccc_notes', 'ccc_sessions', 'ccc_simulation_events'];

function todayKey() { return new Date().toISOString().slice(0, 10); }

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readGuestData() {
  const out = {};
  for (const key of GUEST_KEYS) {
    try { out[key] = JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (error) {
      console.warn(`Guest data key ${key} could not be parsed`, error);
      out[key] = null;
    }
  }
  return out;
}

function clearGuestData() {
  for (const key of GUEST_KEYS) localStorage.removeItem(key);
}

export default function PrivacyPanel({ user, isGuest, accountSecurity = null }) {
  const [busy, setBusy] = useState(null); // 'export' | 'delete' | null
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const deleteRequiresMfa = Boolean(!isGuest && accountSecurity?.mfa?.enabled);

  const handleExport = async () => {
    setBusy('export');
    setError('');
    setMessage('');
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        app: 'cyber-command-center',
        mode: isGuest ? 'guest' : 'signed-in',
        user: isGuest ? null : { id: user.id, email: user.email },
        data: isGuest ? readGuestData() : (await c3Api.exportAccount()).data,
      };
      downloadJson(`c3-export-${todayKey()}.json`, payload);
      setMessage('Export downloaded.');
    } catch (e) {
      console.error('Privacy export failed', e);
      setError(e.message || 'Export failed.');
    }
    setBusy(null);
  };

  const handleDelete = async () => {
    setBusy('delete');
    setError('');
    setMessage('');
    try {
      if (isGuest) {
        clearGuestData();
      } else {
        await c3Api.deleteAccount(deleteRequiresMfa ? mfaCode : undefined);
        clearGuestData();
      }
      setConfirmOpen(false);
      setConfirmText('');
      setMfaCode('');
      // Hard reload: cleanest way to drop every in-memory hook cache across
      // guest and signed-in modes without threading state resets through
      // each hook.
      window.location.reload();
    } catch (e) {
      console.error('Account deletion failed', e);
      setError(e.message || 'Delete failed.');
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="privacy-panel-title" style={{
      marginTop: 24,
      padding: 20,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 12, fontFamily: mono, color: accent, letterSpacing: '0.15em', marginBottom: 10 }}>
        PRIVACY CONTROLS
      </div>
      <h2 id="privacy-panel-title" style={{ margin: 0, color: '#fff', fontSize: 20, fontFamily: sans, fontWeight: 700 }}>
        Export or delete your data
      </h2>
      <p style={{ margin: '8px 0 0', color: dim, fontSize: 14, lineHeight: 1.6 }}>
        {isGuest
          ? 'Guest mode keeps everything in this browser. Export pulls a JSON copy; delete clears the local keys for this site.'
          : 'Export downloads a JSON snapshot of your profile, task progress, notes, study sessions, and simulation events. Delete removes every row scoped to your account.'}
      </p>

      {!isGuest && (
        <p style={{ margin: '8px 0 0', color: dimmer, fontSize: 12, lineHeight: 1.6, fontFamily: mono }}>
          High-risk action: deleting removes your account record and training data from the self-hosted backend. Provider backups may retain deleted data for their normal retention window.
          {deleteRequiresMfa ? ' MFA step-up is required.' : ''}
        </p>
      )}

      {error && (
        <div role="alert" style={{
          marginTop: 14, color: danger, fontSize: 13, fontFamily: mono,
          padding: '10px 14px', background: 'rgba(255,45,107,0.1)', borderRadius: 8,
        }}>{error}</div>
      )}
      {message && (
        <div role="status" style={{
          marginTop: 14, color: accent, fontSize: 13, fontFamily: mono,
          padding: '10px 14px', background: accent + '14', borderRadius: 8,
        }}>{message}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <button onClick={handleExport} disabled={busy !== null} style={{
          padding: '11px 16px',
          background: accent + '15',
          border: `1px solid ${accent}45`,
          borderRadius: 8,
          color: accent,
          fontSize: 12,
          fontFamily: mono,
          fontWeight: 800,
          letterSpacing: '0.1em',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy === 'export' ? 0.5 : 1,
        }}>
          {busy === 'export' ? 'EXPORTING...' : 'EXPORT MY DATA'}
        </button>
        <button onClick={() => { setConfirmOpen(true); setError(''); setMessage(''); }} disabled={busy !== null} style={{
          padding: '11px 16px',
          background: 'rgba(255,45,107,0.1)',
          border: `1px solid ${danger}45`,
          borderRadius: 8,
          color: danger,
          fontSize: 12,
          fontFamily: mono,
          fontWeight: 800,
          letterSpacing: '0.1em',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.5 : 1,
        }}>
          {isGuest ? 'CLEAR LOCAL DATA' : 'DELETE MY ACCOUNT'}
        </button>
      </div>

      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: 460,
            background: '#0a0a12',
            border: `1px solid ${danger}50`,
            borderRadius: 12,
            padding: 24,
          }}>
            <div style={{ fontSize: 12, fontFamily: mono, color: danger, letterSpacing: '0.15em', marginBottom: 10 }}>
              {deleteRequiresMfa ? 'HIGH-RISK STEP-UP' : 'IRREVERSIBLE'}
            </div>
            <h3 id="confirm-title" style={{ margin: 0, color: '#fff', fontSize: 18, fontFamily: sans, fontWeight: 700 }}>
              {isGuest ? 'Clear local data?' : 'Delete your account data?'}
            </h3>
            <p style={{ margin: '10px 0 0', color: dim, fontSize: 14, lineHeight: 1.6 }}>
              {isGuest
                ? 'This wipes your progress, notes, and study sessions stored in this browser. Cannot be undone.'
                : 'This permanently deletes your profile row, task progress, notes, and study sessions. You will be signed out. Cannot be undone.'}
            </p>
            <p style={{ margin: '12px 0 8px', color: dim, fontSize: 13, fontFamily: mono }}>
              Type <span style={{ color: danger }}>DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${dimmer}`,
                borderRadius: 8,
                padding: '12px 14px',
                color: '#fff',
                fontSize: 14,
                fontFamily: mono,
                outline: 'none',
                marginBottom: 16,
              }}
            />
            {deleteRequiresMfa && (
              <>
                <p style={{ margin: '0 0 8px', color: dim, fontSize: 13, fontFamily: mono }}>
                  Enter your 6-digit MFA code.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${dimmer}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: 14,
                    fontFamily: mono,
                    outline: 'none',
                    marginBottom: 16,
                  }}
                />
              </>
            )}
            {error && (
              <div role="alert" style={{
                color: danger, fontSize: 13, fontFamily: mono,
                padding: '10px 14px', background: 'rgba(255,45,107,0.1)', borderRadius: 8, marginBottom: 14,
              }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setConfirmOpen(false); setConfirmText(''); setMfaCode(''); setError(''); }} disabled={busy === 'delete'} style={{
                flex: 1, padding: '11px 0',
                background: 'transparent',
                border: `1px solid ${dimmer}`,
                borderRadius: 8,
                color: dim,
                fontSize: 12,
                fontFamily: mono,
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleDelete} disabled={confirmText !== 'DELETE' || (deleteRequiresMfa && mfaCode.length !== 6) || busy === 'delete'} style={{
                flex: 1, padding: '11px 0',
                background: confirmText === 'DELETE' && (!deleteRequiresMfa || mfaCode.length === 6) ? 'rgba(255,45,107,0.18)' : 'rgba(255,45,107,0.05)',
                border: `1px solid ${danger}${confirmText === 'DELETE' && (!deleteRequiresMfa || mfaCode.length === 6) ? '60' : '20'}`,
                borderRadius: 8,
                color: confirmText === 'DELETE' && (!deleteRequiresMfa || mfaCode.length === 6) ? danger : dimmer,
                fontSize: 12,
                fontFamily: mono,
                fontWeight: 800,
                letterSpacing: '0.1em',
                cursor: confirmText === 'DELETE' && (!deleteRequiresMfa || mfaCode.length === 6) ? 'pointer' : 'not-allowed',
              }}>{busy === 'delete' ? 'DELETING...' : 'CONFIRM DELETE'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
