import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import workspaceConfig from '../../firebase-workspace-config.json';
import { CampusItem, MatchResult, OwnershipClaim } from '../types/reclaim';

// Minimal Workspace scopes matching set_up_oauth configuration
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
];

// Named secondary Firebase app targeting the Workspace OAuth project without colliding with [DEFAULT]
const workspaceApp =
  getApps().find((a) => a.name === 'workspace-oauth') ??
  initializeApp(workspaceConfig, 'workspace-oauth');

const workspaceAuth = getAuth(workspaceApp);

const workspaceProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  workspaceProvider.addScope(scope);
}
workspaceProvider.setCustomParameters({ prompt: 'consent' });

// Strictly in-memory token cache (never persisted to localStorage or sessionStorage)
let isWorkspaceSigningIn = false;
let cachedWorkspaceToken: string | null = null;
let cachedWorkspaceUser: User | null = null;

export function initWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) {
  return onAuthStateChanged(workspaceAuth, (user) => {
    if (user && cachedWorkspaceToken) {
      cachedWorkspaceUser = user;
      if (onAuthSuccess) onAuthSuccess(user, cachedWorkspaceToken);
    } else if (!isWorkspaceSigningIn) {
      cachedWorkspaceToken = null;
      cachedWorkspaceUser = null;
      if (onAuthCleared) onAuthCleared();
    }
  });
}

export async function connectWorkspaceWithGoogle(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isWorkspaceSigningIn = true;
    const result = await signInWithPopup(workspaceAuth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Workspace access token.');
    }
    cachedWorkspaceToken = credential.accessToken;
    cachedWorkspaceUser = result.user;
    return { user: result.user, accessToken: cachedWorkspaceToken };
  } finally {
    isWorkspaceSigningIn = false;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceToken;
}

export function getWorkspaceUser(): User | null {
  return cachedWorkspaceUser;
}

export async function disconnectWorkspace(): Promise<void> {
  await workspaceAuth.signOut();
  cachedWorkspaceToken = null;
  cachedWorkspaceUser = null;
}

/**
 * Exports campus lost & found items, intelligent matches, and ownership claims
 * to a newly created Google Spreadsheet via the Sheets v4 REST API.
 * Must only be invoked after explicit user confirmation.
 */
export async function exportCampusReportToSheets(
  accessToken: string,
  items: CampusItem[],
  matches: MatchResult[],
  claims: OwnershipClaim[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const timestamp = new Date().toISOString().slice(0, 10);
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `ReClaim Campus Lost & Found Log (${timestamp})`,
      },
      sheets: [
        { properties: { title: 'Campus Reports' } },
        { properties: { title: 'Intelligent Matches' } },
        { properties: { title: 'Ownership Claims' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Sheets API error (${createRes.status}): ${errText.slice(0, 160)}`);
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string = created.spreadsheetUrl;

  const itemRows = [
    ['ID', 'Type', 'Item Name', 'Category', 'Location', 'Date', 'Status', 'Reporter', 'Has Photo', 'Public Description'],
    ...items.map((i) => [
      i.id,
      i.type.toUpperCase(),
      i.itemName,
      i.category,
      i.location,
      i.dateOccurred,
      i.status,
      i.reporterName,
      i.hasPhoto ? 'Yes' : 'No',
      i.description,
    ]),
  ];

  const matchRows = [
    ['Lost Item', 'Found Item', 'Final Score (%)', 'Text Score (%)', 'Visual Score (%)', 'Match Tier', 'Matched Keywords'],
    ...matches.slice(0, 50).map((m) => [
      m.lostItem.itemName,
      m.foundItem.itemName,
      m.finalScore,
      m.textScore,
      m.breakdown.visualSimilarityScore ?? 'N/A',
      m.tierLabel,
      m.breakdown.matchedKeywords.join(', '),
    ]),
  ];

  const claimRows = [
    ['Claim ID', 'Item Name', 'Claimant', 'Email', 'Match Score (%)', 'Status', 'Submitted'],
    ...claims.map((c) => [
      c.id,
      c.itemName,
      c.claimantName,
      c.claimantEmail,
      c.matchScore ?? 'N/A',
      c.status,
      c.createdAt.slice(0, 10),
    ]),
  ];

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: "'Campus Reports'!A1", values: itemRows },
          { range: "'Intelligent Matches'!A1", values: matchRows },
          { range: "'Ownership Claims'!A1", values: claimRows },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    throw new Error(`Failed to populate sheet rows (${batchRes.status}): ${errText.slice(0, 160)}`);
  }

  return { spreadsheetId, spreadsheetUrl };
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sends a match or claim notification email using the Gmail REST API.
 * Must only be invoked after explicit user confirmation.
 */
export async function sendNotificationEmailViaGmail(
  accessToken: string,
  params: { to: string; subject: string; body: string }
): Promise<{ id: string }> {
  const mime = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.body,
  ].join('\r\n');

  const raw = encodeBase64Url(mime);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${errText.slice(0, 160)}`);
  }

  return res.json();
}
