# V7 AI Solutions Interview Guide & Demo Walkthrough

This document is your complete cheat sheet for explaining your solution during the **V7 AI Solutions technical interview** and for recording your **demo video** (required in Section 11.2).

---

## 1. 60-Second Elevator Pitch (Memorize This!)

> *"For this assignment, I designed and built a production-grade In-App Notification Inbox service using Node.js, TypeScript, and Express.*
>
> *I followed a strict layered architecture: Controllers are kept extremely thin, handling only HTTP parsing, while all validation, authorization, and user-scoping rules live within the Service Layer.*
>
> *Security and data isolation were my top priorities: I implemented anti-IDOR protection where accessing or marking another user's notification returns a `404 Not Found` rather than a `403 Forbidden`, preventing attackers from enumerating valid IDs. For DoS prevention, pagination is mandatory and query limits are strictly capped at 50.*
>
> *Beyond the core requirements, I completed all bonus features: a bonus scoped GET endpoint, Docker containerization, interactive Swagger/OpenAPI documentation, structured JSON logging, in-memory rate limiting, a GitHub Actions CI pipeline, and a 100% passing test suite of 32 unit and integration tests."*

---

## 2. Key Architecture Concepts You Must Explain

### Concept 1: Thin Controllers vs. Service Layer
- **Question:** *"Why did you put validation and user-scoping in the Service Layer rather than the Controller?"*
- **Your Answer:**  
  *"The controller is just a presentation adaptor for the HTTP transport protocol. If we put business rules or validation inside the controller, that logic cannot be reused if we add a GraphQL API, gRPC service, WebSocket handler, or CLI command.*  
  *By placing validation, user-scoping, and authorization inside the Service layer, our core domain logic remains transport-agnostic and testable in isolation through pure unit tests."*

### Concept 2: The Anti-IDOR Defense (Why 404 instead of 403?)
- **Question:** *"Why did you return a 404 Not Found when User A tries to mark User B's notification as read, rather than a 403 Forbidden?"*
- **Your Answer:**  
  *"Returning a `403 Forbidden` indicates to the client: 'This notification exists in the database, but you don't have permission to touch it'. An attacker could use this behavior to systematically probe IDs (IDOR - Insecure Direct Object Reference) to find valid notifications belonging to other users.*  
  *Returning `404 Not Found` with an identical error message prevents information leakage. To the caller, a notification belonging to another user looks indistinguishable from a notification that does not exist at all."*

### Concept 3: Mandatory Pagination & Limit Capping
- **Question:** *"How does your pagination work, and why did you cap the limit at 50?"*
- **Your Answer:**  
  *"If an API allows unbounded listing or huge limits (e.g. `limit=10000`), a single request can consume large amounts of server memory, block the event loop, and cause a Denial of Service (DoS).*  
  *In our implementation, if a user requests `limit=100`, the service automatically caps it at `50`. It calculates offsets using `(page - 1) * limit`, sorts records newest-first based on ISO timestamp, and returns standard metadata: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, and `hasPrevPage`."*

### Concept 4: Notification Creation (Internal Function vs. Public API)
- **Question:** *"Why is there no POST /notifications endpoint?"*
- **Your Answer:**  
  *"As per the specification, notifications represent asynchronous system events (like job completion or file uploads) created by background workers—not by client browsers. Allowing a client to create notifications directly would introduce severe spoofing risks where users could inject fake notifications for other accounts.*  
  *Therefore, `createNotification` is exported as an internal service function to be called by background worker consumers. It enforces strict payload validation (rejecting empty titles or missing fields) and includes internal rate limiting to protect the system from spamming."*

---

## 3. Demo Video Step-by-Step Script (Section 11.2)

The assessment requires a short video demonstrating:
1. Listing notifications with pagination
2. Filtering notifications using `unread=true`
3. Marking a single notification as read
4. Attempting to mark another user's notification as read (showing 404)
5. Marking all notifications as read
6. Running the automated test suite showing all tests pass

### Preparation Before Recording:
Open two terminal windows:
- **Terminal 1:** Run `npm start` (or `npm run dev`)
- **Terminal 2:** For running the cURL / PowerShell commands below

### Step-by-Step Demo Flow:

