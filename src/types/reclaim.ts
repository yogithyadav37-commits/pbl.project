export type ItemReportType = 'lost' | 'found';

export type ItemStatus = 'open' | 'matched' | 'claimed' | 'returned' | 'archived';

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'handed_over';

export type NotificationKind = 'match' | 'claim' | 'approval' | 'returned';

export type UserRole = 'student' | 'faculty' | 'admin';

export type CampusZoneId =
  | 'main-library'
  | 'science-hall'
  | 'student-union'
  | 'engineering-lab'
  | 'athletics-complex'
  | 'commons-quad';

export interface CampusZoneMeta {
  id: CampusZoneId;
  name: string;
  shortName: string;
  subtitle: string;
  position: [number, number, number];
  cameraOffset: [number, number, number];
  adjacentZones: CampusZoneId[];
}

export const CAMPUS_ZONES: CampusZoneMeta[] = [
  {
    id: 'main-library',
    name: 'Main Library',
    shortName: 'Library',
    subtitle: 'Reading halls, archives & 2nd floor study tables',
    position: [-16, 0, -12],
    cameraOffset: [-4, 14, 10],
    adjacentZones: ['commons-quad', 'science-hall'],
  },
  {
    id: 'science-hall',
    name: 'Science Hall',
    shortName: 'Science',
    subtitle: 'Chemistry labs, lecture theatre B & atrium',
    position: [16, 0, -14],
    cameraOffset: [26, 14, 8],
    adjacentZones: ['commons-quad', 'main-library', 'engineering-lab'],
  },
  {
    id: 'student-union',
    name: 'Student Union',
    shortName: 'Union',
    subtitle: 'Dining court, student lounge & bookstore',
    position: [-18, 0, 14],
    cameraOffset: [-6, 13, 34],
    adjacentZones: ['commons-quad', 'athletics-complex'],
  },
  {
    id: 'engineering-lab',
    name: 'Engineering Lab',
    shortName: 'Engineering',
    subtitle: 'Maker studio, robotics bay & CAD rooms',
    position: [18, 0, 12],
    cameraOffset: [30, 13, 30],
    adjacentZones: ['commons-quad', 'science-hall', 'athletics-complex'],
  },
  {
    id: 'athletics-complex',
    name: 'Athletics Complex',
    shortName: 'Athletics',
    subtitle: 'Gymnasium, outdoor track & locker corridor',
    position: [0, 0, 26],
    cameraOffset: [12, 15, 48],
    adjacentZones: ['student-union', 'engineering-lab', 'commons-quad'],
  },
  {
    id: 'commons-quad',
    name: 'Commons Quad',
    shortName: 'Quad',
    subtitle: 'Central courtyard, stone benches & clock pavilion',
    position: [0, 0, 0],
    cameraOffset: [12, 15, 22],
    adjacentZones: [
      'main-library',
      'science-hall',
      'student-union',
      'engineering-lab',
      'athletics-complex',
    ],
  },
];

// Validation limits synced verbatim from firebase-blueprint.json
export const FIELD_LIMITS = {
  itemName: { min: 2, max: 120 },
  category: { min: 2, max: 60 },
  description: { min: 10, max: 1200 },
  location: { min: 2, max: 120 },
  approxTime: { max: 40 },
  identifyingCharacteristics: { min: 1, max: 800 },
  verificationAnswer: { min: 5, max: 800 },
  uniqueMarks: { max: 500 },
  studentId: { min: 2, max: 32, pattern: /^[a-zA-Z0-9_-]+$/ },
  department: { min: 2, max: 80 },
  displayName: { min: 1, max: 100 },
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  studentId: string;
  department: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface CampusItem {
  id: string;
  type: ItemReportType;
  itemName: string;
  category: string;
  description: string;
  location: string;
  campusZone: CampusZoneId;
  dateOccurred: string; // YYYY-MM-DD
  approxTime?: string;
  status: ItemStatus;
  hasPhoto: boolean;
  photoUrl?: string;
  visualSignature?: string;
  reporterId: string;
  reporterName: string;
  /** Stored separately in Firestore subcollection /items/{id}/privateDetails/secret; never displayed publicly */
  privateCharacteristics?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchingConfig {
  descriptionWeight: number; // default 35
  nameWeight: number;        // default 25
  categoryWeight: number;    // default 15
  locationWeight: number;    // default 15
  dateWeight: number;        // default 10
  highThreshold: number;     // default 70
  possibleThreshold: number; // default 45
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  descriptionWeight: 35,
  nameWeight: 25,
  categoryWeight: 15,
  locationWeight: 15,
  dateWeight: 10,
  highThreshold: 70,
  possibleThreshold: 45,
};

export type MatchTier = 'high' | 'possible' | 'low';

export interface MatchBreakdown {
  descriptionScore: number; // 0..100
  nameScore: number;        // 0..100
  categoryScore: number;    // 0..100
  locationScore: number;    // 0..100
  dateScore: number;        // 0..100
  jaccardScore: number;     // 0..100
  tfidfCosineScore: number; // 0..100
  visualSimilarityScore: number | null; // optional 0..100 supplementary only
  visualBonusApplied: number;           // strictly capped supplementary adjustment
  matchedKeywords: string[];
}

export interface MatchResult {
  id: string;
  lostItem: CampusItem;
  foundItem: CampusItem;
  textScore: number;     // Primary 0..100 text-based score
  finalScore: number;    // 0..100 (textScore + strictly bounded visual support)
  tier: MatchTier;
  tierLabel: string;
  breakdown: MatchBreakdown;
}

export interface OwnershipClaim {
  id: string;
  itemId: string;
  matchedItemId?: string;
  itemName: string;
  claimantId: string;
  claimantName: string;
  claimantEmail: string;
  verificationAnswer: string;
  uniqueMarks?: string;
  matchScore?: number;
  status: ClaimStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: NotificationKind;
  relatedItemId?: string;
  read: boolean;
  createdAt: string;
}

export interface ItemCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}
