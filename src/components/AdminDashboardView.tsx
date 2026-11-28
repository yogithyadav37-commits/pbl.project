import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Lock,
  Mail,
  Plus,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import {
  CampusItem,
  DEFAULT_MATCHING_CONFIG,
  ItemCategory,
  MatchResult,
  MatchingConfig,
  OwnershipClaim,
} from '../types/reclaim';
import { JAVA_BLUEPRINT_FILES, JAVA_PROJECT_TREE } from '../data/javaBlueprint';
import { GoogleSignInButton } from './GoogleSignInButton';
import { TiltCard3D } from './TiltCard3D';

interface AdminDashboardViewProps {
  items: CampusItem[];
  matches: MatchResult[];
  claims: OwnershipClaim[];
  categories: ItemCategory[];
  matchingConfig: MatchingConfig;
  isAdminUser: boolean;
  workspaceConnected: boolean;
  workspaceEmail: string | null;
  lastSpreadsheetUrl: string | null;
  onConnectWorkspace: () => Promise<void>;
  onDisconnectWorkspace: () => Promise<void>;
  onRequestSheetsExport: () => void;
  onRequestSendEmail: (payload: { to: string; subject: string; body: string }) => void;
  onUpdateClaimStatus: (
    claim: OwnershipClaim,
    status: OwnershipClaim['status'],
    notes: string
  ) => Promise<void>;
  onUpdateMatchingConfig: (next: MatchingConfig) => Promise<void>;
  onAddCategory: (name: string, description: string) => Promise<void>;
  onToggleCategory: (id: string) => void;
}

