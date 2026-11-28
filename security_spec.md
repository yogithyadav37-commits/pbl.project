# ReClaim Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **PII Isolation**: User profiles (`/users/{userId}`) and private item identifying characteristics (`/items/{itemId}/privateDetails/secret`) can NEVER be read by unrelated authenticated users.
2. **No Self-Assigned Admin**: Creating a `/users/{userId}` document must strictly forbid `role == 'admin'` and forbid later updates to `role`.
3. **Immutable Ownership & Temporal Integrity**: `reporterId`, `claimantId`, `userId`, and `createdAt` cannot be modified after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. **Verified Email Gate**: All standard writes require `request.auth.token.email_verified == true`.
5. **Terminal State Locking**: Once an item reaches `status == 'returned'` or a claim reaches `status == 'handed_over'` or `'rejected'`, non-admin updates are strictly rejected.
6. **Strict Schema Enforcement**: Shadow fields, oversized strings, or malformed document IDs are denied across every collection.
7. **Master Gate on Subcollections**: `/items/{itemId}/privateDetails/{detailId}` verifies parent `/items/{itemId}` exists and `reporterId` matches parent owner.
8. **Admin-Controlled Ownership Verification**: Non-admin users can only create claims with `status == 'pending'` and cannot approve or mark claims as `handed_over`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Admin Registration**: `POST /users/u1` with `{ role: "admin", ... }` -> DENIED.
2. **Cross-User PII Read**: Authenticated `u2` calls `GET /users/u1` -> DENIED.
3. **Public Leak of Private Identifying Characteristics**: Authenticated `u2` calls `GET /items/item1/privateDetails/secret` -> DENIED.
4. **Spoofed Reporter ID**: `u2` creates `/items/item2` with `{ reporterId: "u1", ... }` -> DENIED.
5. **Shadow Field Injection**: `u1` creates `/items/item3` with extra ghost key `{ isVerified: true }` -> DENIED.
6. **Self-Approved Claim**: `u2` creates `/claims/c1` with `{ status: "approved", ... }` -> DENIED.
7. **Unverified Email Admin Spoof**: Token with `email: "yogithyadav37@gmail.com"` and `email_verified: false` attempts admin write -> DENIED.
8. **ID Poisoning**: Creating `/items/invalid$id!with*bad#chars` or 200-char ID -> DENIED.
9. **Oversized Description DoW Attack**: Creating `/items/item4` with 5000-char `description` -> DENIED.
10. **Terminal State Tampering**: `u1` updates `/items/item1` after `status == 'returned'` -> DENIED.
11. **Client Timestamp Forgery**: Creating `/items/item5` with `createdAt` not equal to `request.time` -> DENIED.
12. **Cross-User Notification Read/List**: `u2` queries `/notifications` where `userId == 'u1'` -> DENIED.
