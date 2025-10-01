import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

type ActionPayload = {
  sessionId: string;
  seed: number | string;
  event: string;
  data?: unknown;
  timestamp?: string;
  userName?: string;
  userEmail?: string;
  action?: string;
  actionDetails?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ActionPayload;

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

    const now = body.timestamp || new Date().toISOString();
    const row = [
      now,
      String(body.sessionId || ''),
      String(body.seed ?? ''),
      String(body.event || ''),
      body.data != null ? JSON.stringify(body.data) : '',
      String(body.userName || ''),
      String(body.userEmail || ''),
      String(body.action || ''),
      body.actionDetails ? String(body.actionDetails) : '',
    ];

    await appendWithRetry(sheets, SHEET_ID, row);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

async function appendWithRetry(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  row: (string | number)[]
) {
  const maxAttempts = 5;
  let attempt = 0;
  let delayMs = 400;
  // Use Actions tab; ensure it exists in the sheet
  const range = 'Actions!A1';
  while (attempt < maxAttempts) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
      return;
    } catch (e: any) {
      const reason = e?.errors?.[0]?.reason || e?.code || '';
      const status = e?.response?.status;
      // Retry on rate limit (429) or backend errors
      if (status === 429 || reason === 'rateLimitExceeded') {
        await new Promise(r => setTimeout(r, delayMs));
        attempt++;
        delayMs *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error('Exceeded retry attempts for actions append');
}
