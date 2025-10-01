'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { z } from 'zod';

type FieldKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'emergencyName'
  | 'emergencyEmail'
  | 'contactPreference'
  | 'interests'
  | 'referralSource'
  | 'notes'
  | 'newsletter';

type FieldConfig = {
  key: FieldKey;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'checkbox-group' | 'textarea' | 'checkbox';
  placeholder?: string;
  options?: { value: string; label: string }[];
};

const ALL_FIELDS: FieldConfig[] = [
  { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe' },
  { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '(555) 555-1234' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
  { key: 'emergencyName', label: 'Emergency Contact Name', type: 'text', placeholder: 'John Doe' },
  { key: 'emergencyEmail', label: 'Emergency Contact Email', type: 'email', placeholder: 'john@example.com' },
  { key: 'contactPreference', label: 'Preferred Contact', type: 'radio', options: [
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
  ] },
  { key: 'interests', label: 'Interests', type: 'checkbox-group', options: [
    { value: 'sports', label: 'Sports' },
    { value: 'music', label: 'Music' },
    { value: 'tech', label: 'Tech' },
    { value: 'travel', label: 'Travel' },
  ] },
  { key: 'referralSource', label: 'How did you hear about us?', type: 'select', options: [
    { value: '', label: 'Select one' },
    { value: 'friend', label: 'Friend/Family' },
    { value: 'search', label: 'Search Engine' },
    { value: 'social', label: 'Social Media' },
    { value: 'ad', label: 'Advertisement' },
    { value: 'other', label: 'Other' },
  ] },
  { key: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Anything we should know?' },
  { key: 'newsletter', label: 'Subscribe to newsletter', type: 'checkbox' },
];

const REQUIRED_ALWAYS: FieldKey[] = ['name', 'email'];

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().min(7, 'Too short').optional(),
  email: z.string().email('Invalid email'),
  emergencyName: z.string().min(1, 'Required').optional(),
  emergencyEmail: z.string().email('Invalid email').optional(),
  contactPreference: z.enum(['phone', 'email', 'sms']).optional(),
  interests: z.array(z.string()).min(1, 'Select at least one').optional(),
  referralSource: z.enum(['friend', 'search', 'social', 'ad', 'other']).optional(),
  notes: z.string().min(1, 'Required').optional(),
  newsletter: z.boolean().optional(),
});

type Values = Partial<Record<FieldKey, string | string[] | boolean>>;
type Errors = Partial<Record<FieldKey, string>>;

function getRandomSubset<T>(arr: T[]): T[] {
  const count = Math.max(1, Math.floor(Math.random() * arr.length));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getRandomPositions(count: number, containers: number): number[] {
  const positions = Array.from({ length: containers }, (_, i) => i);
  return positions.sort(() => Math.random() - 0.5).slice(0, count);
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const [visibleFields, setVisibleFields] = useState<FieldConfig[]>([]);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Errors>({});
  const [submitPosition, setSubmitPosition] = useState<number>(0);
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [popupText, setPopupText] = useState<string>('Welcome! This is a random popup.');
  const delayedPopupTimer = useRef<number | null>(null);
  const [themeClass, setThemeClass] = useState<string>('');
  const [fontClass, setFontClass] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState<boolean>(false);
  const [sessionId] = useState<string>(() => cryptoRandomId());
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));

  const fieldMap = useMemo(() => Object.fromEntries(ALL_FIELDS.map(f => [f.key, f])) as Record<FieldKey, FieldConfig>, []);

  useEffect(() => {
    try {
      (window as any).__sessionId = sessionId;
    } catch {}
    const path = pathname || '/';
    const match = path.match(/\/seed\/(\d+)/);
    let currentSeed = seed;
    if (match) {
      currentSeed = Number(match[1]);
    } else if (path === '/') {
      // Generate once and move to seed slug
      currentSeed = Math.floor(Math.random() * 1_000_000);
      router.replace(`/seed/${currentSeed}`);
    }
    setSeed(currentSeed);
    try { (window as any).__seed = currentSeed; } catch {}
    // Initialize UI deterministically from seed
    initFromSeed(currentSeed);
    // Random popup: immediate (33%), delayed (33%), or none (34%)
    const sketchyAds = [
      '🎰💰 CONGRATULATIONS! You\'ve won $10,000! Click OK to claim your prize now!',
      '⚠️ VIRUS ALERT ⚠️ Your computer has 37 viruses! Windows Defender has detected multiple threats. Click OK to clean now!',
      '💊 DOCTORS HATE HIM! Discover this one weird trick to lose 50 lbs in 2 days! Click OK to learn more!',
      '🔒 DOWNLOAD REQUIRED: Your Flash Player is out of date. Click OK to download Free_Movie.exe (100% Safe & Legal)',
      '👑 URGENT: Nigerian prince needs YOUR help! Transfer $500 today, get $5 MILLION back! Click OK for details!',
      '💻🔥 HOT SINGLES IN YOUR AREA want to meet you tonight! Click OK to see profiles!',
      '🎁 You are visitor #1,000,000! You\'ve won a FREE iPhone 15 Pro Max! Click OK to claim now!',
      '🎮 FREE V-BUCKS! Unlimited game currency available. No survey required! Click OK to download!',
      '🚨 URGENT 🚨 Your Social Security Number has been suspended due to suspicious activity! Click OK to fix immediately!',
      '💰 WORK FROM HOME! Make $5,000 per day with no experience needed! Click OK to start earning now!',
    ];
    const r = Math.random();
    if (r < 0.33) {
      const randomAd = sketchyAds[Math.floor(Math.random() * sketchyAds.length)];
      setPopupText(randomAd);
      setShowPopup(true);
      emit('popup_open', {});
    } else if (r < 0.66) {
      const delayMs = 1000 + Math.floor(Math.random() * 4000);
      delayedPopupTimer.current = window.setTimeout(() => {
        const randomAd = sketchyAds[Math.floor(Math.random() * sketchyAds.length)];
        setPopupText(randomAd);
        setShowPopup(true);
        emit('popup_open', { delayedMs: delayMs });
      }, delayMs);
    }
    emit('load', { seed: currentSeed });
    return () => {
      if (delayedPopupTimer.current) window.clearTimeout(delayedPopupTimer.current);
    };
  }, []);

  function handleShuffleClick() {
    setShowShuffleConfirm(true);
  }

  function reshuffle() {
    // advance seed and navigate; UI will initialize from URL on navigation
    const nextSeed = (seed * 9301 + 49297) % 233280;
    setSeed(nextSeed);
    try { (window as any).__seed = nextSeed; } catch {}
    emit('shuffle', { seed: nextSeed });
    setShowShuffleConfirm(false);
    router.push(`/seed/${nextSeed}`);
  }

  function initFromSeed(currentSeed: number) {
    // Ensure required fields always present
    const required = ALL_FIELDS.filter(f => REQUIRED_ALWAYS.includes(f.key));
    const optionalPool = ALL_FIELDS.filter(f => !REQUIRED_ALWAYS.includes(f.key));
    const randomOptional = getRandomSubsetWithSeed(optionalPool, currentSeed);
    const combined = seededShuffle([...required, ...randomOptional], currentSeed);
    setVisibleFields(combined);
    const submitIdx = Math.floor(seededRandom(currentSeed) * (combined.length + 1));
    setSubmitPosition(submitIdx);
    // Reset state
    setErrors({});
    setValues({});
    // Theme/font deterministic by seed
    randomizeTheme(currentSeed);
  }

  function randomizeTheme(s?: number) {
    const r = s != null ? seededRandom(s) : Math.random();
    const theme = r < 0.5 ? 'theme-pill' : 'theme-boxy';
    const fonts = ['font-sans', 'font-serif', 'font-mono'] as const;
    const rf = s != null ? seededRandom(s + 1337) : Math.random();
    const font = fonts[Math.floor(rf * fonts.length) % fonts.length];
    setThemeClass(theme);
    setFontClass(font);
  }

  function onChange(key: FieldKey, v: string | string[] | boolean) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  function validateVisible(): { ok: boolean; errs: Errors } {
    const raw: any = {};
    for (const f of visibleFields) {
      const value = values[f.key];
      if (f.type === 'checkbox-group') {
        raw[f.key] = Array.isArray(value) && value.length > 0 ? value : undefined;
      } else if (f.type === 'checkbox') {
        raw[f.key] = typeof value === 'boolean' ? value : undefined;
      } else if (f.type === 'select') {
        raw[f.key] = value && typeof value === 'string' && value !== '' ? value : undefined;
      } else if (typeof value === 'string') {
        raw[f.key] = value === '' ? undefined : value;
      } else {
        raw[f.key] = value ?? undefined;
      }
    }
    const parsed = schema.safeParse(raw);
    if (parsed.success) return { ok: true, errs: {} };
    const fieldErrors: Errors = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as FieldKey | undefined;
      if (path) fieldErrors[path] = issue.message;
    }
    // Mark empty required visible fields as required
    for (const f of visibleFields) {
      if (!raw[f.key]) fieldErrors[f.key] = fieldErrors[f.key] || 'Required';
    }
    return { ok: false, errs: fieldErrors };
  }

  const isComplete = useMemo(() => {
    const res = validateVisible();
    return res.ok;
  }, [visibleFields, values]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = validateVisible();
    setErrors(res.errs);
    if (!res.ok) {
      alert('Please complete the visible required fields.');
      emit('validate_fail', { errors: res.errs });
      return;
    }
    try {
      const payload = {
        values,
        visibleKeys: visibleFields.map(f => f.key),
        submittedAt: new Date().toISOString(),
        sessionId,
        seed,
      };
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setShowSuccess(true);
      emit('submit_ok', { values: payload.values, visibleKeys: payload.visibleKeys });
    } catch (err) {
      console.error(err);
      setShowSuccess(true);
      emit('submit_fail', { message: (err as any)?.message || String(err) });
    }
  }

  const containers = useMemo(() => visibleFields.length + 1, [visibleFields.length]);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Left Sidebar - Sketchy Ads */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'linear-gradient(45deg, #ff0080, #ff8c00)', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', minHeight: 80 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎰💰</div>
          <div>WIN $10,000 NOW!</div>
          <div style={{ fontSize: 9, marginTop: 4 }}>Click here!!!</div>
        </div>
        <div style={{ background: '#ff0000', padding: 12, borderRadius: 4, border: '2px dashed #ffff00', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 140, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&h=140&fit=crop)', backgroundSize: 'cover', opacity: 0.2 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 18 }}>⚠️ VIRUS ALERT ⚠️</div>
            <div style={{ marginTop: 4 }}>Your computer has 37 viruses!</div>
            <div style={{ marginTop: 8 }}>Windows Defender has detected multiple threats on your system!</div>
            <div style={{ marginTop: 8, background: 'yellow', color: 'red', padding: 6, fontSize: 12 }}>CLEAN NOW</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(180deg, #00ff00, #008000)', padding: 12, borderRadius: 4, border: '3px solid #ffff00', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 100, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=100&fit=crop)', backgroundSize: 'cover', opacity: 0.3 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>💊 DOCTORS HATE HIM!</div>
            <div style={{ fontSize: 9, marginTop: 4 }}>Lose 50 lbs in 2 days with this one weird trick!</div>
          </div>
        </div>
        <div style={{ background: '#000', padding: 12, borderRadius: 4, border: '2px solid #ff0000', textAlign: 'center', color: '#0f0', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', minHeight: 90 }}>
          <div>🔒 DOWNLOAD NOW 🔒</div>
          <div style={{ marginTop: 4 }}>Free_Movie.exe</div>
          <div style={{ fontSize: 8, color: '#fff', marginTop: 4 }}>100% Safe & Legal</div>
          <div style={{ fontSize: 7, color: '#0f0', marginTop: 4 }}>No virus guaranteed*</div>
        </div>
        <div style={{ background: 'linear-gradient(45deg, #8b00ff, #ff00ff)', padding: 12, borderRadius: 4, border: '3px solid gold', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 280, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=200&h=280&fit=crop)', backgroundSize: 'cover', opacity: 0.25 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>👑</div>
            <div style={{ fontSize: 12, fontWeight: 'bold' }}>BE A PRINCE</div>
            <div style={{ fontSize: 9, marginTop: 6 }}>Nigerian prince needs YOUR help! $$$</div>
            <div style={{ fontSize: 8, marginTop: 8 }}>Transfer $500 today, get $5 MILLION back!</div>
            <div style={{ fontSize: 7, marginTop: 10, color: '#ffd700', lineHeight: 1.4 }}>URGENT: My father, the king, has left me $25 MILLION inheritance but I need your bank account to transfer funds!</div>
            <div style={{ fontSize: 7, marginTop: 8, color: '#ffeb3b' }}>I am Prince Abubakar from Nigeria. Due to political unrest, I cannot access my family fortune. Help me transfer it safely!</div>
            <div style={{ fontSize: 7, marginTop: 8, color: '#fff' }}>You will receive 40% commission - that's $10 MILLION USD!</div>
            <div style={{ fontSize: 8, marginTop: 10, background: 'gold', color: '#8b00ff', padding: 6, fontWeight: 'bold', borderRadius: 4 }}>RESPOND NOW!</div>
            <div style={{ fontSize: 6, marginTop: 6, color: '#ffd700' }}>Time sensitive! Act within 24 hours!</div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className={`${themeClass} ${fontClass}`} style={{ flex: 1, maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>A Typical Online Form</h1>
        <button
          onClick={handleShuffleClick}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            color: 'white',
            border: '3px solid #7f1d1d',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.5), inset 0 -2px 8px rgba(0,0,0,0.3)',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            position: 'relative',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.7), inset 0 -2px 8px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.5), inset 0 -2px 8px rgba(0,0,0,0.3)';
          }}
        >
          💀 SHUFFLE 💀
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            const fieldName = (target as HTMLInputElement).name || (target as HTMLInputElement).id || 'unknown';
            emit('field_click', { field: fieldName, tagName: target.tagName }, values);
          }
        }}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          const fieldName = target.name || target.id || 'unknown';
          emit('field_input', { field: fieldName, value: target.value }, values);
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {Array.from({ length: containers }, (_, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              {/* Left container: sometimes field */}
              <div style={{ flex: 1 }}>
                {visibleFields[idx] && (
                  <Field
                    config={visibleFields[idx]}
                    value={values[visibleFields[idx].key]}
                    error={errors[visibleFields[idx].key]}
                    onChange={onChange}
                  />
                )}
              </div>
              {/* Right container: submit may sit on the right per user preference */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
                {idx === submitPosition && (
                  <button
                    type="submit"
                    disabled={!isComplete}
                    className="primary"
                    style={{ cursor: isComplete ? 'pointer' : 'not-allowed', minWidth: 120 }}
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </form>

      {showPopup && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1001,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                background: 'linear-gradient(135deg, #ff0000 0%, #ff8c00 50%, #ffd700 100%)',
                padding: 4,
                borderRadius: 12,
                width: 400,
                boxShadow: '0 10px 24px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.6)',
                border: '3px solid #ffd700',
              }}
            >
              <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ color: '#ff0000', fontSize: 16, textTransform: 'uppercase' }}>⚠️ System Alert</strong>
                  <button
                    type="button"
                    onClick={() => { setShowPopup(false); emit('popup_close', {}); }}
                    style={{ background: '#ff0000', border: '2px solid #8b0000', cursor: 'pointer', fontSize: 18, color: 'white', width: 28, height: 28, borderRadius: 4, fontWeight: 'bold' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>{popupText}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowPopup(false); emit('popup_close', {}); }}
                    style={{
                      padding: '10px 24px',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #ff0000 0%, #ff6b00 100%)',
                      color: 'white',
                      border: '2px solid #8b0000',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      boxShadow: '0 4px 8px rgba(255,0,0,0.3)',
                    }}
                  >
                    OK - CLAIM NOW!
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showShuffleConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
          onClick={() => setShowShuffleConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
              padding: 32,
              borderRadius: 12,
              width: 480,
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(220, 38, 38, 0.6), 0 0 0 3px #dc2626',
              border: '2px solid #7f1d1d',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16 }}>💀⚠️💀</div>
            <h2 style={{ margin: '0 0 16px 0', color: '#dc2626', fontSize: 28, textTransform: 'uppercase', letterSpacing: '2px' }}>CRITICAL WARNING</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: 16, lineHeight: 1.6, color: '#e5e5e5' }}>
              Are you absolutely sure you want to shuffle?
            </p>
            <p style={{ margin: '0 0 24px 0', fontSize: 15, lineHeight: 1.6, color: '#fca5a5', fontWeight: 'bold' }}>
              All your progress will be <span style={{ color: '#dc2626', textDecoration: 'underline' }}>COMPLETELY ERASED</span> and this action will trigger an <span style={{ color: '#dc2626', textDecoration: 'underline' }}>AI APOCALYPSE</span>!
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowShuffleConfirm(false)}
                style={{
                  padding: '12px 24px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: '2px solid #15803d',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                  minWidth: 140,
                }}
              >
                Cancel (Safe)
              </button>
              <button
                onClick={reshuffle}
                style={{
                  padding: '12px 24px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
                  color: 'white',
                  border: '2px solid #450a0a',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.6)',
                  textTransform: 'uppercase',
                  minWidth: 140,
                }}
              >
                💀 Shuffle Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => setShowSuccess(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 12,
              width: 420,
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 12px 28px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                <circle cx="48" cy="48" r="46" fill="#22c55e" stroke="#16a34a" strokeWidth="4" />
                <path d="M30 49 L44 63 L68 37" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px 0' }}>Success</h2>
            <p style={{ margin: '0 0 16px 0' }}>Your form has been submitted.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setShowSuccess(false)} className="primary" style={{ minWidth: 120 }}>Close</button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Right Sidebar - More Sketchy Ads */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#ff1493', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', minHeight: 110, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=110&fit=crop)', backgroundSize: 'cover', opacity: 0.3, filter: 'blur(2px)' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>💻🔥</div>
            <div>HOT SINGLES IN YOUR AREA!</div>
            <div style={{ fontSize: 8, marginTop: 4 }}>Meet them tonight!</div>
            <div style={{ fontSize: 9, marginTop: 6, background: 'white', color: 'red', padding: 4 }}>CLICK NOW!!!</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(45deg, #ff6b00, #ffa500)', padding: 12, borderRadius: 4, border: '3px dashed #000', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 90 }}>
          <div>🎁 CONGRATULATIONS! 🎁</div>
          <div style={{ marginTop: 4 }}>You are visitor #1,000,000!</div>
          <div style={{ fontSize: 9, marginTop: 4, background: '#ff0000', padding: 4 }}>CLAIM PRIZE</div>
        </div>
        <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 4, border: '2px solid #ff0000', textAlign: 'center', color: '#00ff00', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', minHeight: 130, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&h=130&fit=crop)', backgroundSize: 'cover', opacity: 0.15 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>🎮 FREE GAME HACKS</div>
            <div style={{ marginTop: 4, color: '#ffff00' }}>Unlimited V-Bucks</div>
            <div style={{ fontSize: 8, color: '#fff', marginTop: 4 }}>No Survey Required!</div>
            <div style={{ fontSize: 7, color: '#0f0', marginTop: 6 }}>Works 100%! Download now!</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ff0000, #8b0000)', padding: 12, borderRadius: 4, border: '3px solid yellow', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 100, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=100&fit=crop)', backgroundSize: 'cover', opacity: 0.2 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>🚨 URGENT 🚨</div>
            <div style={{ marginTop: 4 }}>Your Social Security has been suspended!</div>
            <div style={{ fontSize: 9, marginTop: 4, background: 'yellow', color: 'red', padding: 4 }}>FIX NOW</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(45deg, #00bfff, #0080ff)', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 85 }}>
          <div>💰 WORK FROM HOME 💰</div>
          <div style={{ fontSize: 9, marginTop: 4 }}>Make $5000/day! No experience needed!</div>
        </div>
        <div style={{ background: '#ff4500', padding: 12, borderRadius: 4, border: '2px dashed #ffff00', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 120, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=200&h=120&fit=crop)', backgroundSize: 'cover', opacity: 0.25 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 18 }}>🎯</div>
            <div style={{ marginTop: 4 }}>Click to install browser extension!</div>
            <div style={{ fontSize: 8, marginTop: 6 }}>Speed up your browser 500%!</div>
            <div style={{ fontSize: 7, marginTop: 4 }}>Totally not malware</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ config, value, error, onChange }: { config: FieldConfig; value: string | string[] | boolean | undefined; error?: string; onChange: (key: FieldKey, v: string | string[] | boolean) => void }) {
  const common = (
    <label htmlFor={config.key} style={{ fontWeight: 600 }}>
      {config.label}
      {REQUIRED_ALWAYS.includes(config.key) ? ' *' : ''}
    </label>
  );

  let control: React.ReactNode = null;
  switch (config.type) {
    case 'text':
    case 'email':
    case 'tel':
      control = (
        <input
          id={config.key}
          type={config.type}
          placeholder={config.placeholder}
          value={(value as string) || ''}
          onChange={e => onChange(config.key, e.target.value)}
          style={{}}
        />
      );
      break;
    case 'textarea':
      control = (
        <textarea
          id={config.key}
          placeholder={config.placeholder}
          value={(value as string) || ''}
          onChange={e => onChange(config.key, e.target.value)}
          rows={4}
          style={{}}
        />
      );
      break;
    case 'select':
      control = (
        <select
          id={config.key}
          value={(value as string) ?? ''}
          onChange={e => onChange(config.key, e.target.value)}
        >
          {(config.options || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      break;
    case 'radio':
      control = (
        <div style={{ display: 'flex', gap: 12 }}>
          {(config.options || []).map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name={config.key}
                value={opt.value}
                checked={value === opt.value}
                onChange={e => onChange(config.key, e.target.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
      break;
    case 'checkbox-group':
      control = (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(config.options || []).map(opt => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(opt.value);
            return (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  name={config.key}
                  id={`${config.key}-${opt.value}`}
                  value={opt.value}
                  checked={checked}
                  onChange={e => {
                    const v = e.target.value;
                    const next = checked ? arr.filter(x => x !== v) : [...arr, v];
                    onChange(config.key, next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      );
      break;
    case 'checkbox':
      control = (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id={config.key}
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(config.key, e.target.checked)}
          />
          {config.label}
        </label>
      );
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {config.type !== 'checkbox' ? common : null}
      {control}
      {error && <span style={{ color: '#dc2626', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

// ----- Telemetry and seeded RNG helpers -----
function cryptoRandomId(): string {
  const a = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

function seededRandom(seed: number): number {
  // simple LCG
  const next = (seed * 1664525 + 1013904223) % 4294967296;
  return next / 4294967296;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 4294967296) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandomSubsetWithSeed<T>(arr: T[], seed: number): T[] {
  if (arr.length === 0) return [];
  const count = Math.max(1, Math.floor(seededRandom(seed) * arr.length));
  return seededShuffle(arr, seed).slice(0, count);
}

async function emit(event: string, data?: unknown, values?: Record<string, any>) {
  try {
    const timestamp = new Date().toISOString();

    const body = {
      event,
      data,
      userName: values?.name || (window as any).__userName || '',
      userEmail: values?.email || (window as any).__userEmail || '',
    } as any;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, timestamp, sessionId: (window as any).__sessionId || '', seed: (window as any).__seed ?? '' }),
      keepalive: true,
    });
  } catch {}
}


