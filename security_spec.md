# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Ownership (`/user_backups/{userId}`)**: A backup document at `/user_backups/{userId}` can ONLY be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId` AND whose `ownerId == request.auth.uid`.
2. **Email Verification Mandate**: All write operations require `request.auth.token.email_verified == true`.
3. **Strict Schema & No Shadow Fields**: Documents in `/user_backups/{userId}` must strictly contain ONLY the allowed keys `['ownerId', 'ownerEmail', 'backupLabel', 'hadithCount', 'contactCount', 'templateCount', 'payload', 'createdAt', 'updatedAt']`.
4. **Immutable Ownership & Creation Time**: During updates, `ownerId` and `createdAt` must remain unchanged (`incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`).
5. **Server Timestamp Enforcement**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. **PII Isolation**: Since backup payloads contain contact phone numbers and admin email, blanket reads (`allow read: if isSignedIn()`) are strictly prohibited; only the document owner (`request.auth.uid == userId`) can read their own backup document.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Writing to `/user_backups/user_1` with `auth == null`.
2. **Unverified Email Spoof**: Writing to `/user_backups/user_1` with `email_verified == false`.
3. **Cross-User Read (PII Leak)**: `user_2` attempting `get` on `/user_backups/user_1`.
4. **Identity Spoofing on Create**: `user_1` creating `/user_backups/user_1` with `ownerId: "user_2"`.
5. **Shadow / Ghost Field Injection**: Including `isAdmin: true` or `hacked: "yes"` in the document payload.
6. **Path ID Poisoning**: Creating a document with an invalid ID exceeding 128 chars or containing invalid characters.
7. **String Length Overflow (Denial of Wallet)**: Setting `backupLabel` to a 5,000-character string (exceeds `maxLength: 160`).
8. **Type Confusion Attack**: Setting `hadithCount` to a string `"100"` instead of an integer.
9. **Client Timestamp Forgery on Create**: Providing a past/future timestamp for `createdAt` instead of `request.time`.
10. **Immutable Field Mutation on Update**: Attempting to mutate `createdAt` or `ownerId` during an `update`.
11. **Client Timestamp Forgery on Update**: Updating a backup without setting `updatedAt == request.time`.
12. **Blanket Collection Listing**: Attempting an unrestricted `list` query across `/user_backups` without filtering `ownerId == request.auth.uid`.
