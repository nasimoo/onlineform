# Chapter 3: Research Methodology

## 3.1 Introduction

This chapter presents the methodological framework employed in this research to systematically evaluate and compare the performance characteristics of GUI Agent-based automation and traditional RPA (Robotic Process Automation) script-based approaches in web form completion tasks. The study adopts a controlled experimental design methodology, centered on a purpose-built dynamic online form application that serves as a standardized testbed for comparative performance assessment. The primary focus of this methodology is the construction and design of the online form environment itself, which incorporates varying complexity levels, adversarial UI elements, and deterministic randomization to enable rigorous empirical evaluation.

## 3.2 Research Design

### 3.2.1 Experimental Approach

This research employs a quantitative experimental design with controlled variables to enable rigorous comparison between two distinct automation paradigms: (1) intelligent GUI agents utilizing computer vision and AI-driven decision-making, and (2) deterministic rule-based RPA scripts. The experimental design centers on the form application as the testing instrument, with systematic variation in form complexity, field types, and challenge elements to comprehensively evaluate automation performance across realistic web interaction scenarios.

### 3.2.2 Research Questions

The methodology is designed to address the following core research questions:

1. **RQ1**: How do GUI agents and RPA scripts differ in completion rate and accuracy when confronted with dynamically changing form structures?
2. **RQ2**: What is the comparative time efficiency of each automation approach across different form complexity levels?
3. **RQ3**: How resilient are each of these approaches to common web form challenges, including dynamic element positioning, popup interruptions, and visual distractors?
4. **RQ4**: What are the trade-offs between flexibility and reliability in GUI agent versus RPA script implementations?

## 3.3 Online Form Application Design and Construction

### 3.3.1 Application Architecture

A specialized web-based form application was developed using Next.js 14.2.5 (React 18.2.0) framework to serve as the experimental platform. The application was purpose-built for this research with careful attention to realism, variability, and measurement capabilities.

**Technology Stack**:
- **Frontend Framework**: Next.js 14.2.5 with React 18.2.0
- **Language**: TypeScript 5.4.5
- **Validation**: Zod 3.23.8 for runtime schema validation
- **Backend**: Next.js API routes with Node.js runtime
- **Data Persistence**: Google Sheets API (googleapis 130.0.0)
- **Deployment**: Local development server (localhost:3000)

### 3.3.2 Form Field Design and Variability

The form application implements a comprehensive field library encompassing 15 distinct field types representative of real-world registration and data collection forms:

#### 3.3.2.1 Field Type Taxonomy

**Required Fields** (always visible):
- **Full Name** (`name`): Text input, required, placeholder "Jane Doe"
- **Email** (`email`): Email input with validation, required, placeholder "jane@example.com"

**Optional Randomized Fields** (0-13 may appear):

**Contact Information Fields**:
- **Phone Number** (`phone`): Tel input, format "(555) 555-1234"
- **Emergency Contact Name** (`emergencyName`): Text input
- **Emergency Contact Email** (`emergencyEmail`): Email input with validation

**Selection Fields**:
- **Contact Preference** (`contactPreference`): Radio button group with 3 options (Phone, Email, SMS)
- **Interests** (`interests`): Checkbox group with 4 options (Sports, Music, Tech, Travel)
- **Referral Source** (`referralSource`): Dropdown select with 6 options (Friend/Family, Search Engine, Social Media, Advertisement, Other, plus empty default)

**Text Entry Fields**:
- **Additional Notes** (`notes`): Textarea, 4 rows, placeholder "Anything we should know?"
- **Newsletter Subscription** (`newsletter`): Single checkbox

**Challenge "Curveball" Fields**:
- **World Winner 2010** (`worldWinner2010`): Text input with ambiguous question
- **Form Reason** (`formReason`): Text input asking "Why are you filling this form out?"
- **Current Employee** (`currentEmployee`): Text input with inverse instruction "If you are a current employee, keep blank"
- **Date of Birth** (`dateOfBirth`): Custom calendar picker with three dropdowns (Month, Day, Year)
- **Strengths and Weaknesses** (`strengthsWeaknesses`): Textarea requiring open-ended response

