# Instructions for AI assistants

This file is for AI coding assistants (Claude Code, Codex, Cursor and similar) working in this repository.
People should start with [README.md](README.md).

## What this is

A contest voting app for company parties. One Node process serves the pages: the party landing page and photo booth
(`/`), guests' voting (`/vote`), admin (`/admin`), the big
screen (`/screen`), and the registration desk (`/checkin`, admin) with its claim page (`/claim`). State is kept in
memory and written to `data/db.json`.

| Path | What it holds |
|---|---|
| `server.js` | HTTP server, API, rules, rate limits, email queue |
| `smtp.js` | Small SMTP client for Gmail and company servers (no nodemailer) |
| `env.js` | Loads `.env`; values from the real environment win |
| `public/` | Pages and browser code. `js/common.js` has the shared live-update logic, `js/pow.js` the name-mode puzzle |
| `public/index.html`, `js/party.js`, `js/frames.js`, `css/party.css` | Landing page, photo booth and costume entries (from the "Staff Party" design); `fonts/party/` holds its fonts (OFL) |
| `docs/checkin-guide.md` | Thai guide for registration-desk staff |
| `Dockerfile`, `compose.yaml` | Container run; data in the `/data` volume |
| `scripts/smoke-test.js` | End-to-end test, including 200 simultaneous voters and email via a local Brevo stand-in |
| `scripts/mail-test.js` | Gmail/SMTP tests against local stand-in mail servers (needs `openssl`) |
| `scripts/demo.js` | Sample data on port 3456, admin password `demo` |

## Commands

```bash
npm install
node scripts/smoke-test.js     # must print ALL PASSED
node scripts/mail-test.js      # must print ALL PASSED
ADMIN_PASSWORD=... npm start   # or put settings in .env
```

Run both tests before you finish any change, and say plainly if you could not run them.

## Conventions

- Node 18 or later. Do not use APIs that need a newer Node.
- Keep runtime dependencies to the current four (`express`, `qrcode`, `@fontsource/anuphan`, `jsqr` for reading a
  card picture on phones without a built-in QR reader). Ask before adding one.
- Text users see on screen, in emails and in error messages is **Thai**. Code comments, docs and commit messages are
  **English**.
- Settings come from environment variables or `.env`. Never commit `.env` or `data/`.
- Tests must not contain real or fixed passwords; generate them at run time.
- Update `README.md` when behaviour or settings change.

## Do not undo these

Each line below fixes a real problem found by a security check. Keep it working, and keep or extend its test.

- **The server enforces every rule.** Picks per topic, closed topics, the entry method and change-of-mind are checked
  in `server.js`, never only in the browser.
- **Hidden scores stay hidden.** In "hide scores" mode, nothing a voter or the big screen receives (`/api/state`,
  `/api/screen/state`, `/api/stream`, `/api/screen/stream`) may contain vote counts.
- **Admin routes need the admin session.** Everything under `/api/admin` goes through `requireAdmin`, and state-changing
  requests the browser marks as cross-site are refused.
- **Everyone at the venue shares one IP.** Do not add per-IP lockouts that can stop real guests. Code mode lets a
  card's signed QR bypass the typed-code limiter; name mode uses a proof-of-work puzzle that gets harder instead of a
  lockout. `TRUST_PROXY` stays off unless a proxy is really in front.
- **Vote codes are long and signed.** New codes are 8 characters; QR links carry an HMAC signature.
- **Deleting codes ends their sessions.** Deleting printed codes or an email recipient also removes the voters and
  sessions made with those codes, so a lost or stolen card stops working even if someone already joined with it.
- **Sessions per voter are capped.** Each join adds a token through `addSession`, which keeps at most 10 per voter
  and drops the oldest, so joining with one valid code in a loop cannot grow `db.sessions` and `db.json` without end.
  Any new code path that creates a session must use `addSession`; bulk changes to `db.sessions` reset `sessionIdx`.
- **SMTP never sends a password or email without verified TLS.** Port 465 is TLS from the start; 587/25 must complete
  STARTTLS, or the client stops before `AUTH` and `MAIL`. Certificates are always verified (`rejectUnauthorized` is
  always true); company certificates are added with `SMTP_CA_FILE`, never by turning checks off.
- **The container is locked down.** `compose.yaml` keeps `read_only`, `cap_drop: [ALL]`, `no-new-privileges`,
  `mem_limit` and `pids_limit`; the app writes only to `/data` (and `/tmp`). The base image stays pinned by digest.
  A feature that needs to write elsewhere gets a volume, not a writable root filesystem.
- **Uploads are checked by content.** Photos must really be JPEG, PNG or WEBP; the declared type is not trusted.
- **User text is escaped** in pages and emails, line breaks are removed from email headers, and CSV cells that start
  with `=`, `+`, `-` or `@` are neutralised.
- **Desk tickets are one-time and never show a code.** The desk receives only a QR picture; a ticket is used up by the
  first claim (checked with 30 at once), expires after a minute, and is replaced by "เปลี่ยน QR".
- **Topics not yet open stay private except during the intro**, and then only the contestants already introduced
  are sent.
- **Cheers are only accepted during the intro, from joined guests, and are never written to disk.** Fixed emoji set,
  short single-line text, no links, blocked words, per-guest and room-wide limits, no sender identity sent anywhere.
- **Names given by the admin are fixed.** The server never accepts a name from a phone; a self-set name stays in that
  phone's storage.
- **Booth pictures and entries go through the server.** `/api/entries` needs a joined guest and gets the big body
  limit only after the session checks out. `/api/booth` is open to every visitor (the organisers want every sheet in
  Drive), so before reading the body it needs Drive on, refuses cross-site requests and checks the room-wide limit;
  JPEG only, checked by content. Drive uploads use a service account (`GDRIVE_KEY_FILE`, `GDRIVE_FOLDER_ID`) signed with
  node's `crypto` (no Google library); the key and folder are never sent to a page, and the key file stays out of git
  and the image (`.gitignore`, `.dockerignore`). Guest entries
  follow the admin's choice: "ขึ้นทันที" adds them to the chosen topic at once (the organisers want them on Live
  Score straight away); "รอแอดมินอนุมัติ", or no topic picked, keeps them private until approved.
- **Old card links keep working.** `/?c=…` redirects to `/vote?c=…`.
- **Pages work without the live stream.** First state comes from a plain request and pages poll when the stream is
  blocked (Cloudflare Quick Tunnels carry no Server-Sent Events).

## Limits that are accepted, not bugs

State these to users instead of hiding them:

- "No entry details" mode cannot stop repeat voting. The admin and voter pages say so.
- Name mode stops names that are not on the list but cannot stop impersonation.
- "Sent" means the mail service accepted the email, not that it reached the inbox.
- Email addresses and names are personal data stored in plain text in `data/db.json`; delete them after the event.
- Someone filming the registration desk with a script could keep claiming cards; desk staff watch for it.
- The cheer word list cannot catch every spelling; an admin watches the cheer card during the intro.
- Docker Desktop shows every phone as one address, so per-address limits count the whole room together.
- Anyone who can open the landing page can send booth pictures into the Drive folder, up to the room-wide limit.
- In "ขึ้นทันที" mode a joined guest's costume photo appears before anyone checks it; an admin removes unsuitable ones.
