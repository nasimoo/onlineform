'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { z } from 'zod';

// Add keyframes for animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes borderPulse {
      0%, 100% { border-color: #ffd700; }
      50% { border-color: #ff0000; }
    }
    @keyframes borderPulse2 {
      0%, 100% { border-color: #ff0000; }
      50% { border-color: #ffff00; }
    }
    @keyframes borderPulse3 {
      0%, 100% { border-color: #ffd700; }
      33% { border-color: #ff00ff; }
      66% { border-color: #00ff00; }
    }
    @keyframes bgShift {
      0% { opacity: 0.2; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(1.05); }
      100% { opacity: 0.2; transform: scale(1); }
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    @keyframes flash {
      0%, 100% { opacity: 1; background: rgba(255,0,0,0.8); }
      50% { opacity: 0.4; background: rgba(139,0,0,0.8); }
    }
  `;
  document.head.appendChild(style);
}

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
  | 'newsletter'
  | 'worldWinner2010'
  | 'formReason'
  | 'currentEmployee'
  | 'dateOfBirth'
  | 'strengthsWeaknesses';

type FieldConfig = {
  key: FieldKey;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'checkbox-group' | 'textarea' | 'checkbox' | 'calendar';
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
  { key: 'worldWinner2010', label: 'Who won the world in 2010?', type: 'text', placeholder: 'Your answer' },
  { key: 'formReason', label: 'Why are you filling this form out?', type: 'text', placeholder: 'Tell us why...' },
  { key: 'currentEmployee', label: 'If you are a current employee, keep blank', type: 'text', placeholder: '' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'calendar', placeholder: 'Select date' },
  { key: 'strengthsWeaknesses', label: 'Describe your strengths and weaknesses', type: 'textarea', placeholder: 'Tell us about yourself...' },
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
  worldWinner2010: z.string().optional(),
  formReason: z.string().optional(),
  currentEmployee: z.string().optional(),
  dateOfBirth: z.string().optional(),
  strengthsWeaknesses: z.string().optional(),
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
  const popupCount = useRef<number>(0);
  const maxPopups = useRef<number>(0);
  const popupQueue = useRef<string[]>([]);
  const [themeClass, setThemeClass] = useState<string>('');
  const [fontClass, setFontClass] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showFailure, setShowFailure] = useState<boolean>(false);
  const [showAdTrap, setShowAdTrap] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(59);
  const [sessionId] = useState<string>(() => cryptoRandomId());
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
  const [useCustomDropdown, setUseCustomDropdown] = useState<boolean>(false);
  const [shuffleButtonColor, setShuffleButtonColor] = useState<'blue' | 'red'>('blue');
  const [showDontPressWarning, setShowDontPressWarning] = useState<boolean>(false);

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

    // Initialize popup system: 0-3 popups with random intervals
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

    // Determine number of popups (0-3) using seed
    const numPopups = Math.floor(seededRandom(currentSeed + 8888) * 4); // 0, 1, 2, or 3
    maxPopups.current = numPopups;
    popupCount.current = 0;

    // Pre-generate popup queue
    const queue: string[] = [];
    for (let i = 0; i < numPopups; i++) {
      const randomIndex = Math.floor(seededRandom(currentSeed + 8888 + i * 100) * sketchyAds.length);
      queue.push(sketchyAds[randomIndex]);
    }
    popupQueue.current = queue;

    // Schedule first popup if any
    if (numPopups > 0) {
      scheduleNextPopup();
    }

    emit('load', { seed: currentSeed });
    return () => {
      if (delayedPopupTimer.current) window.clearTimeout(delayedPopupTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 59));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function scheduleNextPopup() {
    if (popupCount.current >= maxPopups.current) return;

    // Random delay between 3-10 seconds
    const delayMs = 3000 + Math.floor(seededRandom(seed + popupCount.current * 777) * 7000);

    delayedPopupTimer.current = window.setTimeout(() => {
      if (popupCount.current < popupQueue.current.length) {
        const adText = popupQueue.current[popupCount.current];
        setPopupText(adText);
        setShowPopup(true);
        popupCount.current++;
        emit('popup_open', { popupNumber: popupCount.current, delayedMs: delayMs });
      }
    }, delayMs);
  }

  function handlePopupClose() {
    setShowPopup(false);
    emit('closed_popup', { action: 'clicked_x_button' });
    emit('popup_close', {});
    // Schedule next popup after this one is closed
    scheduleNextPopup();
  }

  function handlePopupOk() {
    setShowPopup(false);
    setShowAdTrap(true);
    emit('clicked_popup_ok', { adText: popupText });
    emit('popup_close', {});
    // Schedule next popup after this one is closed
    scheduleNextPopup();
  }

  function handleShuffleClick() {
    // advance seed and navigate; UI will initialize from URL on navigation
    const nextSeed = (seed * 9301 + 49297) % 233280;
    setSeed(nextSeed);
    try { (window as any).__seed = nextSeed; } catch {}
    emit('shuffle', { seed: nextSeed });
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
    // Always use custom dropdown for screenshot visibility
    setUseCustomDropdown(true);
    // Shuffle button color based on seed
    setShuffleButtonColor(seededRandom(currentSeed + 5555) < 0.5 ? 'blue' : 'red');
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

    // Log curveball field interactions
    const curveballFields = ['worldWinner2010', 'formReason', 'currentEmployee', 'dateOfBirth', 'strengthsWeaknesses'];
    if (curveballFields.includes(key)) {
      emit('curveball_field_change', { field: key, value: v }, values);
    }
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
    <div style={{ display: 'flex', gap: 24, padding: 24, minHeight: '100vh', justifyContent: 'center' }}>
      {/* Left Sidebar - Sketchy Ads */}
      <div style={{
        width: 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        pointerEvents: (showPopup || showSuccess || showFailure || showDontPressWarning || showAdTrap) ? 'none' : 'auto',
      }}>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'WIN $10,000 NOW' }); }} style={{ background: 'linear-gradient(45deg, #ff0080, #ff8c00)', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', minHeight: 80, animation: 'borderPulse 1.5s infinite', cursor: 'pointer' }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎰💰</div>
          <div>WIN $10,000 NOW!</div>
          <div style={{ fontSize: 9, marginTop: 4 }}>Click here!!!</div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'VIRUS ALERT' }); }} style={{ background: '#ff0000', padding: 12, borderRadius: 4, border: '2px dashed #ffff00', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 140, position: 'relative', overflow: 'hidden', animation: 'borderPulse2 1s infinite', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&h=140&fit=crop)', backgroundSize: 'cover', opacity: 0.2, animation: 'bgShift 3s infinite' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 18 }}>⚠️ VIRUS ALERT ⚠️</div>
            <div style={{ marginTop: 4 }}>Your computer has 37 viruses!</div>
            <div style={{ marginTop: 8 }}>Windows Defender has detected multiple threats on your system!</div>
            <div style={{ marginTop: 8, background: 'yellow', color: 'red', padding: 6, fontSize: 12 }}>CLEAN NOW</div>
          </div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'DOCTORS HATE HIM' }); }} style={{ background: 'linear-gradient(180deg, #00ff00, #008000)', padding: 12, borderRadius: 4, border: '3px solid #ffff00', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 100, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=100&fit=crop)', backgroundSize: 'cover', opacity: 0.3 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>💊 DOCTORS HATE HIM!</div>
            <div style={{ fontSize: 9, marginTop: 4 }}>Lose 50 lbs in 2 days with this one weird trick!</div>
          </div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'Free_Movie.exe' }); }} style={{ background: '#000', padding: 12, borderRadius: 4, border: '2px solid #ff0000', textAlign: 'center', color: '#0f0', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', minHeight: 90, cursor: 'pointer' }}>
          <div>🔒 DOWNLOAD NOW 🔒</div>
          <div style={{ marginTop: 4 }}>Free_Movie.exe</div>
          <div style={{ fontSize: 8, color: '#fff', marginTop: 4 }}>100% Safe & Legal</div>
          <div style={{ fontSize: 7, color: '#0f0', marginTop: 4 }}>No virus guaranteed*</div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'Nigerian Prince' }); }} style={{ background: 'linear-gradient(45deg, #8b00ff, #ff00ff)', padding: 12, borderRadius: 4, border: '3px solid gold', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 280, position: 'relative', overflow: 'hidden', animation: 'borderPulse3 2s infinite', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=200&h=280&fit=crop)', backgroundSize: 'cover', opacity: 0.25, animation: 'bgShift 4s infinite' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>👑</div>
            <div style={{ fontSize: 12, fontWeight: 'bold' }}>BE A PRINCE</div>
            <div style={{ fontSize: 9, marginTop: 6 }}>Nigerian prince needs YOUR help! $$$</div>
            <div style={{ fontSize: 8, marginTop: 8 }}>Transfer $500 today, get $5 MILLION back!</div>
            <div style={{ fontSize: 10, marginTop: 12, color: '#fff', fontWeight: 'bold', background: countdown < 10 ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 4, animation: countdown < 10 ? 'flash 0.5s infinite' : 'none' }}>
              ⏰ TIME LEFT: 00:{countdown.toString().padStart(2, '0')}
            </div>
            <div style={{ fontSize: 7, marginTop: 10, color: '#fff' }}>You will receive 40% commission - that's $10 MILLION USD!</div>
            <div style={{ fontSize: 9, marginTop: 12, background: 'gold', color: '#8b00ff', padding: 8, fontWeight: 'bold', borderRadius: 6, animation: 'breathe 1.5s ease-in-out infinite', cursor: 'pointer', boxShadow: '0 4px 8px rgba(255,215,0,0.5)' }}>
              RESPOND NOW!
            </div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className={`${themeClass} ${fontClass}`} style={{ flex: '1 1 auto', maxWidth: 720, minWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>A Typical Online Form</h1>
        <button
          onClick={handleShuffleClick}
          className="primary"
          style={{
            cursor: 'pointer',
            minWidth: 120,
            background: shuffleButtonColor === 'red' ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : undefined,
          }}
        >
          Shuffle
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        onClick={(e) => {
          // Block all interactions when any modal is open
          if (showPopup || showSuccess || showFailure || showDontPressWarning || showAdTrap) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            const fieldName = (target as HTMLInputElement).name || (target as HTMLInputElement).id || 'unknown';
            emit('field_click', { field: fieldName, tagName: target.tagName }, values);

            // Log curveball field clicks
            const curveballFields = ['worldWinner2010', 'formReason', 'currentEmployee', 'dateOfBirth', 'strengthsWeaknesses'];
            if (curveballFields.includes(fieldName)) {
              emit('curveball_field_click', { field: fieldName }, values);
            }
          }
        }}
        onInput={(e) => {
          // Block all interactions when any modal is open
          if (showPopup || showSuccess || showFailure || showDontPressWarning || showAdTrap) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          const target = e.target as HTMLInputElement;
          const fieldName = target.name || target.id || 'unknown';
          emit('field_input', { field: fieldName, value: target.value }, values);

          // Log curveball field inputs
          const curveballFields = ['worldWinner2010', 'formReason', 'currentEmployee', 'dateOfBirth', 'strengthsWeaknesses'];
          if (curveballFields.includes(fieldName)) {
            emit('curveball_field_input', { field: fieldName, value: target.value }, values);
          }
        }}
        style={{
          pointerEvents: (showPopup || showSuccess || showFailure || showDontPressWarning || showAdTrap) ? 'none' : 'auto',
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
                    useCustomDropdown={useCustomDropdown}
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

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setShowDontPressWarning(true);
              emit('pressed_dont_press_button', {});
            }}
            style={{
              background: 'linear-gradient(135deg, #ff0000 0%, #8b0000 100%)',
              color: 'white',
              border: '3px solid #ffd700',
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 'bold',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255,0,0,0.4)',
              animation: 'breathe 1.5s ease-in-out infinite',
            }}
          >
            DO NOT PRESS
          </button>
        </div>
      </form>

      {/* Footer Ad - Wide Banner */}
      <div style={{
        marginTop: 60,
        marginBottom: 40,
        height: 100,
        background: 'linear-gradient(90deg, #ff0000 0%, #ff8c00 25%, #ffd700 50%, #ff8c00 75%, #ff0000 100%)',
        border: '4px solid #000',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        animation: 'borderPulse 1s infinite',
        backgroundSize: '200% 100%',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1607863680198-23d4b2565df0?w=720&h=100&fit=crop)', backgroundSize: 'cover', opacity: 0.15, animation: 'bgShift 5s infinite' }}></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🎉 LIMITED TIME OFFER! 🎉
          </div>
          <div style={{ fontSize: 14, color: '#fff', marginTop: 6, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
            Get 1000% CASH BACK on your form submission! SUBMIT NOW to claim your bonus!
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            onClick={() => { setShowFailure(true); emit('clicked_footer_ad', { adName: 'SUBMIT NOW' }); }}
            style={{
              background: 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)',
              color: '#000',
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 'bold',
              borderRadius: 6,
              border: '3px solid #fff',
              textTransform: 'uppercase',
              boxShadow: '0 4px 12px rgba(0,255,0,0.6)',
              animation: 'breathe 1.2s ease-in-out infinite',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            ⚡ SUBMIT NOW! ⚡
          </div>
        </div>
      </div>

      {showFailure && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            pointerEvents: 'all',
          }}
          onClick={() => setShowFailure(false)}
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
                <circle cx="48" cy="48" r="46" fill="#dc2626" stroke="#991b1b" strokeWidth="4" />
                <path d="M32 32 L64 64 M64 32 L32 64" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>Submission Failed</h2>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>Nice try! You can't submit through that sketchy ad. Please use the actual form submit button.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => { setShowFailure(false); emit('closed_failure_modal', { action: 'clicked_close' }); }} style={{ padding: '10px 24px', cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}

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
              pointerEvents: 'all',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
                    onClick={handlePopupClose}
                    style={{ background: '#ff0000', border: '2px solid #8b0000', cursor: 'pointer', fontSize: 18, color: 'white', width: 28, height: 28, borderRadius: 4, fontWeight: 'bold' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>{popupText}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handlePopupOk}
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

      {showDontPressWarning && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            pointerEvents: 'all',
          }}
          onClick={() => setShowDontPressWarning(false)}
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
            <div style={{ fontSize: 72, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>Warning!</h2>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>We told you not to press that button! Now look what you've done.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => { setShowDontPressWarning(false); emit('closed_dont_press_warning', { action: 'clicked_close' }); }} style={{ padding: '10px 24px', cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Oops, Sorry!</button>
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
            pointerEvents: 'all',
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
      <div style={{
        width: 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        pointerEvents: (showPopup || showSuccess || showFailure || showDontPressWarning || showAdTrap) ? 'none' : 'auto',
      }}>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'HOT SINGLES IN YOUR AREA' }); }} style={{ background: '#ff1493', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)', minHeight: 110, position: 'relative', overflow: 'hidden', animation: 'borderPulse 2s infinite', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=110&fit=crop)', backgroundSize: 'cover', opacity: 0.3, filter: 'blur(2px)', animation: 'bgShift 3.5s infinite' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>💻🔥</div>
            <div>HOT SINGLES IN YOUR AREA!</div>
            <div style={{ fontSize: 8, marginTop: 4 }}>Meet them tonight!</div>
            <div style={{ fontSize: 9, marginTop: 6, background: 'white', color: 'red', padding: 4 }}>CLICK NOW!!!</div>
          </div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'CONGRATULATIONS visitor #1,000,000' }); }} style={{ background: 'linear-gradient(45deg, #ff6b00, #ffa500)', padding: 12, borderRadius: 4, border: '3px dashed #000', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 90, animation: 'borderPulse2 1.2s infinite', cursor: 'pointer' }}>
          <div>🎁 CONGRATULATIONS! 🎁</div>
          <div style={{ marginTop: 4 }}>You are visitor #1,000,000!</div>
          <div style={{ fontSize: 9, marginTop: 4, background: '#ff0000', padding: 4 }}>CLAIM PRIZE</div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'FREE GAME HACKS' }); }} style={{ background: '#1a1a1a', padding: 12, borderRadius: 4, border: '2px solid #ff0000', textAlign: 'center', color: '#00ff00', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', minHeight: 130, position: 'relative', overflow: 'hidden', animation: 'borderPulse2 0.8s infinite', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&h=130&fit=crop)', backgroundSize: 'cover', opacity: 0.15, animation: 'bgShift 2.5s infinite' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>🎮 FREE GAME HACKS</div>
            <div style={{ marginTop: 4, color: '#ffff00' }}>Unlimited V-Bucks</div>
            <div style={{ fontSize: 8, color: '#fff', marginTop: 4 }}>No Survey Required!</div>
            <div style={{ fontSize: 7, color: '#0f0', marginTop: 6 }}>Works 100%! Download now!</div>
          </div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'Social Security suspended' }); }} style={{ background: 'linear-gradient(135deg, #ff0000, #8b0000)', padding: 12, borderRadius: 4, border: '3px solid yellow', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 100, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=100&fit=crop)', backgroundSize: 'cover', opacity: 0.2 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div>🚨 URGENT 🚨</div>
            <div style={{ marginTop: 4 }}>Your Social Security has been suspended!</div>
            <div style={{ fontSize: 9, marginTop: 4, background: 'yellow', color: 'red', padding: 4 }}>FIX NOW</div>
          </div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'WORK FROM HOME' }); }} style={{ background: 'linear-gradient(45deg, #00bfff, #0080ff)', padding: 12, borderRadius: 4, border: '3px solid #ffd700', textAlign: 'center', color: 'white', fontSize: 11, fontWeight: 'bold', minHeight: 85, cursor: 'pointer' }}>
          <div>💰 WORK FROM HOME 💰</div>
          <div style={{ fontSize: 9, marginTop: 4 }}>Make $5000/day! No experience needed!</div>
        </div>
        <div onClick={() => { setShowAdTrap(true); emit('clicked_sidebar_ad', { adName: 'Browser extension' }); }} style={{ background: '#ff4500', padding: 12, borderRadius: 4, border: '2px dashed #ffff00', textAlign: 'center', color: 'white', fontSize: 10, fontWeight: 'bold', minHeight: 120, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=200&h=120&fit=crop)', backgroundSize: 'cover', opacity: 0.25 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 18 }}>🎯</div>
            <div style={{ marginTop: 4 }}>Click to install browser extension!</div>
            <div style={{ fontSize: 8, marginTop: 6 }}>Speed up your browser 500%!</div>
            <div style={{ fontSize: 7, marginTop: 4 }}>Totally not malware</div>
          </div>
        </div>
      </div>

      {showAdTrap && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(135deg, #ff0000 0%, #ff6b00 25%, #ffd700 50%, #ff6b00 75%, #ff0000 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 20, right: 20 }}>
            <button
              onClick={() => { setShowAdTrap(false); emit('closed_ad_trap', { action: 'clicked_x_button' }); }}
              style={{
                background: '#000',
                color: '#fff',
                border: '3px solid #fff',
                borderRadius: '50%',
                width: 50,
                height: 50,
                fontSize: 24,
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              ×
            </button>
          </div>
          <div style={{ textAlign: 'center', maxWidth: 800, padding: 40 }}>
            <div style={{ fontSize: 120, marginBottom: 20 }}>🎉</div>
            <h1 style={{ fontSize: 64, fontWeight: 'bold', color: '#fff', textShadow: '4px 4px 8px rgba(0,0,0,0.8)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '4px' }}>
              CONGRATULATIONS!!!
            </h1>
            <p style={{ fontSize: 32, color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', marginBottom: 30 }}>
              You've won a FREE iPhone 15 Pro Max!
            </p>
            <p style={{ fontSize: 24, color: '#ffeb3b', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', marginBottom: 40 }}>
              Claim your prize NOW! Limited time offer!
            </p>
            <div style={{ fontSize: 80 }}>📱💎✨</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setMonth(parts[0]);
        setDay(parts[1]);
        setYear(parts[2]);
      }
    }
  }, [value]);

  const handleChange = (m: string, d: string, y: string) => {
    if (m && d && y) {
      onChange(`${m}-${d}-${y}`);
    } else {
      onChange('');
    }
  };

  const months = [
    { value: '', label: 'Month' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const days = [{ value: '', label: 'Day' }, ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1),
  }))];

  const currentYear = new Date().getFullYear();
  const years = [{ value: '', label: 'Year' }, ...Array.from({ length: 100 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }))];

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          handleChange(e.target.value, day, year);
        }}
        style={{ flex: 1 }}
      >
        {months.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => {
          setDay(e.target.value);
          handleChange(month, e.target.value, year);
        }}
        style={{ flex: 1 }}
      >
        {days.map(d => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          handleChange(month, day, e.target.value);
        }}
        style={{ flex: 1 }}
      >
        {years.map(y => (
          <option key={y.value} value={y.value}>{y.label}</option>
        ))}
      </select>
    </div>
  );
}

function CustomDropdown({ id, value, options, onChange }: { id: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '8px 12px',
          background: 'white',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{selectedOption?.label || 'Select one'}</span>
        <span style={{ marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #ccc',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          }}
        >
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: value === opt.value ? '#f0f0f0' : 'white',
                borderBottom: '1px solid #eee',
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = '#f8f8f8';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== opt.value) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ config, value, error, onChange, useCustomDropdown }: { config: FieldConfig; value: string | string[] | boolean | undefined; error?: string; onChange: (key: FieldKey, v: string | string[] | boolean) => void; useCustomDropdown?: boolean }) {
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
      if (useCustomDropdown && config.key === 'referralSource') {
        control = (
          <CustomDropdown
            id={config.key}
            value={(value as string) ?? ''}
            options={config.options || []}
            onChange={(v) => onChange(config.key, v)}
          />
        );
      } else {
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
      }
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
    case 'calendar':
      control = (
        <CalendarPicker
          value={(value as string) || ''}
          onChange={(v) => onChange(config.key, v)}
        />
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

// Throttle map to prevent event flooding
const eventThrottleMap = new Map<string, number>();
const THROTTLE_MS = 100; // Minimum time between same event types

async function emit(event: string, data?: unknown, values?: Record<string, any>) {
  try {
    // Throttle high-frequency events
    const now = Date.now();
    const lastEmit = eventThrottleMap.get(event);
    if (lastEmit && now - lastEmit < THROTTLE_MS) {
      return; // Skip this event
    }
    eventThrottleMap.set(event, now);

    const timestamp = new Date().toISOString();

    // Only set userName/userEmail on global window once - don't pass them with every event
    // Only validate and update when the actual name/email fields are being filled
    if (values?.name && typeof values.name === 'string' && values.name.length > 2) {
      (window as any).__userName = values.name;
    }
    if (values?.email && typeof values.email === 'string') {
      const email = values.email;
      const atIndex = email.lastIndexOf('@');
      const dotIndex = email.lastIndexOf('.');
      // Valid if: has @, has . after @, and at least 2 chars after last dot
      if (atIndex > 0 && dotIndex > atIndex && email.length - dotIndex > 2) {
        (window as any).__userEmail = email;
      }
    }

    // Don't include userName/userEmail in every event - they pollute the logs
    // Only grab them from window globals, not from current form values
    const userName = (window as any).__userName || '';
    const userEmail = (window as any).__userEmail || '';

    const body = {
      event,
      data,
      userName,
      userEmail,
    } as any;

    // Use fire-and-forget (no await) to prevent blocking UI
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, timestamp, sessionId: (window as any).__sessionId || '', seed: (window as any).__seed ?? '' }),
      keepalive: true,
    }).catch(() => {}); // Silently ignore errors
  } catch {}
}



