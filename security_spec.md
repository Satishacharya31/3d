# Firebase Security Specification

## Data Invariants
1. **User Profile**: A user can only read and write their own public/private profile data. Identity/UID spoofing is blocked.
2. **Conversations**: A conversation must have an `ownerId` matching the creator's UID. Only the conversation owner has list, get, create, update, or delete privileges.
3. **Messages**: Message lists are deeply nested under their parent conversations. Reading or writing messages is permitted only if the parent conversation exists and is owned by the currently authenticated user.

## The Dirty Dozen Payloads (Test Scenarios)
1. **Identity Spoofing**: Attempt to create `/users/attacker` where `uid` points to a victim.
2. **Conversation Hijacking**: Attempt to write a conversation under `/conversations/userA` with `ownerId="attacker"`.
3. **Ghost Fields on User**: Attempt to update a user with a malicious `isVerified` boolean.
4. **Invalid User Schema**: Attempt to write a profile without the required `email` key.
5. **Giant ID Attack**: Attempting to poison paths or database records with a massive 100K string as an ID.
6. **Self-Promoted Privilege**: Attempting to set an admin/role status directly on creation.
7. **Bypassing Verification**: Writing writes while `email_verified` is false or not authenticated.
8. **Malicious Message String**: Attempting to write a message with massive text bytes (Resource denial).
9. **Relational Sync Break**: Attempting to write a message in a conversation that doesn't exist.
10. **State Shortcutting**: Attempting to update immutable tracking fields like `createdAt`.
11. **Spoofed Timestamps**: Attempting to supply a client-side timestamp instead of the authoritative `request.time`.
12. **Blanket Query Scraping**: Attempting to fetch lists without specifying an ownership filter.
