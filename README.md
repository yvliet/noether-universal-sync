# Universal External Sync for Noether

Cross-device note synchronization extension supporting Supabase, Turso, Cloudflare D1, and Custom REST backends.

---

## 1. Overview & User Experience

Keep your notes and SQLite metadata synchronized seamlessly across all your desktop and mobile devices without proprietary vendor lock-in.

**Universal Sync** allows you to connect your own cloud database (Supabase PostgreSQL, Turso libSQL, Cloudflare D1, or custom REST servers) to securely sync files, note revisions, and relational index data with end-to-end encryption.

### Where It Lives in Noether
- **Status Bar**: A sync status indicator shows current replication state (idle, syncing, or offline).
- **Settings Window**: Configure backend credentials and sync intervals under **Settings** (`Ctrl+,`) → **Universal Sync**.

## 2. Features & Step-by-Step Guide

### 1. Configuring Your Backend
1. Open **Settings** (`Ctrl+,`) → **Universal Sync**.
2. Select your sync provider (e.g. **Supabase**, **Turso**, **Cloudflare D1**, or **Custom REST**).
3. Enter your database endpoint and API authentication token.
4. Click **Test Connection** to verify database connectivity.

### 2. Automatic and Manual Sync
- Automatic sync triggers on file save with debounced background replication.
- Click the sync indicator in the status bar at any time to trigger an immediate pull/push synchronization.

## 3. Architecture & SDK Blueprint (For Extension Builders)

Universal Sync demonstrates how to implement background synchronization adapters, handle conflict resolution, and surface status-bar indicators via the Noether SDK.

### SDK Extension Points Used
- `this.addStatusBarItem()`: Displays live sync state and triggers manual sync cycles.
- `this.onEvent('document:saved')`: Subscribes to local note modification events.
- `this.app.vault.saveDocument()`: Applies remote changes to local vault files atomically.

## 4. Development & Local Building

To build and test this community extension locally:

```bash
git clone https://github.com/yvliet/noether-universal-sync.git
cd noether-universal-sync
npm install
npm run build
```

Copy the compiled bundle `dist/main.js` and `manifest.json` into your vault's `.noether/extensions/noether-universal-sync/` directory and reload Noether.

## 5. License

MIT © [Yuliet Li](https://github.com/yvliet)
