import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CampusItem,
  FIELD_LIMITS,
  ItemCategory,
  MatchingConfig,
  OwnershipClaim,
  UserNotification,
  UserProfile,
} from '../types/reclaim';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'yogithyadav37@gmail.com';

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithFirebaseGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function clampStr(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid),
      displayName: String(d.displayName),
      email: String(d.email),
      studentId: String(d.studentId),
      department: String(d.department),
      role: d.role,
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(
  user: User,
  input: { displayName: string; studentId: string; department: string },
  existing: UserProfile | null
): Promise<void> {
  const path = `users/${user.uid}`;
  const cleanName = clampStr(input.displayName || user.displayName || 'Campus Student', FIELD_LIMITS.displayName.max);
  const cleanStudentId = clampStr(input.studentId.replace(/[^a-zA-Z0-9_-]/g, ''), FIELD_LIMITS.studentId.max);
  const cleanDept = clampStr(input.department, FIELD_LIMITS.department.max);

  try {
    if (!existing) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: cleanName,
        email: user.email || '',
        studentId: cleanStudentId,
        department: cleanDept,
        role: 'student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        studentId: cleanStudentId,
        department: cleanDept,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existing ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export function subscribeCampusItems(
  onData: (items: CampusItem[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'items';
  const q = query(
    collection(db, 'items'),
    where('status', 'in', ['open', 'matched', 'claimed', 'returned']),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CampusItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          type: d.type,
          itemName: d.itemName,
          category: d.category,
          description: d.description,
          location: d.location,
          campusZone: d.campusZone,
          dateOccurred: d.dateOccurred,
          approxTime: d.approxTime,
          status: d.status,
          hasPhoto: Boolean(d.hasPhoto),
          photoUrl: d.photoUrl,
          visualSignature: d.visualSignature,
          reporterId: d.reporterId,
          reporterName: d.reporterName,
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCampusItemReport(
  user: User,
  reporterName: string,
  payload: {
    type: 'lost' | 'found';
    itemName: string;
    category: string;
    description: string;
    location: string;
    campusZone: CampusItem['campusZone'];
    dateOccurred: string;
    approxTime?: string;
    identifyingCharacteristics?: string;
    hasPhoto: boolean;
    photoUrl?: string;
    visualSignature?: string;
  }
): Promise<string> {
  const itemId = makeDocId(payload.type);
  const path = `items/${itemId}`;

  const itemDoc: Record<string, unknown> = {
    type: payload.type,
    itemName: clampStr(payload.itemName, FIELD_LIMITS.itemName.max),
    category: clampStr(payload.category, FIELD_LIMITS.category.max),
    description: clampStr(payload.description, FIELD_LIMITS.description.max),
    location: clampStr(payload.location, FIELD_LIMITS.location.max),
    campusZone: payload.campusZone,
    dateOccurred: payload.dateOccurred,
    status: 'open',
    hasPhoto: payload.hasPhoto,
    reporterId: user.uid,
    reporterName: clampStr(reporterName, FIELD_LIMITS.displayName.max),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.approxTime?.trim()) {
    itemDoc.approxTime = clampStr(payload.approxTime, FIELD_LIMITS.approxTime.max);
  }
  // Never store base64 data URLs > 500 chars directly in Firestore doc (1MB & schema limit)
  if (payload.photoUrl && payload.photoUrl.length <= 500 && !payload.photoUrl.startsWith('data:')) {
    itemDoc.photoUrl = payload.photoUrl;
  }
  if (payload.visualSignature && payload.visualSignature.length <= 256) {
    itemDoc.visualSignature = payload.visualSignature;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'items', itemId), itemDoc);

    if (payload.identifyingCharacteristics?.trim()) {
      batch.set(doc(db, 'items', itemId, 'privateDetails', 'secret'), {
        itemId,
        reporterId: user.uid,
        identifyingCharacteristics: clampStr(
          payload.identifyingCharacteristics,
          FIELD_LIMITS.identifyingCharacteristics.max
        ),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return itemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchPrivateItemCharacteristics(itemId: string): Promise<string | null> {
  const path = `items/${itemId}/privateDetails/secret`;
  try {
    const snap = await getDoc(doc(db, 'items', itemId, 'privateDetails', 'secret'));
    if (!snap.exists()) return null;
    return String(snap.data().identifyingCharacteristics || '');
  } catch {
    return null;
  }
}

export function subscribeClaims(
  uid: string,
  isAdmin: boolean,
  onData: (claims: OwnershipClaim[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'claims';
  const q = isAdmin
    ? query(collection(db, 'claims'), orderBy('createdAt', 'desc'))
    : query(collection(db, 'claims'), where('claimantId', '==', uid), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: OwnershipClaim[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          itemId: d.itemId,
          matchedItemId: d.matchedItemId,
          itemName: d.itemName,
          claimantId: d.claimantId,
          claimantName: d.claimantName,
          claimantEmail: d.claimantEmail,
          verificationAnswer: d.verificationAnswer,
          uniqueMarks: d.uniqueMarks,
          matchScore: d.matchScore,
          status: d.status,
          adminNotes: d.adminNotes,
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createOwnershipClaim(
  user: User,
  claimantName: string,
  payload: {
    itemId: string;
    matchedItemId?: string;
    itemName: string;
    verificationAnswer: string;
    uniqueMarks?: string;
    matchScore?: number;
  }
): Promise<string> {
  const claimId = makeDocId('claim');
  const path = `claims/${claimId}`;
  const docData: Record<string, unknown> = {
    itemId: payload.itemId,
    itemName: clampStr(payload.itemName, FIELD_LIMITS.itemName.max),
    claimantId: user.uid,
    claimantName: clampStr(claimantName, FIELD_LIMITS.displayName.max),
    claimantEmail: user.email || '',
    verificationAnswer: clampStr(payload.verificationAnswer, FIELD_LIMITS.verificationAnswer.max),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.matchedItemId) docData.matchedItemId = payload.matchedItemId.slice(0, 128);
  if (payload.uniqueMarks?.trim()) {
    docData.uniqueMarks = clampStr(payload.uniqueMarks, FIELD_LIMITS.uniqueMarks.max);
  }
  if (typeof payload.matchScore === 'number') {
    docData.matchScore = Math.max(0, Math.min(100, Math.round(payload.matchScore)));
  }

  try {
    await setDoc(doc(db, 'claims', claimId), docData);
    return claimId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClaimStatusInFirestore(
  claim: OwnershipClaim,
  newStatus: OwnershipClaim['status'],
  adminNotes?: string
): Promise<void> {
  const path = `claims/${claim.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'claims', claim.id), {
      status: newStatus,
      adminNotes: clampStr(adminNotes || '', 500),
      updatedAt: serverTimestamp(),
    });
    if (newStatus === 'handed_over') {
      batch.update(doc(db, 'items', claim.itemId), {
        status: 'returned',
        updatedAt: serverTimestamp(),
      });
    } else if (newStatus === 'approved') {
      batch.update(doc(db, 'items', claim.itemId), {
        status: 'claimed',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeNotifications(
  uid: string,
  onData: (list: UserNotification[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: UserNotification[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          message: d.message,
          kind: d.kind,
          relatedItemId: d.relatedItemId,
          read: Boolean(d.read),
          createdAt: toIsoString(d.createdAt),
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createNotificationInFirestore(
  userId: string,
  payload: { title: string; message: string; kind: UserNotification['kind']; relatedItemId?: string }
): Promise<void> {
  const notifId = makeDocId('notif');
  const path = `notifications/${notifId}`;
  try {
    const data: Record<string, unknown> = {
      userId,
      title: clampStr(payload.title, 120),
      message: clampStr(payload.message, 500),
      kind: payload.kind,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (payload.relatedItemId) data.relatedItemId = payload.relatedItemId.slice(0, 128);
    await setDoc(doc(db, 'notifications', notifId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveMatchingConfigInFirestore(
  config: MatchingConfig,
  updatedBy: string
): Promise<void> {
  const path = 'settings/matchingConfig';
  try {
    await setDoc(doc(db, 'settings', 'matchingConfig'), {
      ...config,
      updatedBy: clampStr(updatedBy, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createCategoryInFirestore(name: string, description: string): Promise<void> {
  const catId = makeDocId('cat');
  const path = `categories/${catId}`;
  try {
    await setDoc(doc(db, 'categories', catId), {
      name: clampStr(name, 60),
      description: clampStr(description, 200),
      active: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMatchingConfigFromFirestore(): Promise<MatchingConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'matchingConfig'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      descriptionWeight: Number(d.descriptionWeight),
      nameWeight: Number(d.nameWeight),
      categoryWeight: Number(d.categoryWeight),
      locationWeight: Number(d.locationWeight),
      dateWeight: Number(d.dateWeight),
      highThreshold: Number(d.highThreshold),
      possibleThreshold: Number(d.possibleThreshold),
    };
  } catch {
    return null;
  }
}

export async function fetchCategoriesFromFirestore(): Promise<ItemCategory[]> {
  return [];
}
