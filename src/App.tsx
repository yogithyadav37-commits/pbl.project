import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CampusItem,
  CampusZoneId,
  DEFAULT_MATCHING_CONFIG,
  ItemCategory,
  ItemReportType,
  MatchResult,
  MatchingConfig,
  OwnershipClaim,
  UserNotification,
  UserProfile,
} from './types/reclaim';
import { SEED_CATEGORIES, SEED_CLAIMS, SEED_ITEMS, SEED_NOTIFICATIONS } from './data/seedData';
import { computeAllMatches, findMatchesForItem } from './utils/matchingEngine';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  createCampusItemReport,
  createCategoryInFirestore,
  createNotificationInFirestore,
  createOwnershipClaim,
  fetchMatchingConfigFromFirestore,
  fetchUserProfile,
  saveMatchingConfigInFirestore,
  saveUserProfile,
  signInWithFirebaseGoogle,
  signOutFirebase,
  subscribeAuth,
  subscribeCampusItems,
  subscribeClaims,
  subscribeNotifications,
  updateClaimStatusInFirestore,
} from './lib/firebase';
import {
  connectWorkspaceWithGoogle,
  disconnectWorkspace,
  exportCampusReportToSheets,
  getWorkspaceAccessToken,
  initWorkspaceAuth,
  sendNotificationEmailViaGmail,
} from './lib/workspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ActiveRoute, Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { SearchMatchesView } from './components/SearchMatchesView';
import { CampusMap3D } from './components/CampusMap3D';
import { ClaimsNotificationsView } from './components/ClaimsNotificationsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ReportFormModal } from './components/ReportFormModal';
import { ClaimModal } from './components/ClaimModal';
import { ProfileModal } from './components/ProfileModal';
import { ConfirmWorkspaceModal } from './components/ConfirmWorkspaceModal';
import { SmoothCursor } from './components/SmoothCursor';
import { motion } from 'motion/react';

type PendingWorkspaceAction =
  | { type: 'sheets' }
  | { type: 'gmail'; to: string; subject: string; body: string }
  | null;

