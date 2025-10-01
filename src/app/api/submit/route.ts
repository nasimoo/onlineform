import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Ensure Node.js runtime so 'googleapis' works (not Edge runtime)
export const runtime = 'nodejs';

type SubmissionPayload = {
  values: Record<string, unknown>;
  visibleKeys: string[];
  submittedAt: string;
  sessionId?: string;
  seed?: number | string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SubmissionPayload;

    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      return NextResponse.json({ error: 'Missing Google Sheets env vars' }, { status: 500 });
    }

    const auth = new google.auth.JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1) Read header row to determine target schema
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!1:1',
      majorDimension: 'ROWS',
    });
    const headers: string[] = (headerResp.data.values?.[0] as string[] | undefined) || [];

    if (!headers.length) {
      return NextResponse.json({ error: 'Sheet1 header row is empty. Please add headers first.' }, { status: 400 });
    }

    // 2) Map app keys to sheet headers (by exact header or alias)
    const aliases: Record<string, string> = {
      'Full Name': 'name',
      'Name': 'name',
      'Email': 'email',
      'Phone': 'phone',
      'Emergency Contact Name': 'emergencyName',
      'Emergency Contact Email': 'emergencyEmail',
      'Preferred Contact': 'contactPreference',
      'Interests': 'interests',
      'How did you hear about us?': 'referralSource',
      'Referral Source': 'referralSource',
      'Additional Notes': 'notes',
      'Notes': 'notes',
      'Newsletter': 'newsletter',
      'Submitted At': 'submittedAt',
      'Timestamp': 'submittedAt',
    };

    const valuesByKey = body.values as Record<string, unknown>;

    // 3) Build row strictly in header order
    const rowByHeader: string[] = headers.map((header) => {
      // Special-case timestamp columns
      const h = header.trim();
      const aliasKey = aliases[h] || h; // try alias, then raw key
      if (aliasKey === 'submittedAt') return body.submittedAt;
      if (aliasKey === 'seed') return body.seed != null ? String(body.seed) : '';
      if (aliasKey === 'sessionId') return body.sessionId != null ? String(body.sessionId) : '';

      const v = valuesByKey[aliasKey];
      return serializeValue(v);
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowByHeader] },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

function serializeValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v == null) return '';
  return String(v);
}