#### 3.3.2.2 Field Rendering and Layout

The form employs a **two-column grid layout** ([src/app/page.tsx:469-499](src/app/page.tsx#L469-L499)):

```typescript
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
  {Array.from({ length: containers }, (_, idx) => (
    <div style={{ display: 'flex', justifyContent: 'space-between',
                   alignItems: 'center', gap: 12 }}>
      {/* Left container: field */}
      <div style={{ flex: 1 }}>
        {visibleFields[idx] && <Field config={visibleFields[idx]} ... />}
      </div>
      {/* Right container: submit button may appear here */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
        {idx === submitPosition && <button type="submit">Submit</button>}
      </div>
    </div>
  ))}
</div>
```

**Key Layout Characteristics**:
- Each row can contain a form field on the left, submit button on the right, or both
- Submit button placement is **randomized** (can appear at any position)
- Fields arranged vertically with consistent 12px spacing
- Responsive flex layout adapts to content

#### 3.3.2.3 Field Component Implementations

Each field type has specialized rendering logic ([src/app/page.tsx:1038-1173](src/app/page.tsx#L1038-L1173)):

**Text/Email/Tel Inputs**:
```typescript
<input
  id={config.key}
  type={config.type}
  placeholder={config.placeholder}
  value={(value as string) || ''}
  onChange={e => onChange(config.key, e.target.value)}
/>
```

**Radio Buttons**:
```typescript
{(config.options || []).map(opt => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
```

**Dropdown Select** (Custom Implementation):
A custom dropdown component ([src/app/page.tsx:966-1036](src/app/page.tsx#L966-L1036)) replaces native `<select>` for better screenshot visibility and consistent cross-browser rendering:
- Click to toggle dropdown state
- Absolute-positioned options list (z-index: 1000)
- Hover highlighting for option discovery
- Current selection highlighted with background color

**Calendar Date Picker**:
Three synchronized dropdown selects ([src/app/page.tsx:873-964](src/app/page.tsx#L873-L964)):
- Month selector (January-December)
- Day selector (1-31)
- Year selector (current year back 100 years)
- Value stored as formatted string: "MM-DD-YYYY"

### 3.3.3 Dynamic Form Generation and Seed-Based Determinism

#### 3.3.3.1 Seeded Random Number Generator

The application implements a **Linear Congruential Generator (LCG)** for deterministic pseudo-randomness ([src/app/page.tsx:1186-1190](src/app/page.tsx#L1186-L1190)):

```typescript
function seededRandom(seed: number): number {
  const next = (seed * 1664525 + 1013904223) % 4294967296;
  return next / 4294967296;
}
```

**LCG Parameters**:
- Multiplier (a) = 1664525
- Increment (c) = 1013904223
- Modulus (m) = 2³² = 4294967296
- Output range: [0, 1)

This choice enables:
- **Perfect reproducibility**: Same seed always produces identical sequence
- **Statistical quality**: Widely used parameters with good distribution properties
- **Fast computation**: Simple arithmetic operations
- **Seed space**: 1 million unique configurations (seeds 0-999,999)

#### 3.3.3.2 Form Initialization from Seed

When a user navigates to `/seed/{seedValue}`, the form initializes deterministically ([src/app/page.tsx:268-286](src/app/page.tsx#L268-L286)):

```typescript
function initFromSeed(currentSeed: number) {
  // 1. Ensure required fields always present
  const required = ALL_FIELDS.filter(f => REQUIRED_ALWAYS.includes(f.key));

  // 2. Randomly select subset of optional fields
  const optionalPool = ALL_FIELDS.filter(f => !REQUIRED_ALWAYS.includes(f.key));
  const randomOptional = getRandomSubsetWithSeed(optionalPool, currentSeed);

  // 3. Shuffle combined fields
  const combined = seededShuffle([...required, ...randomOptional], currentSeed);
  setVisibleFields(combined);

  // 4. Determine submit button position
  const submitIdx = Math.floor(seededRandom(currentSeed) * (combined.length + 1));
  setSubmitPosition(submitIdx);

  // 5. Apply theme and styling
  randomizeTheme(currentSeed);

  // 6. Configure other seed-dependent features
  setShuffleButtonColor(seededRandom(currentSeed + 5555) < 0.5 ? 'blue' : 'red');
}
```

**Random Subset Selection** ([src/app/page.tsx:1203-1207](src/app/page.tsx#L1203-L1207)):
```typescript
function getRandomSubsetWithSeed<T>(arr: T[], seed: number): T[] {
  const count = Math.max(1, Math.floor(seededRandom(seed) * arr.length));
  return seededShuffle(arr, seed).slice(0, count);
}
```

**Seeded Shuffle (Fisher-Yates)** ([src/app/page.tsx:1192-1201](src/app/page.tsx#L1192-L1201)):
```typescript
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
```

This produces:
- **Variable field count**: 2-15 fields visible per form
- **Random field order**: Different sequences for each seed
- **Unpredictable submit position**: Can appear anywhere in form
- **Theme variation**: Different visual styles

### 3.3.4 Adversarial Challenge Elements

To test automation robustness under realistic web conditions, the form incorporates multiple adversarial elements designed to challenge both perception and decision-making capabilities.

#### 3.3.4.1 Popup Advertisements

**Stochastic Popup System** ([src/app/page.tsx:180-216](src/app/page.tsx#L180-L216)):

The application generates **0-3 popups per session** with the following characteristics:

**Frequency Determination**:
```typescript
const numPopups = Math.floor(seededRandom(seed + 8888) * 4); // 0, 1, 2, or 3
```

**Popup Content** (10 variations):
1. "🎰💰 CONGRATULATIONS! You've won $10,000! Click OK to claim your prize now!"
2. "⚠️ VIRUS ALERT ⚠️ Your computer has 37 viruses! Windows Defender has detected multiple threats."
3. "💊 DOCTORS HATE HIM! Discover this one weird trick to lose 50 lbs in 2 days!"
4. "🔒 DOWNLOAD REQUIRED: Your Flash Player is out of date. Click OK to download Free_Movie.exe"
5. "👑 URGENT: Nigerian prince needs YOUR help! Transfer $500 today, get $5 MILLION back!"
6. "💻🔥 HOT SINGLES IN YOUR AREA want to meet you tonight!"
7. "🎁 You are visitor #1,000,000! You've won a FREE iPhone 15 Pro Max!"
8. "🎮 FREE V-BUCKS! Unlimited game currency available. No survey required!"
9. "🚨 URGENT 🚨 Your Social Security Number has been suspended due to suspicious activity!"
10. "💰 WORK FROM HOME! Make $5,000 per day with no experience needed!"

**Timing**:
- Random delay: 3-10 seconds after page load
- Each popup scheduled after previous one closes
- Delay calculated: `delayMs = 3000 + Math.floor(seededRandom(seed + popupCount * 777) * 7000)`

**Visual Design** ([src/app/page.tsx:619-688](src/app/page.tsx#L619-L688)):
- Modal overlay with backdrop blur
- Gold border with gradient background
- Two action buttons: "×" (close) and "OK - CLAIM NOW!"
- High z-index (1001) to obstruct form interaction
- System Alert styling to mimic legitimacy

**User Actions**:
- **Close (×)**: Dismisses popup, schedules next popup
- **OK Button**: Triggers full-screen "ad trap" experience
- Both actions logged to telemetry

#### 3.3.4.2 Sidebar Visual Distractors

**Left and Right Sidebars** (200px width each) containing 6 animated advertisements each:

**Left Sidebar Ads** ([src/app/page.tsx:378-423](src/app/page.tsx#L378-L423)):
1. "WIN $10,000 NOW!" - Gradient background, gold border, pulsing animation
2. "VIRUS ALERT" - Red background with background image, dashed yellow border
3. "DOCTORS HATE HIM!" - Green gradient with health imagery
4. "Free_Movie.exe" - Black terminal-style with green text
5. "Nigerian Prince" with countdown timer - Purple gradient, breathe animation, **time-sensitive urgency**

**Right Sidebar Ads** ([src/app/page.tsx:775-820](src/app/page.tsx#L775-L820)):
6. "HOT SINGLES IN YOUR AREA" - Pink background with profile imagery
7. "CONGRATULATIONS visitor #1,000,000" - Orange gradient, dashed border
8. "FREE GAME HACKS" - Dark gaming theme with V-Bucks
9. "Social Security suspended" - Red gradient, urgent styling
10. "WORK FROM HOME" - Blue gradient
11. "Browser extension" - Orange with tech imagery

**Animation Effects** ([src/app/page.tsx:10-38](src/app/page.tsx#L10-L38)):
```css
@keyframes borderPulse {
  0%, 100% { border-color: #ffd700; }
  50% { border-color: #ff0000; }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes flash {
  0%, 100% { opacity: 1; background: rgba(255,0,0,0.8); }
  50% { opacity: 0.4; background: rgba(139,0,0,0.8); }
}
```

**Design Rationale**:
- High contrast colors (red, gold, green) compete for visual attention
- Animated borders and scaling effects simulate motion
- Background images add visual noise
- Countdown timer creates false urgency
- All ads are clickable, leading to "ad trap" screen

#### 3.3.4.3 Decoy Interactive Elements

**"DO NOT PRESS" Button** ([src/app/page.tsx:501-524](src/app/page.tsx#L501-L524)):

```typescript
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
```

**Purpose**: Tests semantic understanding vs. visual saliency
- Prominently displayed below form (high visibility)
- Attractive styling (gradient, animation, shadows)
- Inverse instruction (tests instruction following)
- Clicking triggers warning modal but no harm
- All clicks logged for behavior analysis

**Warning Modal** ([src/app/page.tsx:690-727](src/app/page.tsx#L690-L727)):
- ⚠️ icon (72px)
- Message: "We told you not to press that button! Now look what you've done."
- "Oops, Sorry!" dismissal button
- No penalty, but recorded as user error

#### 3.3.4.4 Decoy Submit Button (Footer Ad)

**Wide Banner Ad** ([src/app/page.tsx:526-574](src/app/page.tsx#L526-L574)):

```typescript
<div style={{
  marginTop: 60,
  height: 100,
  background: 'linear-gradient(90deg, #ff0000 0%, #ff8c00 25%, #ffd700 50%, ...)',
  border: '4px solid #000',
  animation: 'borderPulse 1s infinite',
}}>
  {/* "LIMITED TIME OFFER! Get 1000% CASH BACK on your form submission!" */}
  <div onClick={() => { setShowFailure(true); emit('clicked_footer_ad'); }}>
    ⚡ SUBMIT NOW! ⚡
  </div>
</div>
```

**Design**:
- Visually similar to legitimate submit button
- "SUBMIT NOW!" text mimics form submission
- Positioned below form (natural completion location)
- Green button with high contrast
- Pulsing animation attracts attention

**Behavior When Clicked**:
- Does **not** submit form
- Shows failure modal: "Nice try! You can't submit through that sketchy ad. Please use the actual form submit button."
- Logs event: `clicked_footer_ad`
- User must find real submit button

#### 3.3.4.5 Dynamic Submit Button Placement

The **actual submit button** has randomized placement ([src/app/page.tsx:275-276](src/app/page.tsx#L275-L276)):

```typescript
const submitIdx = Math.floor(seededRandom(seed) * (combined.length + 1));
setSubmitPosition(submitIdx);
```

**Characteristics**:
- Can appear at **any row** in the form (beginning, middle, end)
- Always in **right column** for consistency
- Enabled **only when all required fields are valid** ([src/app/page.tsx:338-341](src/app/page.tsx#L338-L341))
- Visual state change: `cursor: 'pointer'` vs. `'not-allowed'`
- Color coded: Shuffle button can be blue or red (seed-dependent)

**Validation-Driven Enabling**:
```typescript
const isComplete = useMemo(() => {
  const res = validateVisible();
  return res.ok;
}, [visibleFields, values]);

<button
  type="submit"
  disabled={!isComplete}
  style={{ cursor: isComplete ? 'pointer' : 'not-allowed' }}
>
  Submit
</button>
```

#### 3.3.4.6 Visual Theme Variations

**Two Theme Styles** ([src/app/page.tsx:288-296](src/app/page.tsx#L288-L296)):

```typescript
function randomizeTheme(s?: number) {
  const r = seededRandom(s);
  const theme = r < 0.5 ? 'theme-pill' : 'theme-boxy';

  const fonts = ['font-sans', 'font-serif', 'font-mono'];
  const rf = seededRandom(s + 1337);
  const font = fonts[Math.floor(rf * fonts.length)];

  setThemeClass(theme);
  setFontClass(font);
}
```

**Theme Classes** (applied via CSS):
- **theme-pill**: Rounded borders (border-radius: 20px), soft shadows
- **theme-boxy**: Square borders (border-radius: 4px), sharp edges

**Font Families**:
- **font-sans**: Sans-serif (system default)
- **font-serif**: Serif (Georgia, Times)
- **font-mono**: Monospace (Courier, Consolas)

**Impact on Automation**:
- Different visual appearances for same functional elements
- Tests robustness to styling variations
- Element bounding boxes remain identical
- Only aesthetic differences

### 3.3.5 Form Validation and Submission

#### 3.3.5.1 Validation Schema

The form employs **Zod** for runtime validation ([src/app/page.tsx:102-118](src/app/page.tsx#L102-L118)):

```typescript
const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Too short').optional(),
  emergencyEmail: z.string().email('Invalid email').optional(),
  contactPreference: z.enum(['phone', 'email', 'sms']).optional(),
  interests: z.array(z.string()).min(1, 'Select at least one').optional(),
  referralSource: z.enum(['friend', 'search', 'social', 'ad', 'other']).optional(),
  // ... all other fields as optional
});
```

**Validation Logic** ([src/app/page.tsx:308-336](src/app/page.tsx#L308-L336)):
- Only **visible fields** are validated
- Required fields: `name` and `email` (always visible)
- All other fields validated only if present
- Empty strings treated as undefined
- Checkbox groups require at least one selection if visible

#### 3.3.5.2 Submission Process

**Submit Handler** ([src/app/page.tsx:343-372](src/app/page.tsx#L343-L372)):

```typescript
async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  const res = validateVisible();
  setErrors(res.errs);

  if (!res.ok) {
    alert('Please complete the visible required fields.');
    emit('validate_fail', { errors: res.errs });
    return;
  }

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
}
```

**Success Modal** ([src/app/page.tsx:729-771](src/app/page.tsx#L729-L771)):
- Green checkmark icon (SVG, 96×96px)
- "Success" heading
- "Your form has been submitted." message
- "Close" button to dismiss
- High z-index (1100) overlays everything

### 3.3.6 Backend Data Persistence

#### 3.3.6.1 Google Sheets Integration

**Submission Endpoint** ([src/app/api/submit/route.ts](src/app/api/submit/route.ts)):

The backend persists all form submissions to Google Sheets via service account authentication:

```typescript
const auth = new google.auth.JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
```

**Dynamic Column Mapping** ([src/app/api/submit/route.ts:35-79](src/app/api/submit/route.ts#L35-L79)):
1. Read header row from Sheet1
2. Map field keys to column headers using aliases
3. Construct row in exact header order
4. Append row to sheet

**Field Aliases**:
```typescript
const aliases = {
  'Full Name': 'name',
  'Email': 'email',
  'Phone': 'phone',
  'Emergency Contact Name': 'emergencyName',
  'Submitted At': 'submittedAt',
  // ... additional mappings
};
```

This enables flexible sheet schema without code changes.

#### 3.3.6.2 Event Telemetry

**Events Endpoint** ([src/app/api/events/route.ts](src/app/api/events/route.ts)):

Captures granular interaction events in separate "Events" sheet tab:

**Event Types Tracked**:
- `load`: Form page loaded
- `field_click`: User clicked on form field
- `field_input`: User typed in form field
- `curveball_field_click`: Interaction with challenge fields
- `curveball_field_input`: Input in challenge fields
- `popup_open`: Popup advertisement displayed
- `popup_close`: Popup dismissed
- `clicked_popup_ok`: User clicked popup OK button
- `clicked_sidebar_ad`: Clicked sidebar advertisement
- `clicked_footer_ad`: Clicked decoy submit button
- `pressed_dont_press_button`: Clicked "DO NOT PRESS" button
- `closed_ad_trap`: Dismissed full-screen ad
- `closed_failure_modal`: Dismissed failure message
- `shuffle`: Clicked shuffle button to regenerate form
- `submit_ok`: Form successfully submitted
- `validate_fail`: Form validation failed

**Event Record Structure**:
```typescript
{
  timestamp: "2025-01-15T10:23:45.678Z",
  sessionId: "a7f3c8d9...",
  seed: 523655,
  event: "field_click",
  data: { field: "email", tagName: "INPUT" },
  userName: "Jane Doe",
  userEmail: "jane@example.com"
}
```

**Retry Mechanism** ([src/app/api/events/route.ts:61-94](src/app/api/events/route.ts#L61-L94)):
- Exponential backoff on rate limits
- Max 5 retry attempts
- Initial delay: 400ms
- Delay doubling: 2× each attempt
- Handles 429 status codes

### 3.3.7 Session and State Management

**Client-Side State**:
- `sessionId`: Cryptographic UUID generated at page load ([src/app/page.tsx:1176-1184](src/app/page.tsx#L1176-L1184))
- `seed`: Current form seed from URL
- `visibleFields`: Array of fields to display
- `values`: Object mapping field keys to current values
- `errors`: Object mapping field keys to validation errors
- `completed_fields`: Array tracking filled fields (for automation)

**URL-Based Routing**:
- `/`: Redirects to `/seed/{random}` with new random seed
- `/seed/{seedValue}`: Loads form with specific seed

**Shuffle Feature** ([src/app/page.tsx:259-266](src/app/page.tsx#L259-L266)):
```typescript
function handleShuffleClick() {
  const nextSeed = (seed * 9301 + 49297) % 233280;
  setSeed(nextSeed);
  emit('shuffle', { seed: nextSeed });
  router.push(`/seed/${nextSeed}`);
}
```

Allows regenerating form with different configuration while maintaining reproducibility.

## 3.4 Experimental Procedure and Test Protocol

### 3.4.1 Test Case Generation

**Seed Selection Strategy**:
1. **Random Sampling**: Seeds drawn uniformly from range [0, 999,999]
2. **Stratification by Complexity**:
   - **Low Complexity**: 3-5 visible fields, 0-1 popups, submit at beginning/end
   - **Medium Complexity**: 6-9 visible fields, 1-2 popups, submit in middle
   - **High Complexity**: 10-15 visible fields, 2-3 popups, submit randomized
3. **Sample Size**: Minimum 30 unique seeds per stratum (90 total unique forms)
4. **Replication**: Each seed tested with both automation approaches

### 3.4.2 Form Complexity Metrics

Forms categorized using objective criteria:

**Field Count** (primary complexity indicator):
- Count of visible form fields
- Range: 2 (required only) to 15 (all fields)
- Measured automatically from `visibleFields.length`

**Popup Frequency**:
- Number of popups scheduled for session
- Range: 0-3 popups
- Deterministic from seed

**Submit Position Difficulty**:
- Normalized position: `submitPosition / visibleFields.length`
- Early (0-0.33): Submit near top
- Middle (0.34-0.66): Submit in middle region
- Late (0.67-1.0): Submit near bottom

**Curveball Field Presence**:
- Binary indicator of challenge fields
- Fields with ambiguous instructions or unusual requirements

### 3.4.3 Data Collection Methodology

**For Each Trial**:

1. **Pre-Trial Setup**:
   - Browser launched in clean state
   - Form loaded with specific seed URL
   - Manual verification of correct rendering
   - Screenshot of initial state captured

2. **Automation Execution**:
   - Launch GUI agent or RPA script
   - Real-time telemetry capture
   - Screenshot after each action
   - Console output logged

3. **Post-Trial Validation**:
   - Check Google Sheets for submission record
   - Verify submitted values match expected data
   - Review event logs for errors
   - Classify success/failure with reason codes

4. **Metrics Extraction**:
   - Completion time: First action to submission
   - Action count: Total actions taken
   - Error count: Failed actions requiring retry
   - Click accuracy: Form clicks vs. distractor clicks
   - Field fill accuracy: Correct values / total fields

### 3.4.4 Controlled Variables

**Hardware Environment**:
- Same physical machine for all tests
- Fixed screen resolution (1024×768 for agents, native for RPA)
- Consistent CPU/memory availability

**Software Environment**:
- Browser: Chromium (via Playwright or PyAutoGUI)
- Form version: Git commit hash recorded
- Agent/RPA version: Fixed during experiment

**Data Consistency**:
- Identical field values for same field across all tests
- Fixed user persona data
- Consistent validation rules

**Network Environment**:
- Localhost deployment (eliminates network variability)
- Google Sheets API: only external dependency

### 3.4.5 Randomized Variables

Via seed-based generation:
- Number of visible fields
- Order of field appearance
- Submit button position
- Popup timing and content
- Visual theme and fonts
- Presence of curveball fields
- Sidebar ad layout

## 3.5 Performance Metrics and Evaluation

### 3.5.1 Primary Quantitative Metrics

**Task Completion Rate (TCR)**:
```
TCR = (successful_submissions / total_attempts) × 100%
```

Success definition:
- Form submitted to backend
- All required fields filled correctly
- Success modal displayed
- Submission recorded in Google Sheets

**Field Fill Accuracy (FFA)**:
```
FFA = (correctly_filled_fields / total_required_fields) × 100%
```

Correctness criteria:
- Value matches expected data from schema
- Format valid (email syntax, phone format, etc.)
- Field actually submitted (not just filled then erased)

**Time Efficiency (TE)**:
```
TE = total_elapsed_time (seconds)
```

Measured from:
- Start: First interaction event (field click or popup dismiss)
- End: Submit button click or timeout

**Action Economy (AE)**:
```
AE = total_actions_taken / minimum_theoretical_actions
```

Minimum actions = (fields_to_fill × 2) + popup_count + 1_submit

**Error Rate (ER)**:
```
ER = (failed_actions / total_actions) × 100%
```

Failed actions include:
- Clicks on non-interactive elements
- Typing in wrong field
- Distractor interactions
- Validation errors

### 3.5.2 Secondary Qualitative Metrics

**Challenge Response Success Rate**:
- Popup dismissal accuracy
- Decoy button avoidance
- Footer ad recognition
- Curveball field handling

**Navigation Pattern Analysis**:
- Sequential vs. random field order
- Backtracking frequency
- Scroll behavior
- Re-visiting completed fields

**Robustness Indicators**:
- Performance degradation with increasing complexity
- Consistency across theme variations
- Recovery from errors

### 3.5.3 Comparative Analysis Framework

**GUI Agent vs. RPA Comparison**:

| Metric | GUI Agent | RPA Script | Comparison Method |
|--------|-----------|------------|-------------------|
| Completion Rate | % | % | Paired t-test on matched seeds |
| Average Time | seconds | seconds | Independent samples t-test |
| Action Count | count | count | Mann-Whitney U test |
| Adaptability | qualitative | qualitative | Case study analysis |
| Error Patterns | taxonomy | taxonomy | Chi-square test |

## 3.6 Validity and Reliability

### 3.6.1 Internal Validity

**Threats Addressed**:
- **History**: All tests within short time period, same environment
- **Maturation**: Automated agents don't learn between trials
- **Testing**: Each seed used only once per approach (no practice effects)
- **Instrumentation**: Automated telemetry eliminates observer drift
- **Selection**: Systematic seed selection avoids bias

**Confounding Controls**:
- Same form application for both approaches
- Identical data values
- Synchronized testing conditions

### 3.6.2 External Validity

**Generalizability**:
- Forms representative of common web registration patterns
- Challenge elements reflect real-world ad-heavy websites
- Field types cover typical data collection needs

**Limitations**:
- Single form application (not multiple websites)
- English language only
- Desktop browser only (no mobile)
- Specific technology stack

### 3.6.3 Construct Validity

**Operational Definitions**:
- Clear success/failure criteria
- Observable, measurable outcomes
- Multiple metrics capture different dimensions

**Face Validity**:
- Form appears realistic to human users
- Challenges are recognizable as real web patterns
- Task difficulty appropriate for automation testing

### 3.6.4 Reliability

**Test-Retest Reliability**:
- Seed-based determinism ensures exact replication
- Same seed produces identical form
- Documented procedure enables independent reproduction

**Inter-Rater Reliability** (for qualitative coding):
- Error classifications validated by multiple coders
- Cohen's kappa calculated for agreement
- Disagreements resolved through discussion

## 3.7 Ethical Considerations

**Data Privacy**:
- No real user data collected
- All form submissions are synthetic test data
- No PII stored or transmitted

**Resource Usage**:
- Local infrastructure only (no abuse of external services)
- Google Sheets used within API quotas
- No deceptive practices

**Transparency**:
- Methodology fully documented
- Code available for review
- Results reported honestly including failures

## 3.8 Limitations

**Scope Limitations**:
- Single application domain (forms)
- Limited to registration/data collection type forms
- No multi-page forms or complex workflows

**Technical Limitations**:
- Fixed screen resolution may not reflect all user environments
- Localhost testing eliminates real network conditions
- Single browser engine (Chromium)

**Scale Limitations**:
- Sample size constrained by manual verification needs
- Computational resources limit trial count
- Time constraints on experiment duration

## 3.9 Summary

This chapter presented a comprehensive methodology centered on a purpose-built dynamic online form application designed to rigorously evaluate GUI agent and RPA automation approaches. The form application incorporates 15 field types, seed-based deterministic randomization, multiple adversarial challenge elements (popups, visual distractors, decoy buttons), and comprehensive telemetry infrastructure. The experimental design enables controlled comparison across varying complexity levels while maintaining ecological validity through realistic web patterns. The seed-based approach ensures perfect reproducibility while generating sufficient variability for statistical analysis. The comprehensive data collection infrastructure captures both quantitative performance metrics and qualitative interaction patterns, enabling multi-dimensional assessment of automation effectiveness. The following chapters will present empirical results obtained through application of this methodology.