type AdminTab = 'claims' | 'engine' | 'workspace' | 'java';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  items,
  matches,
  claims,
  categories,
  matchingConfig,
  isAdminUser,
  workspaceConnected,
  workspaceEmail,
  lastSpreadsheetUrl,
  onConnectWorkspace,
  onDisconnectWorkspace,
  onRequestSheetsExport,
  onRequestSendEmail,
  onUpdateClaimStatus,
  onUpdateMatchingConfig,
  onAddCategory,
  onToggleCategory,
}) => {
  const [adminTab, setAdminTab] = useState<AdminTab>('claims');
  const [draftConfig, setDraftConfig] = useState<MatchingConfig>(matchingConfig);
  const [configSaved, setConfigSaved] = useState(false);

  // Category manager state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Claim admin notes per claim id
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});

  // Gmail composer state
  const [mailTo, setMailTo] = useState('ananya.rao@campus.edu');
  const [mailSubject, setMailSubject] = useState('ReClaim: Your Campus Item Claim Status Update');
  const [mailBody, setMailBody] = useState(
    'Hello,\n\nYour ownership claim for "Black Wallet" has been verified by the Campus Lost & Found office. Please bring your Student ID to the Main Library Security Desk to complete handover.\n\nRegards,\nReClaim Campus Administration'
  );

  // Java Blueprint viewer state
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(JAVA_BLUEPRINT_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  React.useEffect(() => {
    setDraftConfig(matchingConfig);
  }, [matchingConfig]);

  const lostCount = items.filter((i) => i.type === 'lost').length;
  const foundCount = items.filter((i) => i.type === 'found').length;
  const returnedCount = items.filter((i) => i.status === 'returned').length;
  const pendingClaimsCount = claims.filter((c) => c.status === 'pending').length;
  const potentialMatchCount = matches.filter((m) => m.tier !== 'low').length;
  const weightSum =
    draftConfig.descriptionWeight +
    draftConfig.nameWeight +
    draftConfig.categoryWeight +
    draftConfig.locationWeight +
    draftConfig.dateWeight;

  const selectedBlueprint =
    JAVA_BLUEPRINT_FILES.find((f) => f.id === selectedBlueprintId) ?? JAVA_BLUEPRINT_FILES[0];

  const handleSaveConfig = async () => {
    await onUpdateMatchingConfig(draftConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim().length < 2) return;
    await onAddCategory(newCatName.trim(), newCatDesc.trim());
    setNewCatName('');
    setNewCatDesc('');
  };

  const handleCopyCode = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleDownloadBlueprint = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'reclaim-file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Campus Administrator Console
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verify ownership claims, tune matching weights, export records to Google Sheets, send
            Gmail alerts, and inspect the Java Maven / MySQL reference architecture.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {isAdminUser
            ? 'Signed in with Campus Administrator privileges'
            : 'Previewing Admin Console locally (Sign in with admin account to persist Firestore rules writes)'}
        </p>
      </div>

      {/* 6-Metric Campus KPI Strip */}
      <section aria-label="Administrator overview statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Campus Users', value: 148, tone: 'text-[#0B1437]', bar: 'from-[#0B1437] to-[#1A4BFF]' },
          { label: 'Lost Reports', value: lostCount, tone: 'text-[#FF4D2E]', bar: 'from-[#FF4D2E] to-[#FB923C]' },
          { label: 'Found Reports', value: foundCount, tone: 'text-[#1A4BFF]', bar: 'from-[#1A4BFF] to-[#38BDF8]' },
          { label: 'Potential Matches', value: potentialMatchCount, tone: 'text-[#0EA5A4]', bar: 'from-[#0EA5A4] to-[#34D399]' },
          { label: 'Pending Claims', value: pendingClaimsCount, tone: 'text-[#D97706]', bar: 'from-[#D97706] to-[#FBBF24]' },
          { label: 'Returned Items', value: returnedCount, tone: 'text-[#059669]', bar: 'from-[#059669] to-[#10B981]' },
        ].map((kpi) => (
          <TiltCard3D
            key={kpi.label}
            maxTilt={5}
            className="rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-blue-200"
          >
            <div className={`h-1 w-full bg-gradient-to-r ${kpi.bar}`} />
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
              <p className={`mt-1 font-mono text-2xl font-extrabold tabular-nums ${kpi.tone}`}>
                {kpi.value}
              </p>
            </div>
          </TiltCard3D>
        ))}
      </section>

      {/* Admin Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/75 p-1 w-fit" role="tablist">
        {[
          { id: 'claims' as const, label: `Claims Verification (${pendingClaimsCount})` },
          { id: 'engine' as const, label: 'Matching Thresholds' },
          { id: 'workspace' as const, label: 'Sheets, Gmail & Categories' },
          { id: 'java' as const, label: 'Java Maven & MySQL Blueprint' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={adminTab === tab.id}
            onClick={() => setAdminTab(tab.id)}
            className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              adminTab === tab.id
                ? 'bg-[#0B1437] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0B1437]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CLAIMS VERIFICATION */}
      {adminTab === 'claims' && (
        <section aria-label="Ownership claim verification queue" className="space-y-4">
          {claims.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No ownership claims have been submitted yet.
            </div>
          ) : (
            claims.map((claim) => {
              const targetItem = items.find((i) => i.id === claim.itemId);
              const noteDraft = notesByClaim[claim.id] ?? claim.adminNotes ?? '';
              return (
                <article
                  key={claim.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {claim.itemName} — Claim by {claim.claimantName}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {claim.claimantEmail} · Submitted {claim.createdAt.slice(0, 10)}
                        {typeof claim.matchScore === 'number'
                          ? ` · Engine score ${claim.matchScore}%`
                          : ''}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase text-blue-700">
                      Status: {claim.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Side-by-side Private Verification Check */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                      <p className="font-semibold text-slate-800">
                        Claimant&apos;s Private Verification Answer
                      </p>
                      <p className="mt-1.5 leading-relaxed text-slate-700">
                        {claim.verificationAnswer}
                      </p>
                      {claim.uniqueMarks && (
                        <p className="mt-1.5 text-slate-500">Unique marks: {claim.uniqueMarks}</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3.5 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Admin-Only Private Record on Found Item</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-700">
                        {targetItem?.privateCharacteristics ||
                          'Stored privately in /items/{id}/privateDetails/secret (inspect physical tag at Campus Security Desk).'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor={`admin-note-${claim.id}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Verification / Handover Note
                      </label>
                      <input
                        id={`admin-note-${claim.id}`}
                        type="text"
                        value={noteDraft}
                        onChange={(e) =>
                          setNotesByClaim((prev) => ({ ...prev, [claim.id]: e.target.value }))
                        }
                        placeholder="e.g., Student ID checked; approved for pickup at Library Desk"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={claim.status === 'approved' || claim.status === 'handed_over'}
                        onClick={() =>
                          onUpdateClaimStatus(
                            claim,
                            'approved',
                            noteDraft || 'Ownership verified. Ready for pickup.'
                          )
                        }
                        className="whitespace-nowrap rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {claim.status === 'approved' ? 'Approved' : 'Approve Claim'}
                      </button>
                      <button
                        type="button"
                        disabled={claim.status === 'handed_over'}
                        onClick={() =>
                          onUpdateClaimStatus(
                            claim,
                            'handed_over',
                            noteDraft || 'Item physically handed over to verified student.'
                          )
                        }
                        className="whitespace-nowrap rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {claim.status === 'handed_over' ? 'Returned' : 'Mark Returned'}
                      </button>
                      <button
                        type="button"
                        disabled={claim.status === 'handed_over' || claim.status === 'rejected'}
                        onClick={() =>
                          onUpdateClaimStatus(
                            claim,
                            'rejected',
                            noteDraft || 'Verification details did not match.'
                          )
                        }
                        className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMailTo(claim.claimantEmail);
                          setMailSubject(`ReClaim Update: ${claim.itemName}`);
                          setMailBody(
                            `Hello ${claim.claimantName},\n\nYour ownership claim for "${claim.itemName}" has been updated by Campus Lost & Found.\n\nNotes: ${
                              noteDraft || 'Please visit the Campus Security Desk with your Student ID.'
                            }\n\nRegards,\nReClaim Administration`
                          );
                          setAdminTab('workspace');
                        }}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Email Student</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {/* TAB 2: MATCHING ENGINE WEIGHTS & THRESHOLDS */}
      {adminTab === 'engine' && (
        <section
          aria-label="Intelligent text matching engine configuration"
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Sliders className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Text Matching Weights &amp; Classification Thresholds
                </h2>
                <p className="text-xs text-slate-600">
                  Adjust factor weights and tier cutoffs. Changes immediately recalculate all live
                  campus matches.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraftConfig(DEFAULT_MATCHING_CONFIG)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restore Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-slate-900">Weighted Factors</h3>
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    weightSum === 100 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  Total: {weightSum}% (auto-normalized)
                </span>
              </div>

              {(
                [
                  ['descriptionWeight', 'Description Similarity (TF-IDF + Jaccard + Synonyms)'],
                  ['nameWeight', 'Item Name Similarity'],
                  ['categoryWeight', 'Category Similarity'],
                  ['locationWeight', 'Campus Location Proximity'],
                  ['dateWeight', 'Date Proximity'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor={`slider-${key}`} className="font-medium text-slate-700">
                      {label}
                    </label>
                    <span className="font-mono font-semibold tabular-nums text-blue-700">
                      {draftConfig[key]}%
                    </span>
                  </div>
                  <input
                    id={`slider-${key}`}
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={draftConfig[key]}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="mt-1.5 w-full accent-blue-700"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-5 lg:border-l lg:border-slate-100 lg:pl-6">
              <h3 className="text-sm font-bold text-slate-900">Match Tier Thresholds</h3>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-high" className="font-medium text-slate-700">
                    High Potential Match Minimum Score
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-emerald-700">
                    ≥ {draftConfig.highThreshold}%
                  </span>
                </div>
                <input
                  id="slider-high"
                  type="range"
                  min={55}
                  max={90}
                  step={1}
                  value={draftConfig.highThreshold}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDraftConfig((prev) => ({
                      ...prev,
                      highThreshold: val,
                      possibleThreshold: Math.min(prev.possibleThreshold, val - 10),
                    }));
                  }}
                  className="mt-1.5 w-full accent-emerald-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slider-possible" className="font-medium text-slate-700">
                    Possible Match Minimum Score
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-amber-700">
                    ≥ {draftConfig.possibleThreshold}%
                  </span>
                </div>
                <input
                  id="slider-possible"
                  type="range"
                  min={25}
                  max={Math.max(25, draftConfig.highThreshold - 10)}
                  step={1}
                  value={draftConfig.possibleThreshold}
                  onChange={(e) =>
                    setDraftConfig((prev) => ({
                      ...prev,
                      possibleThreshold: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5 w-full accent-amber-600"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Secondary Image Safeguard:</strong> Optional
                visual histogram similarity is capped at +5 supplementary points and only applies
                when the primary text score is already ≥ 40%. Photographs can never override text
                matching.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Apply &amp; Save Thresholds
                </button>
                {configSaved && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Updated live matches
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: GOOGLE SHEETS, GMAIL & CATEGORY MANAGEMENT */}
      {adminTab === 'workspace' && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Google Workspace Integration Card */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Google Sheets &amp; Gmail Workspace Actions
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {workspaceConnected
                      ? `Connected as ${workspaceEmail || 'Google Workspace user'} (in-memory token only).`
                      : 'Sign in with Google to export campus audit spreadsheets and dispatch real Gmail updates.'}
                  </p>
                </div>
                {workspaceConnected ? (
                  <button
                    type="button"
                    onClick={onDisconnectWorkspace}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Disconnect Workspace
                  </button>
                ) : (
                  <GoogleSignInButton
                    onClick={onConnectWorkspace}
                    label="Connect Sheets & Gmail"
                  />
                )}
              </div>

              {/* Action 1: Export to Google Sheets */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <span>Export Campus Log to Google Sheets</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Creates a 3-tab Google Spreadsheet with {items.length} reports,{' '}
                    {matches.length} scored matches, and {claims.length} ownership claims.
                  </p>
                  {lastSpreadsheetUrl && (
                    <a
                      href={lastSpreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      <span>Open latest exported Google Sheet</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onRequestSheetsExport}
                  className="whitespace-nowrap shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Export to Sheets
                </button>
              </div>

              {/* Action 2: Send Notification via Gmail */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!mailTo.trim() || !mailSubject.trim() || !mailBody.trim()) return;
                  onRequestSendEmail({
                    to: mailTo.trim(),
                    subject: mailSubject.trim(),
                    body: mailBody.trim(),
                  });
                }}
                className="space-y-3 border-t border-slate-100 pt-4"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Mail className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <span>Send Claim or Match Notification via Gmail</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="gmail-to" className="block text-xs font-medium text-slate-700">
                      Recipient Email
                    </label>
                    <input
                      id="gmail-to"
                      type="email"
                      required
                      value={mailTo}
                      onChange={(e) => setMailTo(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="gmail-subject" className="block text-xs font-medium text-slate-700">
                      Subject
                    </label>
                    <input
                      id="gmail-subject"
                      type="text"
                      required
                      value={mailSubject}
                      onChange={(e) => setMailSubject(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="gmail-body" className="block text-xs font-medium text-slate-700">
                    Message Body
                  </label>
                  <textarea
                    id="gmail-body"
                    rows={4}
                    required
                    value={mailBody}
                    onChange={(e) => setMailBody(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    Always asks for explicit confirmation before dispatching via Gmail.
                  </span>
                  <button
                    type="submit"
                    className="whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Review &amp; Send Email
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Campus Categories Manager */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Campus Item Categories</h2>
            <form onSubmit={handleCreateCategory} className="space-y-2.5 border-b border-slate-100 pb-4">
              <div>
                <label htmlFor="cat-name" className="block text-xs font-medium text-slate-700">
                  New Category Name
                </label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g., Musical Instruments"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="cat-desc" className="block text-xs font-medium text-slate-700">
                  Short Description
                </label>
                <input
                  id="cat-desc"
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="e.g., Guitars, cases, reeds, and tuners"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Category</span>
              </button>
            </form>

            <ul className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{cat.name}</p>
                    {cat.description && (
                      <p className="text-[11px] text-slate-500 truncate">{cat.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleCategory(cat.id)}
                    className={`whitespace-nowrap shrink-0 text-xs font-semibold ${
                      cat.active ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {cat.active ? 'Active' : 'Hidden'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* TAB 4: JAVA MAVEN / SERVLET / MYSQL BLUEPRINT */}
      {adminTab === 'java' && (
        <section
          aria-label="Java Maven Servlet and MySQL reference blueprint"
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Code2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <span>Maven Project Structure</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Eclipse IDE + Apache Tomcat 10 + JDBC + MySQL 8 (`reclaim_db`) reference files.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                {JAVA_PROJECT_TREE}
              </pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              {JAVA_BLUEPRINT_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedBlueprintId(file.id)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selectedBlueprint.id === file.id
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-mono text-xs font-semibold truncate">{file.path}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{file.category}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-mono text-sm font-bold text-slate-900">
                  {selectedBlueprint.path}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">{selectedBlueprint.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyCode(selectedBlueprint.id, selectedBlueprint.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedId === selectedBlueprint.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedId === selectedBlueprint.id ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadBlueprint(selectedBlueprint.path, selectedBlueprint.content)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <pre className="mt-4 max-h-[560px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
              {selectedBlueprint.content}
            </pre>
          </div>
        </section>
      )}
    </main>
  );
};