#### Step 0: Seed Sample Data
```bash
npm run seed
```
*Voiceover:* "First, I'll run our seed script to populate demo notifications for Alice (`user-alice`) and Bob (`user-bob`)."

#### Step 1: Listing with Pagination
```bash
curl -X GET "http://localhost:3000/notifications?page=1&limit=2" -H "x-user-id: user-alice"
```
*Voiceover:* "Here, we query `GET /notifications` as `user-alice` with `page=1` and `limit=2`. We see only Alice's notifications, sorted newest first, with complete pagination metadata showing `totalPages`, `hasNextPage: true`, and `hasPrevPage: false`."

#### Step 2: Filtering with `unread=true`
```bash
curl -X GET "http://localhost:3000/notifications?unread=true" -H "x-user-id: user-alice"
```
*Voiceover:* "Now we query with `unread=true`. It returns all notifications where `readAt` is null."

#### Step 3: Mark a Single Notification as Read
Take the `id` of Alice's first notification (e.g. from the list above) and run:
```bash
curl -X POST "http://localhost:3000/notifications/<ALICE_NOTIFICATION_ID>/read" -H "x-user-id: user-alice"
```
*Voiceover:* "Next, we mark this notification as read using `POST /notifications/:id/read`. Notice `readAt` is now populated with the current UTC timestamp."

#### Step 4: Anti-IDOR Check (Mark Another User's Notification -> 404)
Get an ID belonging to Bob, and try to mark it as read while authenticated as Alice:
```bash
curl -X POST "http://localhost:3000/notifications/<BOB_NOTIFICATION_ID>/read" -H "x-user-id: user-alice"
```
*Voiceover:* "Here is the critical security requirement: Alice attempts to mark Bob's notification as read. The API returns `404 Not Found` with `Notification not found`. It does not return 403, completely preventing ID enumeration."

#### Step 5: Mark All Notifications as Read
```bash
curl -X POST "http://localhost:3000/notifications/read-all" -H "x-user-id: user-alice"
```
*Voiceover:* "Next, Alice calls `POST /notifications/read-all`. It marks all remaining unread notifications for Alice as read. If we inspect Bob's unread list now, Bob's notifications are completely untouched, confirming strict tenant isolation."

#### Step 6: Run the Automated Test Suite
In the terminal, run:
```bash
npm test
```
*Voiceover:* "Finally, we run our full test suite using Vitest. All 32 unit and integration tests pass cleanly in under 2 seconds, verifying edge cases, payload rejections, rate limiting, and all functional rules."

---

## 4. Likely Interview Questions & Sample Answers

### Q: "How would you handle 1,000,000 notifications in a real production environment?"
> *"In production, an in-memory store would quickly cause memory exhaustion. I would implement:*
> 1. *PostgreSQL with partitioned tables by `user_id` or timestamp.*
> 2. *Compound B-tree indexes on `(user_id, created_at DESC)` and partial indexes on `(user_id) WHERE read_at IS NULL` to make unread queries instantaneous.*
> 3. *Cursor-based (keyset) pagination instead of offset pagination (`(page-1)*limit`) to maintain constant $O(1)$ query times even on deep pages.*
> 4. *Redis caching for unread counts so the database isn't hit on every badge render.*
> 5. *Message queues (e.g. Kafka/SQS) with workers for asynchronous batch inserts."*

### Q: "Why did you choose Vitest over Jest?"
> *"Vitest has native TypeScript and ESM support out of the box using Vite's fast transformation pipeline. Unlike Jest with `ts-jest`, which requires heavy compilation overhead and Babel/CommonJS transforms, Vitest executes our 32 tests in just 1 second with a clean modern API compatible with Jest matchers."*

### Q: "What happens if a user submits an invalid query parameter, like page=-5 or limit='abc'?"
> *"The service sanitizes and validates all query inputs: `Math.floor(Number(query.page))` is evaluated; if it's `NaN` or less than 1, it safely defaults to `1`. The limit defaults to `10` and has a strict ceiling of `50`. The service guarantees it never crashes or performs invalid array slices."*

---

## 5. Ready-to-Use Postman / Swagger URL

Once the server is running (`npm start`):
- Open **http://localhost:3000/api-docs** in your browser.
- You can authorize requests directly by clicking the **Authorize** button in Swagger UI and entering `user-alice` in the `x-user-id` header!