export default function App() {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('home');
  const [searchZoneFilter, setSearchZoneFilter] = useState<CampusZoneId | 'all'>('all');

  // Auth & Profile state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Google Workspace OAuth state (in-memory only)
  const [workspaceConnected, setWorkspaceConnected] = useState(false);
  const [workspaceEmail, setWorkspaceEmail] = useState<string | null>(null);
  const [lastSpreadsheetUrl, setLastSpreadsheetUrl] = useState<string | null>(null);
  const [pendingWorkspaceAction, setPendingWorkspaceAction] =
    useState<PendingWorkspaceAction>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  // Core Domain State (Seeded deterministically, seamlessly merged with live Firestore docs)
  const [localItems, setLocalItems] = useState<CampusItem[]>(SEED_ITEMS);
  const [firestoreItems, setFirestoreItems] = useState<CampusItem[]>([]);
  const [localClaims, setLocalClaims] = useState<OwnershipClaim[]>(SEED_CLAIMS);
  const [firestoreClaims, setFirestoreClaims] = useState<OwnershipClaim[]>([]);
  const [localNotifications, setLocalNotifications] =
    useState<UserNotification[]>(SEED_NOTIFICATIONS);
  const [firestoreNotifications, setFirestoreNotifications] = useState<UserNotification[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>(SEED_CATEGORIES);
  const [matchingConfig, setMatchingConfig] = useState<MatchingConfig>(DEFAULT_MATCHING_CONFIG);

  // Modals & Banner Feedback
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<ItemReportType>('lost');
  const [claimModalTargetItem, setClaimModalTargetItem] = useState<CampusItem | null>(null);
  const [claimModalTargetMatch, setClaimModalTargetMatch] = useState<MatchResult | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const isAdmin = Boolean(
    firebaseUser?.emailVerified &&
      (firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL || profile?.role === 'admin')
  );

  // Subscribe to Firebase Auth & Workspace Auth
  useEffect(() => {
    const unsubAuth = subscribeAuth(async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        try {
          const prof = await fetchUserProfile(user.uid);
          setProfile(prof);
        } catch {
          setProfile(null);
        }
        const remoteConfig = await fetchMatchingConfigFromFirestore();
        if (remoteConfig) setMatchingConfig(remoteConfig);
      } else {
        setProfile(null);
        setFirestoreItems([]);
        setFirestoreClaims([]);
        setFirestoreNotifications([]);
      }
    });

    const unsubWorkspace = initWorkspaceAuth(
      (user) => {
        setWorkspaceConnected(true);
        setWorkspaceEmail(user.email || null);
      },
      () => {
        setWorkspaceConnected(false);
        setWorkspaceEmail(null);
      }
    );

    return () => {
      unsubAuth();
      unsubWorkspace();
    };
  }, []);

  // Attach Firestore listeners strictly after auth is ready & user is authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const unsubItems = subscribeCampusItems(
      (docs) => setFirestoreItems(docs),
      () => {
        // Keep seed items available if permissions or offline state blocks snapshot
      }
    );
    const unsubClaims = subscribeClaims(
      firebaseUser.uid,
      isAdmin,
      (docs) => setFirestoreClaims(docs),
      () => {}
    );
    const unsubNotifs = subscribeNotifications(
      firebaseUser.uid,
      (docs) => setFirestoreNotifications(docs),
      () => {}
    );

    return () => {
      unsubItems();
      unsubClaims();
      unsubNotifs();
    };
  }, [authReady, firebaseUser, isAdmin]);

  // Combine Firestore live docs with local/seed catalog (deduped by id)
  const items = useMemo(() => {
    const map = new Map<string, CampusItem>();
    for (const item of localItems) map.set(item.id, item);
    for (const item of firestoreItems) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [localItems, firestoreItems]);

  const claims = useMemo(() => {
    const map = new Map<string, OwnershipClaim>();
    for (const c of localClaims) map.set(c.id, c);
    for (const c of firestoreClaims) map.set(c.id, c);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [localClaims, firestoreClaims]);

  const notifications = useMemo(() => {
    const map = new Map<string, UserNotification>();
    for (const n of localNotifications) map.set(n.id, n);
    for (const n of firestoreNotifications) map.set(n.id, n);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [localNotifications, firestoreNotifications]);

  // Run intelligent text-based matching engine dynamically across all active lost & found reports
  const matches = useMemo(() => computeAllMatches(items, matchingConfig), [items, matchingConfig]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const showNotice = (tone: 'success' | 'info' | 'error', text: string) => {
    setBannerNotice({ tone, text });
    window.setTimeout(() => {
      setBannerNotice((cur) => (cur?.text === text ? null : cur));
    }, 6500);
  };

  // Report submission handler (writes to Firestore if signed in, updates local state immediately)
  const handleSubmitReport = async (data: {
    type: ItemReportType;
    itemName: string;
    category: string;
    description: string;
    location: string;
    campusZone: CampusZoneId;
    dateOccurred: string;
    approxTime: string;
    identifyingCharacteristics: string;
    hasPhoto: boolean;
    photoUrl?: string;
    visualSignature?: string;
  }) => {
    const nowIso = new Date().toISOString();
    const reporterName =
      profile?.displayName || firebaseUser?.displayName || 'Campus Student (Preview)';
    let newId = `${data.type}-${Date.now()}`;

    if (firebaseUser) {
      newId = await createCampusItemReport(firebaseUser, reporterName, data);
    }

    const createdItem: CampusItem = {
      id: newId,
      type: data.type,
      itemName: data.itemName,
      category: data.category,
      description: data.description,
      location: data.location,
      campusZone: data.campusZone,
      dateOccurred: data.dateOccurred,
      approxTime: data.approxTime || undefined,
      status: 'open',
      hasPhoto: data.hasPhoto,
      photoUrl: data.photoUrl,
      visualSignature: data.visualSignature,
      reporterId: firebaseUser?.uid || 'local-student',
      reporterName,
      privateCharacteristics: data.identifyingCharacteristics || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextItems = [createdItem, ...items];
    setLocalItems((prev) => [createdItem, ...prev]);

    // Immediately run the text matching engine for this newly reported item
    const itemMatches = findMatchesForItem(createdItem, nextItems, matchingConfig);
    const best = itemMatches[0];

    if (best && best.tier !== 'low') {
      const notifTitle = `${best.tierLabel} (${best.finalScore}%)`;
      const notifMsg = `ReClaim text engine matched "${createdItem.itemName}" with "${
        createdItem.type === 'lost' ? best.foundItem.itemName : best.lostItem.itemName
      }".`;
      const newNotif: UserNotification = {
        id: `notif-${Date.now()}`,
        userId: firebaseUser?.uid || 'local-student',
        title: notifTitle,
        message: notifMsg,
        kind: 'match',
        relatedItemId: createdItem.id,
        read: false,
        createdAt: nowIso,
      };
      setLocalNotifications((prev) => [newNotif, ...prev]);
      if (firebaseUser) {
        await createNotificationInFirestore(firebaseUser.uid, {
          title: notifTitle,
          message: notifMsg,
          kind: 'match',
          relatedItemId: createdItem.id,
        }).catch(() => {});
      }
      showNotice(
        'success',
        `Report submitted. Intelligent text engine found a ${best.finalScore}% ${best.tierLabel.toLowerCase()}!`
      );
      setActiveRoute('search');
    } else {
      showNotice('success', `${data.type === 'lost' ? 'Lost' : 'Found'} report "${data.itemName}" submitted.`);
      setActiveRoute('search');
    }
  };

  // Ownership claim submission handler
  const handleSubmitClaim = async (data: {
    itemId: string;
    matchedItemId?: string;
    itemName: string;
    verificationAnswer: string;
    uniqueMarks: string;
    matchScore?: number;
  }) => {
    const nowIso = new Date().toISOString();
    const claimantName =
      profile?.displayName || firebaseUser?.displayName || 'Campus Student (Preview)';
    const claimantEmail = firebaseUser?.email || 'student@campus.edu';
    let claimId = `claim-${Date.now()}`;

    // Only write to Firestore when target item exists in Firestore (not a seed-only item)
    const existsInFirestore = firestoreItems.some((i) => i.id === data.itemId);
    if (firebaseUser && existsInFirestore) {
      claimId = await createOwnershipClaim(firebaseUser, claimantName, data);
    }

    const newClaim: OwnershipClaim = {
      id: claimId,
      itemId: data.itemId,
      matchedItemId: data.matchedItemId,
      itemName: data.itemName,
      claimantId: firebaseUser?.uid || 'local-student',
      claimantName,
      claimantEmail,
      verificationAnswer: data.verificationAnswer,
      uniqueMarks: data.uniqueMarks || undefined,
      matchScore: data.matchScore,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setLocalClaims((prev) => [newClaim, ...prev]);
    setLocalNotifications((prev) => [
      {
        id: `notif-claim-${Date.now()}`,
        userId: firebaseUser?.uid || 'local-student',
        title: 'Ownership Claim Submitted',
        message: `Your private verification details for "${data.itemName}" are queued for administrator review.`,
        kind: 'claim',
        relatedItemId: data.itemId,
        read: false,
        createdAt: nowIso,
      },
      ...prev,
    ]);
    showNotice('success', `Claim submitted for "${data.itemName}". Pending administrator review.`);
  };

  // Admin claim review handler
  const handleUpdateClaimStatus = async (
    claim: OwnershipClaim,
    status: OwnershipClaim['status'],
    notes: string
  ) => {
    const nowIso = new Date().toISOString();
    const isFirestoreClaim = firestoreClaims.some((c) => c.id === claim.id);
    if (firebaseUser && isAdmin && isFirestoreClaim) {
      await updateClaimStatusInFirestore(claim, status, notes);
    }

    setLocalClaims((prev) =>
      prev.map((c) => (c.id === claim.id ? { ...c, status, adminNotes: notes, updatedAt: nowIso } : c))
    );

    if (status === 'handed_over' || status === 'approved') {
      const nextItemStatus = status === 'handed_over' ? 'returned' : 'claimed';
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === claim.itemId || item.id === claim.matchedItemId
            ? { ...item, status: nextItemStatus, updatedAt: nowIso }
            : item
        )
      );
    }

    const notifKind = status === 'handed_over' ? 'returned' : 'approval';
    const notifTitle =
      status === 'handed_over'
        ? `Item Returned: ${claim.itemName}`
        : status === 'approved'
        ? `Claim Approved: ${claim.itemName}`
        : `Claim Updated: ${claim.itemName}`;

    setLocalNotifications((prev) => [
      {
        id: `notif-status-${Date.now()}`,
        userId: claim.claimantId,
        title: notifTitle,
        message: notes || `Claim status changed to ${status.replace('_', ' ')}.`,
        kind: notifKind,
        relatedItemId: claim.itemId,
        read: false,
        createdAt: nowIso,
      },
      ...prev,
    ]);

    showNotice('success', `${notifTitle} — campus records updated.`);
  };

  const handleUpdateMatchingConfig = async (next: MatchingConfig) => {
    setMatchingConfig(next);
    if (firebaseUser && isAdmin) {
      await saveMatchingConfigInFirestore(next, firebaseUser.email || firebaseUser.uid).catch(
        () => {}
      );
    }
    showNotice('info', 'Text matching weights and tier thresholds updated across all matches.');
  };

  const handleAddCategory = async (name: string, description: string) => {
    const nowIso = new Date().toISOString();
    if (firebaseUser && isAdmin) {
      await createCategoryInFirestore(name, description).catch(() => {});
    }
    setCategories((prev) => [
      ...prev,
      { id: `cat-${Date.now()}`, name, description, active: true, createdAt: nowIso },
    ]);
    showNotice('success', `Category "${name}" added.`);
  };

  const handleConnectWorkspace = async () => {
    try {
      const res = await connectWorkspaceWithGoogle();
      setWorkspaceConnected(true);
      setWorkspaceEmail(res.user.email || null);
      showNotice('success', `Connected Google Sheets & Gmail as ${res.user.email || 'Google user'}.`);
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Google Workspace sign-in was cancelled.'
      );
    }
  };

  const handleConfirmWorkspaceAction = async () => {
    if (!pendingWorkspaceAction) return;
    let token = getWorkspaceAccessToken();
    if (!token) {
      try {
        const connected = await connectWorkspaceWithGoogle();
        token = connected.accessToken;
        setWorkspaceConnected(true);
        setWorkspaceEmail(connected.user.email || null);
      } catch (err) {
        showNotice(
          'error',
          err instanceof Error ? err.message : 'Sign in with Google to authorize Sheets & Gmail.'
        );
        setPendingWorkspaceAction(null);
        return;
      }
    }

    setWorkspaceBusy(true);
    try {
      if (pendingWorkspaceAction.type === 'sheets') {
        const res = await exportCampusReportToSheets(token, items, matches, claims);
        setLastSpreadsheetUrl(res.spreadsheetUrl);
        showNotice('success', 'Exported campus reports, matches, and claims to Google Sheets.');
      } else {
        await sendNotificationEmailViaGmail(token, {
          to: pendingWorkspaceAction.to,
          subject: pendingWorkspaceAction.subject,
          body: pendingWorkspaceAction.body,
        });
        showNotice('success', `Gmail notification sent to ${pendingWorkspaceAction.to}.`);
      }
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'Google Workspace request failed.'
      );
    } finally {
      setWorkspaceBusy(false);
      setPendingWorkspaceAction(null);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-campus-canvas text-[#0B1437]">
        <SmoothCursor />
        <Header
          activeRoute={activeRoute}
          onNavigate={(route) => {
            setActiveRoute(route);
            if (route !== 'search') setSearchZoneFilter('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          firebaseUser={firebaseUser}
          profile={profile}
          unreadNotifications={unreadNotifications}
          onOpenAuthModal={() => setProfileModalOpen(true)}
        />

        {bannerNotice && (
          <div
            role="status"
            className={`fixed top-[72px] left-1/2 z-40 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-xs font-medium shadow-md ${
              bannerNotice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : bannerNotice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            <span>{bannerNotice.text}</span>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        <motion.div
          key={activeRoute}
          initial={activeRoute === 'map' ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1"
        >
          {activeRoute === 'home' && (
            <HomeView
              items={items}
              matches={matches}
              onReportLost={() => {
                setReportModalType('lost');
                setReportModalOpen(true);
              }}
              onReportFound={() => {
                setReportModalType('found');
                setReportModalOpen(true);
              }}
              onOpenSearch={() => setActiveRoute('search')}
              onOpen3DMap={() => setActiveRoute('map')}
              onSelectMatchForClaim={(match) => {
                setClaimModalTargetMatch(match);
                setClaimModalTargetItem(null);
              }}
              onSelectItemForClaim={(item) => {
                setClaimModalTargetItem(item);
                setClaimModalTargetMatch(null);
              }}
            />
          )}

          {activeRoute === 'search' && (
            <SearchMatchesView
              items={items}
              matches={matches}
              categories={categories}
              matchingConfig={matchingConfig}
              initialZoneFilter={searchZoneFilter}
              onClearZoneFilter={() => setSearchZoneFilter('all')}
              onSelectMatchForClaim={(match) => {
                setClaimModalTargetMatch(match);
                setClaimModalTargetItem(null);
              }}
              onSelectItemForClaim={(item) => {
                setClaimModalTargetItem(item);
                setClaimModalTargetMatch(null);
              }}
              onReportLost={() => {
                setReportModalType('lost');
                setReportModalOpen(true);
              }}
              onReportFound={() => {
                setReportModalType('found');
                setReportModalOpen(true);
              }}
            />
          )}

          {activeRoute === 'map' && (
            <CampusMap3D
              items={items}
              onInspectZoneItems={(zoneId) => {
                setSearchZoneFilter(zoneId);
                setActiveRoute('search');
              }}
              onSelectItemForClaim={(item) => {
                setClaimModalTargetItem(item);
                setClaimModalTargetMatch(null);
              }}
            />
          )}

          {activeRoute === 'claims' && (
            <ClaimsNotificationsView
              claims={claims}
              notifications={notifications}
              onMarkNotificationRead={(id) =>
                setLocalNotifications((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                )
              }
              onMarkAllRead={() =>
                setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }
              onBrowseMatches={() => setActiveRoute('search')}
            />
          )}

          {activeRoute === 'admin' && (
            <AdminDashboardView
              items={items}
              matches={matches}
              claims={claims}
              categories={categories}
              matchingConfig={matchingConfig}
              isAdminUser={isAdmin}
              workspaceConnected={workspaceConnected}
              workspaceEmail={workspaceEmail}
              lastSpreadsheetUrl={lastSpreadsheetUrl}
              onConnectWorkspace={handleConnectWorkspace}
              onDisconnectWorkspace={async () => {
                await disconnectWorkspace();
                setWorkspaceConnected(false);
                setWorkspaceEmail(null);
                showNotice('info', 'Disconnected Google Sheets & Gmail session.');
              }}
              onRequestSheetsExport={() => setPendingWorkspaceAction({ type: 'sheets' })}
              onRequestSendEmail={(payload) =>
                setPendingWorkspaceAction({ type: 'gmail', ...payload })
              }
              onUpdateClaimStatus={handleUpdateClaimStatus}
              onUpdateMatchingConfig={handleUpdateMatchingConfig}
              onAddCategory={handleAddCategory}
              onToggleCategory={(id) =>
                setCategories((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
                )
              }
            />
          )}
        </motion.div>

        {activeRoute !== 'map' && (
          <footer className="mt-12 border-t border-slate-200/80 bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
              <p className="font-medium text-slate-600">
                <span className="font-display font-bold text-[#0B1437]">
                  Re<span className="text-[#1A4BFF]">Claim</span>
                </span>{' '}
                — Intelligent Campus Lost &amp; Found Management System
              </p>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoute('search');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="font-medium transition-colors hover:text-[#1A4BFF]"
                >
                  Search &amp; Matches
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoute('map');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="font-medium transition-colors hover:text-[#1A4BFF]"
                >
                  3D Campus Map
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoute('admin');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="font-medium transition-colors hover:text-[#1A4BFF]"
                >
                  Admin &amp; Java Blueprint
                </button>
              </div>
            </div>
          </footer>
        )}

        {/* Modals */}
        <ReportFormModal
          open={reportModalOpen}
          initialType={reportModalType}
          categories={categories}
          isSignedIn={Boolean(firebaseUser)}
          onClose={() => setReportModalOpen(false)}
          onSubmitReport={handleSubmitReport}
        />

        <ClaimModal
          open={Boolean(claimModalTargetItem || claimModalTargetMatch)}
          targetItem={claimModalTargetItem}
          targetMatch={claimModalTargetMatch}
          onClose={() => {
            setClaimModalTargetItem(null);
            setClaimModalTargetMatch(null);
          }}
          onSubmitClaim={handleSubmitClaim}
        />

        <ProfileModal
          open={profileModalOpen}
          firebaseUser={firebaseUser}
          profile={profile}
          isAdmin={isAdmin}
          authLoading={authLoading}
          onClose={() => setProfileModalOpen(false)}
          onSignInGoogle={async () => {
            setAuthLoading(true);
            try {
              await signInWithFirebaseGoogle();
              showNotice('success', 'Signed in with Google.');
            } finally {
              setAuthLoading(false);
            }
          }}
          onSignOut={async () => {
            await signOutFirebase();
            showNotice('info', 'Signed out of ReClaim.');
          }}
          onSaveProfile={async (input) => {
            if (!firebaseUser) return;
            await saveUserProfile(firebaseUser, input, profile);
            const updated = await fetchUserProfile(firebaseUser.uid);
            setProfile(updated);
          }}
        />

        <ConfirmWorkspaceModal
          open={Boolean(pendingWorkspaceAction)}
          title={
            pendingWorkspaceAction?.type === 'sheets'
              ? 'Create & Populate Google Sheet?'
              : 'Send Email Notification via Gmail?'
          }
          description={
            pendingWorkspaceAction?.type === 'sheets'
              ? 'This will create a new Google Spreadsheet in your Google account containing ReClaim campus reports, match scores, and claim statuses.'
              : 'This will send a real email from your connected Gmail account to the recipient below.'
          }
          details={
            pendingWorkspaceAction?.type === 'sheets'
              ? [
                  `Tab 1 — Campus Reports: ${items.length} public lost & found rows (private verification clues excluded)`,
                  `Tab 2 — Intelligent Matches: ${Math.min(matches.length, 50)} scored text matches`,
                  `Tab 3 — Ownership Claims: ${claims.length} claim records`,
                ]
              : pendingWorkspaceAction?.type === 'gmail'
              ? [
                  `To: ${pendingWorkspaceAction.to}`,
                  `Subject: ${pendingWorkspaceAction.subject}`,
                  `Preview: ${pendingWorkspaceAction.body.slice(0, 140)}…`,
                ]
              : []
          }
          confirmLabel={
            pendingWorkspaceAction?.type === 'sheets' ? 'Confirm & Export Sheet' : 'Confirm & Send Email'
          }
          isBusy={workspaceBusy}
          onConfirm={handleConfirmWorkspaceAction}
          onCancel={() => setPendingWorkspaceAction(null)}
        />
      </div>
    </ErrorBoundary>
  );
}
