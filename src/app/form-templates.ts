export type FieldKey =
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

export type FieldConfig = {
  key: FieldKey;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'checkbox-group' | 'textarea' | 'checkbox';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type FormTemplate = {
  id: number;
  title: string;
  fields: FieldConfig[];
  theme: 'pill' | 'boxy';
  font: 'sans' | 'serif' | 'mono';
  layout: 'single' | 'two-column' | 'compact';
  submitPosition: 'top' | 'middle' | 'bottom' | 'random';
  popup?: {
    timing: 'none' | 'immediate' | 'delayed' | 'very-delayed';
    message: string;
  };
};

// Generate 100 different form templates
export function generateFormTemplates(): FormTemplate[] {
  const templates: FormTemplate[] = [];

  const variations = {
    nameLabelVariations: ['Full Name', 'Name', 'Your Name', 'Legal Name', 'Complete Name'],
    phoneLabelVariations: ['Phone Number', 'Phone', 'Mobile Number', 'Contact Number', 'Telephone'],
    emailLabelVariations: ['Email', 'Email Address', 'Your Email', 'E-mail', 'Contact Email'],
    emergencyNameVariations: ['Emergency Contact Name', 'Emergency Contact', 'Emergency Person', 'Emergency Contact Full Name'],
    emergencyEmailVariations: ['Emergency Contact Email', 'Emergency Email', 'Emergency Contact E-mail'],
    contactPrefVariations: ['Preferred Contact Method', 'Contact Preference', 'How to reach you?', 'Best way to contact'],
    interestsVariations: ['Select Your Interests', 'Interests', 'What interests you?', 'Your Hobbies'],
    referralVariations: ['How did you hear about us?', 'Referral Source', 'Where did you find us?', 'How did you discover us?'],
    notesVariations: ['Additional Comments', 'Notes', 'Additional Information', 'Comments', 'Anything else?'],
    newsletterVariations: ['Subscribe to newsletter', 'Receive updates', 'Join our mailing list', 'Get email updates'],
  };

  const themes: Array<'pill' | 'boxy'> = ['pill', 'boxy'];
  const fonts: Array<'sans' | 'serif' | 'mono'> = ['sans', 'serif', 'mono'];
  const layouts: Array<'single' | 'two-column' | 'compact'> = ['single', 'two-column', 'compact'];
  const submitPositions: Array<'top' | 'middle' | 'bottom' | 'random'> = ['top', 'middle', 'bottom', 'random'];
  const popupTimings: Array<'none' | 'immediate' | 'delayed' | 'very-delayed'> = ['none', 'immediate', 'delayed', 'very-delayed'];
  const popupMessages = [
    'Welcome! Please complete the form below.',
    'Reminder: Please fill out all required fields.',
    'Still here? Need help with the form?',
    'Thank you for your interest!',
    'Almost done! Just a few more fields.',
  ];

  for (let i = 0; i < 100; i++) {
    const seed = 100001 + i;

    // Deterministic selection based on template index
    const themeIdx = i % themes.length;
    const fontIdx = Math.floor(i / 2) % fonts.length;
    const layoutIdx = Math.floor(i / 3) % layouts.length;
    const submitPosIdx = Math.floor(i / 5) % submitPositions.length;
    const popupTimingIdx = Math.floor(i / 4) % popupTimings.length;
    const popupMessageIdx = i % popupMessages.length;

    // Determine which fields to include (vary between 5-10 fields)
    const numFields = 5 + (i % 6); // 5-10 fields
    const includePhone = i % 3 !== 0;
    const includeEmergencyName = i % 4 === 0;
    const includeEmergencyEmail = includeEmergencyName && i % 5 !== 0;
    const includeContactPref = i % 3 === 1;
    const includeInterests = i % 2 === 0;
    const includeReferral = i % 2 === 1;
    const includeNotes = i % 3 !== 2;
    const includeNewsletter = i % 5 === 0;

    const fields: FieldConfig[] = [];

    // Always include name (required)
    fields.push({
      key: 'name',
      label: variations.nameLabelVariations[i % variations.nameLabelVariations.length],
      type: 'text',
      placeholder: 'Jane Doe',
      required: true,
    });

    // Always include email (required)
    fields.push({
      key: 'email',
      label: variations.emailLabelVariations[i % variations.emailLabelVariations.length],
      type: 'email',
      placeholder: 'jane@example.com',
      required: true,
    });

    // Optional fields
    if (includePhone) {
      fields.push({
        key: 'phone',
        label: variations.phoneLabelVariations[i % variations.phoneLabelVariations.length],
        type: 'tel',
        placeholder: '(555) 555-1234',
        required: i % 7 === 0,
      });
    }

    if (includeEmergencyName) {
      fields.push({
        key: 'emergencyName',
        label: variations.emergencyNameVariations[i % variations.emergencyNameVariations.length],
        type: 'text',
        placeholder: 'John Doe',
        required: i % 8 === 0,
      });
    }

    if (includeEmergencyEmail) {
      fields.push({
        key: 'emergencyEmail',
        label: variations.emergencyEmailVariations[i % variations.emergencyEmailVariations.length],
        type: 'email',
        placeholder: 'john@example.com',
        required: false,
      });
    }

    if (includeContactPref) {
      fields.push({
        key: 'contactPreference',
        label: variations.contactPrefVariations[i % variations.contactPrefVariations.length],
        type: 'radio',
        options: [
          { value: 'phone', label: 'Phone' },
          { value: 'email', label: 'Email' },
          { value: 'sms', label: 'SMS' },
        ],
        required: i % 6 === 0,
      });
    }

    if (includeInterests) {
      fields.push({
        key: 'interests',
        label: variations.interestsVariations[i % variations.interestsVariations.length],
        type: 'checkbox-group',
        options: [
          { value: 'sports', label: 'Sports' },
          { value: 'music', label: 'Music' },
          { value: 'tech', label: 'Tech' },
          { value: 'travel', label: 'Travel' },
        ],
        required: i % 9 === 0,
      });
    }

    if (includeReferral) {
      fields.push({
        key: 'referralSource',
        label: variations.referralVariations[i % variations.referralVariations.length],
        type: 'select',
        options: [
          { value: '', label: 'Select one' },
          { value: 'friend', label: 'Friend/Family' },
          { value: 'search', label: 'Search Engine' },
          { value: 'social', label: 'Social Media' },
          { value: 'ad', label: 'Advertisement' },
          { value: 'other', label: 'Other' },
        ],
        required: i % 10 === 0,
      });
    }

    if (includeNotes) {
      fields.push({
        key: 'notes',
        label: variations.notesVariations[i % variations.notesVariations.length],
        type: 'textarea',
        placeholder: 'Anything we should know?',
        required: false,
      });
    }

    if (includeNewsletter) {
      fields.push({
        key: 'newsletter',
        label: variations.newsletterVariations[i % variations.newsletterVariations.length],
        type: 'checkbox',
        required: false,
      });
    }

    // Shuffle fields deterministically based on template index
    const shuffledFields = deterministicShuffle([...fields], seed);

    templates.push({
      id: seed,
      title: `Registration Form ${i + 1}`,
      fields: shuffledFields,
      theme: themes[themeIdx],
      font: fonts[fontIdx],
      layout: layouts[layoutIdx],
      submitPosition: submitPositions[submitPosIdx],
      popup: {
        timing: popupTimings[popupTimingIdx],
        message: popupMessages[popupMessageIdx],
      },
    });
  }

  return templates;
}

// Deterministic shuffle based on seed
function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let currentSeed = seed;

  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((currentSeed / 4294967296) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Get template by seed
export function getTemplateByID(id: number): FormTemplate | null {
  const templates = generateFormTemplates();
  return templates.find(t => t.id === id) || null;
}