"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/providers/BaseProvider.ts
var BaseProvider;
var init_BaseProvider = __esm({
  "src/providers/BaseProvider.ts"() {
    "use strict";
    BaseProvider = class {
    };
  }
});

// src/providers/SupabaseProvider.ts
var SupabaseProvider_exports = {};
__export(SupabaseProvider_exports, {
  SupabaseProvider: () => SupabaseProvider
});
var SupabaseProvider;
var init_SupabaseProvider = __esm({
  "src/providers/SupabaseProvider.ts"() {
    "use strict";
    init_BaseProvider();
    SupabaseProvider = class extends BaseProvider {
      name = "Supabase PostgreSQL (Free Tier)";
      providerType = "supabase";
      config;
      deviceId;
      constructor(config, deviceId) {
        super();
        this.config = config;
        this.deviceId = deviceId;
      }
      getBaseUrl() {
        return (this.config.projectUrl || "").trim().replace(/\/+$/, "");
      }
      getTableName() {
        return (this.config.tableName || "flint_sync_documents").trim();
      }
      getHeaders() {
        const key = (this.config.anonKey || "").trim();
        return {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        };
      }
      async testConnection() {
        const baseUrl = this.getBaseUrl();
        const key = this.config.anonKey.trim();
        const table = this.getTableName();
        if (!baseUrl) {
          return { success: false, message: "Supabase Project URL is missing. Please enter your project URL." };
        }
        if (!key) {
          return { success: false, message: "Supabase Anon Key is missing. Please enter your API key." };
        }
        const startTime = Date.now();
        try {
          const res = await fetch(`${baseUrl}/rest/v1/${table}?select=id&limit=1`, {
            method: "GET",
            headers: this.getHeaders()
          });
          const latencyMs = Date.now() - startTime;
          if (res.ok) {
            return {
              success: true,
              latencyMs,
              message: `Connected successfully (${latencyMs}ms). Database table "${table}" is ready.`
            };
          }
          if (res.status === 404 || res.status === 400) {
            const errText = await res.text();
            if (errText.includes("relation") || errText.includes("does not exist")) {
              return {
                success: false,
                latencyMs,
                message: `Table "${table}" does not exist in Supabase yet. Please run the setup SQL in the Supabase SQL Editor.`
              };
            }
          }
          if (res.status === 401 || res.status === 403) {
            return {
              success: false,
              latencyMs,
              message: "Authentication failed (HTTP 401/403). Please verify your Supabase anon/public API key."
            };
          }
          const text = await res.text();
          return {
            success: false,
            latencyMs,
            message: `HTTP ${res.status}: ${text.slice(0, 150)}`
          };
        } catch (err) {
          const latencyMs = Date.now() - startTime;
          return {
            success: false,
            latencyMs,
            message: `Network error connecting to Supabase: ${err?.message || String(err)}`
          };
        }
      }
      async pullChanges(sinceTimestamp) {
        const baseUrl = this.getBaseUrl();
        const table = this.getTableName();
        const url = `${baseUrl}/rest/v1/${table}?select=*&updated_at=gte.${sinceTimestamp}&order=updated_at.asc&limit=1000`;
        const res = await fetch(url, {
          method: "GET",
          headers: this.getHeaders()
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed to pull changes from Supabase (${res.status}): ${errText}`);
        }
        const rows = await res.json();
        const items = [];
        const deletedIds = [];
        for (const r of rows) {
          if (r.deleted_at && Number(r.deleted_at) > 0) {
            deletedIds.push(String(r.id));
          } else {
            items.push({
              id: String(r.id),
              parent_id: r.parent_id ? String(r.parent_id) : null,
              title: String(r.title || "Untitled"),
              content_json: String(r.content_json || ""),
              is_daily_note: Number(r.is_daily_note || 0),
              is_folder: Number(r.is_folder || 0),
              is_bookmarked: Number(r.is_bookmarked || 0),
              doc_type: String(r.doc_type || "base"),
              properties: typeof r.properties === "object" ? JSON.stringify(r.properties) : String(r.properties || "{}"),
              created_at: Number(r.created_at || Date.now()),
              updated_at: Number(r.updated_at || Date.now()),
              deleted_at: r.deleted_at ? Number(r.deleted_at) : null,
              device_id: r.device_id ? String(r.device_id) : void 0
            });
          }
        }
        return {
          items,
          deletedIds,
          serverTimestamp: Date.now()
        };
      }
      async pushChanges(upserts, deletedIds) {
        const baseUrl = this.getBaseUrl();
        const table = this.getTableName();
        try {
          if (upserts.length > 0) {
            const payload = upserts.map((doc) => ({
              ...doc,
              device_id: this.deviceId,
              deleted_at: null
            }));
            const res = await fetch(`${baseUrl}/rest/v1/${table}`, {
              method: "POST",
              headers: {
                ...this.getHeaders(),
                Prefer: "resolution=merge-duplicates"
              },
              body: JSON.stringify(payload)
            });
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Error upserting notes to Supabase (${res.status}): ${errText}`);
            }
          }
          if (deletedIds.length > 0) {
            const deletePayload = deletedIds.map((id) => ({
              id,
              title: "[Deleted Note]",
              content_json: "",
              is_daily_note: 0,
              is_folder: 0,
              is_bookmarked: 0,
              doc_type: "deleted",
              properties: "{}",
              created_at: 0,
              updated_at: Date.now(),
              deleted_at: Date.now(),
              device_id: this.deviceId
            }));
            const res = await fetch(`${baseUrl}/rest/v1/${table}`, {
              method: "POST",
              headers: {
                ...this.getHeaders(),
                Prefer: "resolution=merge-duplicates"
              },
              body: JSON.stringify(deletePayload)
            });
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Error syncing deletions to Supabase (${res.status}): ${errText}`);
            }
          }
          return { success: true };
        } catch (err) {
          return { success: false, error: err?.message || String(err) };
        }
      }
      getSchemaScript() {
        const table = this.getTableName();
        return `-- 1. Create the Flint Sync Documents table
CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content_json TEXT NOT NULL DEFAULT '',
  is_daily_note INTEGER NOT NULL DEFAULT 0,
  is_folder INTEGER NOT NULL DEFAULT 0,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  doc_type TEXT NOT NULL DEFAULT 'base',
  properties TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT DEFAULT NULL,
  device_id TEXT
);

-- 2. Create performance indexes for rapid incremental delta sync
CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at);
CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted_at);

-- 3. Enable Row Level Security (RLS) and permit CRUD access for your API key
ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Flint Sync CRUD" ON ${table};
CREATE POLICY "Allow Flint Sync CRUD" ON ${table}
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;
      }
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  UniversalSyncExtension: () => UniversalSyncExtension,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/UniversalSyncExtension.tsx
var import_flint3 = require("flint");
var import_react3 = __toESM(require("react"));

// src/types.ts
var DEFAULT_CONFIG = {
  activeProvider: "supabase",
  autoSyncOnSave: true,
  periodicIntervalSeconds: 300,
  conflictStrategy: "last_write_wins",
  deviceId: `device_${Math.random().toString(36).substring(2, 10)}`,
  supabase: {
    projectUrl: "",
    anonKey: "",
    tableName: "flint_sync_documents"
  },
  turso: {
    databaseUrl: "",
    authToken: "",
    tableName: "flint_sync_documents"
  },
  cloudflareD1: {
    accountId: "",
    databaseId: "",
    apiToken: "",
    tableName: "flint_sync_documents"
  },
  customRest: {
    endpointUrl: "",
    bearerToken: "",
    customHeadersJson: "{}"
  }
};

// src/providers/index.ts
init_BaseProvider();
init_SupabaseProvider();

// src/providers/TursoProvider.ts
init_BaseProvider();
var TursoProvider = class extends BaseProvider {
  name = "Turso / libSQL Edge Database";
  providerType = "turso";
  config;
  deviceId;
  constructor(config, deviceId) {
    super();
    this.config = config;
    this.deviceId = deviceId;
  }
  getNormalizedUrl() {
    let raw = (this.config.databaseUrl || "").trim();
    if (raw.startsWith("turso://")) {
      raw = "https://" + raw.slice("turso://".length);
    } else if (raw.startsWith("libsql://")) {
      raw = "https://" + raw.slice("libsql://".length);
    }
    return raw.replace(/\/v2\/pipeline\/?$/, "").replace(/\/+$/, "");
  }
  getTableName() {
    return (this.config.tableName || "flint_sync_documents").trim();
  }
  async executePipeline(statements) {
    const baseUrl = this.getNormalizedUrl();
    const token = (this.config.authToken || "").trim();
    if (!baseUrl) throw new Error("Turso Database URL is missing.");
    if (!token) throw new Error("Turso Auth Token is missing.");
    const requests = statements.map(({ sql, args = [] }) => ({
      type: "execute",
      stmt: {
        sql,
        args: args.map((arg) => {
          if (arg === null || arg === void 0) return { type: "null" };
          if (typeof arg === "number") return { type: "integer", value: String(arg) };
          if (typeof arg === "boolean") return { type: "integer", value: arg ? "1" : "0" };
          return { type: "text", value: String(arg) };
        })
      }
    }));
    requests.push({ type: "close" });
    const res = await fetch(`${baseUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Turso HTTP error (${res.status}): ${errText}`);
    }
    const payload = await res.json();
    return payload.results || [];
  }
  async testConnection() {
    const startTime = Date.now();
    const table = this.getTableName();
    try {
      const results = await this.executePipeline([
        { sql: `SELECT COUNT(*) as count FROM ${table} LIMIT 1` }
      ]);
      const first = results[0];
      const latencyMs = Date.now() - startTime;
      if (first?.type === "error") {
        const msg = first.error?.message || "Turso error";
        if (msg.includes("no such table")) {
          return {
            success: false,
            latencyMs,
            message: `Table "${table}" does not exist in Turso yet. Please execute the setup SQL in the Turso CLI or Web Shell.`
          };
        }
        return { success: false, latencyMs, message: `Turso query error: ${msg}` };
      }
      return {
        success: true,
        latencyMs,
        message: `Connected to Turso successfully (${latencyMs}ms). Table "${table}" is operational.`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        message: `Connection failed: ${err?.message || String(err)}`
      };
    }
  }
  async pullChanges(sinceTimestamp) {
    const table = this.getTableName();
    const sql = `SELECT id, parent_id, title, content_json, is_daily_note, is_folder, is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id FROM ${table} WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT 1000`;
    const results = await this.executePipeline([{ sql, args: [sinceTimestamp] }]);
    const first = results[0];
    if (first?.type === "error") {
      throw new Error(`Turso error pulling changes: ${first.error?.message}`);
    }
    const queryResult = first?.response?.result;
    if (!queryResult || !Array.isArray(queryResult.rows)) {
      return { items: [], deletedIds: [], serverTimestamp: Date.now() };
    }
    const cols = queryResult.cols.map((c) => c.name);
    const items = [];
    const deletedIds = [];
    for (const row of queryResult.rows) {
      const record = {};
      row.forEach((cell, idx) => {
        const col = cols[idx];
        record[col] = cell && cell.type !== "null" ? cell.value : null;
      });
      if (record.deleted_at && Number(record.deleted_at) > 0) {
        deletedIds.push(String(record.id));
      } else {
        items.push({
          id: String(record.id),
          parent_id: record.parent_id ? String(record.parent_id) : null,
          title: String(record.title || "Untitled"),
          content_json: String(record.content_json || ""),
          is_daily_note: Number(record.is_daily_note || 0),
          is_folder: Number(record.is_folder || 0),
          is_bookmarked: Number(record.is_bookmarked || 0),
          doc_type: String(record.doc_type || "base"),
          properties: String(record.properties || "{}"),
          created_at: Number(record.created_at || Date.now()),
          updated_at: Number(record.updated_at || Date.now()),
          deleted_at: record.deleted_at ? Number(record.deleted_at) : null,
          device_id: record.device_id ? String(record.device_id) : void 0
        });
      }
    }
    return {
      items,
      deletedIds,
      serverTimestamp: Date.now()
    };
  }
  async pushChanges(upserts, deletedIds) {
    const table = this.getTableName();
    const statements = [];
    for (const doc of upserts) {
      const sql = `
        INSERT INTO ${table} (
          id, parent_id, title, content_json, is_daily_note, is_folder,
          is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT(id) DO UPDATE SET
          parent_id = excluded.parent_id,
          title = excluded.title,
          content_json = excluded.content_json,
          is_daily_note = excluded.is_daily_note,
          is_folder = excluded.is_folder,
          is_bookmarked = excluded.is_bookmarked,
          doc_type = excluded.doc_type,
          properties = excluded.properties,
          updated_at = excluded.updated_at,
          deleted_at = NULL,
          device_id = excluded.device_id
      `;
      statements.push({
        sql,
        args: [
          doc.id,
          doc.parent_id,
          doc.title,
          doc.content_json,
          doc.is_daily_note,
          doc.is_folder,
          doc.is_bookmarked,
          doc.doc_type,
          doc.properties,
          doc.created_at,
          doc.updated_at,
          this.deviceId
        ]
      });
    }
    const now = Date.now();
    for (const id of deletedIds) {
      const sql = `
        INSERT INTO ${table} (id, title, content_json, is_daily_note, is_folder, is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id)
        VALUES (?, '[Deleted Note]', '', 0, 0, 0, 'deleted', '{}', 0, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          deleted_at = excluded.deleted_at,
          updated_at = excluded.updated_at,
          device_id = excluded.device_id
      `;
      statements.push({ sql, args: [id, now, now, this.deviceId] });
    }
    try {
      if (statements.length > 0) {
        await this.executePipeline(statements);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }
  getSchemaScript() {
    const table = this.getTableName();
    return `-- Run this in your Turso Shell (turso db shell <database-name>):
CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content_json TEXT NOT NULL DEFAULT '',
  is_daily_note INTEGER NOT NULL DEFAULT 0,
  is_folder INTEGER NOT NULL DEFAULT 0,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  doc_type TEXT NOT NULL DEFAULT 'base',
  properties TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER DEFAULT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at);
CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted_at);
`;
  }
};

// src/providers/CloudflareD1Provider.ts
init_BaseProvider();
var CloudflareD1Provider = class extends BaseProvider {
  name = "Cloudflare D1 Database";
  providerType = "cloudflare_d1";
  config;
  deviceId;
  constructor(config, deviceId) {
    super();
    this.config = config;
    this.deviceId = deviceId;
  }
  getEndpoint() {
    const acc = (this.config.accountId || "").trim();
    const db = (this.config.databaseId || "").trim();
    return `https://api.cloudflare.com/client/v4/accounts/${acc}/d1/database/${db}/query`;
  }
  getTableName() {
    return (this.config.tableName || "flint_sync_documents").trim();
  }
  async executeQuery(sql, params = []) {
    const token = (this.config.apiToken || "").trim();
    const endpoint = this.getEndpoint();
    if (!this.config.accountId) throw new Error("Cloudflare Account ID is missing.");
    if (!this.config.databaseId) throw new Error("Cloudflare D1 Database ID is missing.");
    if (!token) throw new Error("Cloudflare API Token is missing.");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, params })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudflare D1 HTTP error (${res.status}): ${errText}`);
    }
    const payload = await res.json();
    if (!payload.success) {
      const msg = payload.errors?.[0]?.message || "Cloudflare D1 query failed";
      throw new Error(msg);
    }
    return payload.result?.[0]?.results || [];
  }
  async testConnection() {
    const startTime = Date.now();
    const table = this.getTableName();
    try {
      await this.executeQuery(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        message: `Connected to Cloudflare D1 (${latencyMs}ms). Table "${table}" is operational.`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        message: `Cloudflare D1 connection failed: ${err?.message || String(err)}`
      };
    }
  }
  async pullChanges(sinceTimestamp) {
    const table = this.getTableName();
    const sql = `SELECT id, parent_id, title, content_json, is_daily_note, is_folder, is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id FROM ${table} WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT 1000`;
    const rows = await this.executeQuery(sql, [sinceTimestamp]);
    const items = [];
    const deletedIds = [];
    for (const r of rows) {
      if (r.deleted_at && Number(r.deleted_at) > 0) {
        deletedIds.push(String(r.id));
      } else {
        items.push({
          id: String(r.id),
          parent_id: r.parent_id ? String(r.parent_id) : null,
          title: String(r.title || "Untitled"),
          content_json: String(r.content_json || ""),
          is_daily_note: Number(r.is_daily_note || 0),
          is_folder: Number(r.is_folder || 0),
          is_bookmarked: Number(r.is_bookmarked || 0),
          doc_type: String(r.doc_type || "base"),
          properties: String(r.properties || "{}"),
          created_at: Number(r.created_at || Date.now()),
          updated_at: Number(r.updated_at || Date.now()),
          deleted_at: r.deleted_at ? Number(r.deleted_at) : null,
          device_id: r.device_id ? String(r.device_id) : void 0
        });
      }
    }
    return {
      items,
      deletedIds,
      serverTimestamp: Date.now()
    };
  }
  async pushChanges(upserts, deletedIds) {
    const table = this.getTableName();
    try {
      for (const doc of upserts) {
        const sql = `
          INSERT INTO ${table} (
            id, parent_id, title, content_json, is_daily_note, is_folder,
            is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
          ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            title = excluded.title,
            content_json = excluded.content_json,
            is_daily_note = excluded.is_daily_note,
            is_folder = excluded.is_folder,
            is_bookmarked = excluded.is_bookmarked,
            doc_type = excluded.doc_type,
            properties = excluded.properties,
            updated_at = excluded.updated_at,
            deleted_at = NULL,
            device_id = excluded.device_id
        `;
        await this.executeQuery(sql, [
          doc.id,
          doc.parent_id,
          doc.title,
          doc.content_json,
          doc.is_daily_note,
          doc.is_folder,
          doc.is_bookmarked,
          doc.doc_type,
          doc.properties,
          doc.created_at,
          doc.updated_at,
          this.deviceId
        ]);
      }
      const now = Date.now();
      for (const id of deletedIds) {
        const sql = `
          INSERT INTO ${table} (id, title, content_json, is_daily_note, is_folder, is_bookmarked, doc_type, properties, created_at, updated_at, deleted_at, device_id)
          VALUES (?, '[Deleted Note]', '', 0, 0, 0, 'deleted', '{}', 0, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            deleted_at = excluded.deleted_at,
            updated_at = excluded.updated_at,
            device_id = excluded.device_id
        `;
        await this.executeQuery(sql, [id, now, now, this.deviceId]);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }
  getSchemaScript() {
    const table = this.getTableName();
    return `-- Run via wrangler d1 execute <database-name> --command="...":
CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content_json TEXT NOT NULL DEFAULT '',
  is_daily_note INTEGER NOT NULL DEFAULT 0,
  is_folder INTEGER NOT NULL DEFAULT 0,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  doc_type TEXT NOT NULL DEFAULT 'base',
  properties TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER DEFAULT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at);
CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted_at);
`;
  }
};

// src/providers/CustomRestProvider.ts
init_BaseProvider();
var CustomRestProvider = class extends BaseProvider {
  name = "Self-Hosted REST Server";
  providerType = "custom_rest";
  config;
  deviceId;
  constructor(config, deviceId) {
    super();
    this.config = config;
    this.deviceId = deviceId;
  }
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (this.config.bearerToken?.trim()) {
      headers["Authorization"] = `Bearer ${this.config.bearerToken.trim()}`;
    }
    if (this.config.customHeadersJson?.trim()) {
      try {
        const parsed = JSON.parse(this.config.customHeadersJson);
        Object.assign(headers, parsed);
      } catch {
      }
    }
    return headers;
  }
  async testConnection() {
    const endpoint = (this.config.endpointUrl || "").trim();
    if (!endpoint) {
      return { success: false, message: "REST Endpoint URL is missing." };
    }
    const startTime = Date.now();
    try {
      const url = `${endpoint.replace(/\/+$/, "")}/health`;
      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders()
      });
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `Endpoint responded successfully (${latencyMs}ms).`
        };
      }
      return {
        success: false,
        latencyMs,
        message: `HTTP ${res.status}: ${res.statusText}`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        message: `Connection failed: ${err?.message || String(err)}`
      };
    }
  }
  async pullChanges(sinceTimestamp) {
    const endpoint = this.config.endpointUrl.trim().replace(/\/+$/, "");
    const url = `${endpoint}/pull?since=${sinceTimestamp}`;
    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Custom REST pull failed (${res.status}): ${text}`);
    }
    const payload = await res.json();
    return {
      items: payload.items || [],
      deletedIds: payload.deletedIds || [],
      serverTimestamp: payload.serverTimestamp || Date.now()
    };
  }
  async pushChanges(upserts, deletedIds) {
    const endpoint = this.config.endpointUrl.trim().replace(/\/+$/, "");
    const url = `${endpoint}/push`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceId: this.deviceId,
          upserts,
          deletedIds,
          timestamp: Date.now()
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Custom REST push failed (${res.status}): ${text}`);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }
  getSchemaScript() {
    return `// Expected Custom REST API contract:
// 1. GET /health -> HTTP 200 { "status": "ok" }
// 2. GET /pull?since=<timestamp> -> HTTP 200 { "items": DocumentSyncItem[], "deletedIds": string[], "serverTimestamp": number }
// 3. POST /push -> body: { "deviceId": string, "upserts": DocumentSyncItem[], "deletedIds": string[] } -> HTTP 200 { "success": true }
`;
  }
};

// src/providers/index.ts
function createProvider(config) {
  switch (config.activeProvider) {
    case "supabase":
      return new SupabaseProvider(config.supabase, config.deviceId);
    case "turso":
      return new TursoProvider(config.turso, config.deviceId);
    case "cloudflare_d1":
      return new CloudflareD1Provider(config.cloudflareD1, config.deviceId);
    case "custom_rest":
      return new CustomRestProvider(config.customRest, config.deviceId);
    default:
      return new SupabaseProvider(config.supabase, config.deviceId);
  }
}

// src/engine/SyncEngine.ts
var SyncEngine = class {
  app;
  config;
  telemetry;
  tombstones = /* @__PURE__ */ new Map();
  remoteToLocal = /* @__PURE__ */ new Map();
  localToRemote = /* @__PURE__ */ new Map();
  isSyncing = false;
  debounceTimer = null;
  periodicTimer = null;
  onTelemetryChange;
  persistStateFn;
  constructor(app, config, initialTelemetry, initialTombstones, initialRemoteToLocal, initialLocalToRemote, onTelemetryChange, persistStateFn) {
    this.app = app;
    this.config = config;
    this.onTelemetryChange = onTelemetryChange;
    this.persistStateFn = persistStateFn;
    this.telemetry = {
      lastSyncedAt: initialTelemetry?.lastSyncedAt ?? null,
      lastStatus: initialTelemetry?.lastStatus ?? "idle",
      lastError: initialTelemetry?.lastError ?? null,
      syncedCount: initialTelemetry?.syncedCount ?? 0,
      conflictCount: initialTelemetry?.conflictCount ?? 0,
      deviceId: config.deviceId
    };
    if (initialTombstones && Array.isArray(initialTombstones)) {
      this.tombstones = new Map(initialTombstones);
    }
    if (initialRemoteToLocal && Array.isArray(initialRemoteToLocal)) {
      this.remoteToLocal = new Map(initialRemoteToLocal);
    }
    if (initialLocalToRemote && Array.isArray(initialLocalToRemote)) {
      this.localToRemote = new Map(initialLocalToRemote);
    }
    this.setupPeriodicSync();
  }
  updateConfig(newConfig) {
    this.config = newConfig;
    this.setupPeriodicSync();
  }
  getTelemetry() {
    return { ...this.telemetry };
  }
  getIsSyncing() {
    return this.isSyncing;
  }
  getTombstones() {
    return Array.from(this.tombstones.entries());
  }
  getRemoteToLocalMap() {
    return Array.from(this.remoteToLocal.entries());
  }
  getLocalToRemoteMap() {
    return Array.from(this.localToRemote.entries());
  }
  /**
   * Records a local deletion event for cross-device tombstone propagation.
   */
  recordDeletion(docId) {
    const remoteId = this.localToRemote.get(docId) || docId;
    this.tombstones.set(remoteId, Date.now());
    this.persistState();
    if (this.config.autoSyncOnSave) {
      this.triggerDebouncedSync();
    }
  }
  /**
   * Invoked when a document is saved locally in Flint.
   */
  onDocumentSaved() {
    if (this.config.autoSyncOnSave) {
      this.triggerDebouncedSync();
    }
  }
  triggerDebouncedSync() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.syncNow().catch((err) => {
        console.warn("[UniversalSync] Debounced sync failed:", err);
      });
    }, 2500);
  }
  setupPeriodicSync() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
    const intervalSec = this.config.periodicIntervalSeconds || 0;
    if (intervalSec > 0) {
      this.periodicTimer = setInterval(() => {
        this.syncNow().catch((err) => {
          console.warn("[UniversalSync] Periodic sync failed:", err);
        });
      }, intervalSec * 1e3);
    }
  }
  destroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.periodicTimer) clearInterval(this.periodicTimer);
  }
  setTelemetry(patch) {
    this.telemetry = { ...this.telemetry, ...patch };
    this.onTelemetryChange(this.telemetry);
    this.persistState();
  }
  persistState() {
    this.persistStateFn({
      telemetry: this.telemetry,
      tombstones: Array.from(this.tombstones.entries()),
      remoteToLocalMap: Array.from(this.remoteToLocal.entries()),
      localToRemoteMap: Array.from(this.localToRemote.entries())
    }).catch((e) => console.warn("[UniversalSync] State persist error:", e));
  }
  /**
   * Executes a complete bidirectional synchronization cycle.
   */
  async syncNow() {
    if (this.isSyncing) {
      return { success: false, message: "Sync is already in progress", syncedCount: 0 };
    }
    this.isSyncing = true;
    this.setTelemetry({ lastStatus: "syncing", lastError: null });
    const provider = createProvider(this.config);
    const sinceTimestamp = this.telemetry.lastSyncedAt || 0;
    const currentSyncStart = Date.now();
    let appliedCount = 0;
    let conflictCount = 0;
    try {
      const localDocs = this.app.hearth.documents || [];
      const localMap = /* @__PURE__ */ new Map();
      for (const d of localDocs) {
        localMap.set(d.id, d);
      }
      const localUpserts = [];
      for (const d of localDocs) {
        if (Number(d.updated_at || 0) >= sinceTimestamp) {
          let content = d.content_json || "";
          if (!content) {
            const fullDoc = await this.app.hearth.readDocument(d.id);
            if (fullDoc?.content_json) {
              content = fullDoc.content_json;
            }
          }
          const remoteId = this.localToRemote.get(d.id) || d.id;
          localUpserts.push({
            id: remoteId,
            parent_id: d.parent_id ? String(d.parent_id) : null,
            title: String(d.title || "Untitled"),
            content_json: content,
            is_daily_note: Number(d.is_daily_note || 0),
            is_folder: Number(d.is_folder || 0),
            is_bookmarked: Number(d.is_bookmarked || 0),
            doc_type: String(d.doc_type || "base"),
            properties: typeof d.properties === "object" ? JSON.stringify(d.properties) : String(d.properties || "{}"),
            created_at: Number(d.created_at || Date.now()),
            updated_at: Number(d.updated_at || Date.now()),
            device_id: this.config.deviceId
          });
        }
      }
      const localDeletions = [];
      for (const [id, deletedAt] of this.tombstones.entries()) {
        if (deletedAt >= sinceTimestamp) {
          localDeletions.push(id);
        }
      }
      const remotePayload = await provider.pullChanges(sinceTimestamp);
      for (const delRemoteId of remotePayload.deletedIds) {
        const localId = this.remoteToLocal.get(delRemoteId) || delRemoteId;
        if (localMap.has(localId)) {
          try {
            await this.app.hearth.deleteDocument(localId);
            this.tombstones.set(delRemoteId, Date.now());
            localMap.delete(localId);
            appliedCount++;
          } catch (e) {
            console.error(`[UniversalSync] Failed to apply remote deletion for ${delRemoteId}:`, e);
          }
        }
      }
      const remoteHandledIds = /* @__PURE__ */ new Set();
      for (const rDoc of remotePayload.items) {
        if (rDoc.device_id === this.config.deviceId && sinceTimestamp > 0) {
          continue;
        }
        remoteHandledIds.add(rDoc.id);
        const localId = this.remoteToLocal.get(rDoc.id) || rDoc.id;
        let existingLocal = localMap.get(localId);
        if (!existingLocal) {
          existingLocal = localDocs.find(
            (d) => d.title === rDoc.title && (d.parent_id || null) === (rDoc.parent_id || null)
          );
          if (existingLocal) {
            this.remoteToLocal.set(rDoc.id, existingLocal.id);
            this.localToRemote.set(existingLocal.id, rDoc.id);
          }
        }
        if (!existingLocal) {
          const createdDoc = await this.app.hearth.createNewDocument(
            rDoc.title,
            rDoc.parent_id,
            rDoc.doc_type || "base"
          );
          if (createdDoc) {
            this.remoteToLocal.set(rDoc.id, createdDoc.id);
            this.localToRemote.set(createdDoc.id, rDoc.id);
            await this.app.hearth.saveDocument(createdDoc.id, rDoc.content_json, rDoc.title);
            if (rDoc.properties) {
              try {
                const parsedProps = typeof rDoc.properties === "string" ? JSON.parse(rDoc.properties) : rDoc.properties;
                await this.app.hearth.updateDocumentProperties(createdDoc.id, parsedProps);
              } catch {
              }
            }
            appliedCount++;
          }
        } else {
          const localUpdated = Number(existingLocal.updated_at || 0);
          const remoteUpdated = Number(rDoc.updated_at || 0);
          if (localUpdated >= sinceTimestamp && localUpdated !== remoteUpdated) {
            const strategy = this.config.conflictStrategy;
            if (strategy === "keep_both") {
              conflictCount++;
              const conflictDoc = await this.app.hearth.createNewDocument(
                `[Conflict Copy] ${rDoc.title}`,
                rDoc.parent_id,
                rDoc.doc_type || "base"
              );
              if (conflictDoc) {
                await this.app.hearth.saveDocument(conflictDoc.id, rDoc.content_json, conflictDoc.title);
                appliedCount++;
              }
            } else if (strategy === "local_wins") {
              continue;
            } else if (strategy === "remote_wins" || strategy === "last_write_wins") {
              if (strategy === "remote_wins" || remoteUpdated > localUpdated) {
                await this.app.hearth.saveDocument(existingLocal.id, rDoc.content_json, rDoc.title);
                if (rDoc.properties) {
                  try {
                    const parsedProps = typeof rDoc.properties === "string" ? JSON.parse(rDoc.properties) : rDoc.properties;
                    await this.app.hearth.updateDocumentProperties(existingLocal.id, parsedProps);
                  } catch {
                  }
                }
                appliedCount++;
              }
            }
          } else if (remoteUpdated > localUpdated) {
            await this.app.hearth.saveDocument(existingLocal.id, rDoc.content_json, rDoc.title);
            if (rDoc.properties) {
              try {
                const parsedProps = typeof rDoc.properties === "string" ? JSON.parse(rDoc.properties) : rDoc.properties;
                await this.app.hearth.updateDocumentProperties(existingLocal.id, parsedProps);
              } catch {
              }
            }
            appliedCount++;
          }
        }
      }
      const toPush = localUpserts.filter((doc) => !remoteHandledIds.has(doc.id));
      if (toPush.length > 0 || localDeletions.length > 0) {
        const pushResult = await provider.pushChanges(toPush, localDeletions);
        if (!pushResult.success) {
          throw new Error(pushResult.error || "Failed to push changes to remote database");
        }
      }
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
      for (const [id, time] of this.tombstones.entries()) {
        if (time < thirtyDaysAgo) {
          this.tombstones.delete(id);
        }
      }
      const totalSynced = appliedCount + toPush.length;
      this.setTelemetry({
        lastSyncedAt: currentSyncStart,
        lastStatus: "success",
        lastError: null,
        syncedCount: this.telemetry.syncedCount + totalSynced,
        conflictCount: this.telemetry.conflictCount + conflictCount
      });
      return {
        success: true,
        message: `Sync completed successfully (${totalSynced} items synchronized).`,
        syncedCount: totalSynced
      };
    } catch (err) {
      const errMsg = err?.message || String(err);
      this.setTelemetry({
        lastStatus: "error",
        lastError: errMsg
      });
      return { success: false, message: `Sync failed: ${errMsg}`, syncedCount: 0 };
    } finally {
      this.isSyncing = false;
    }
  }
};

// src/ui/UniversalSyncSettingsTab.tsx
var import_react2 = require("react");
var import_flint2 = require("flint");

// src/ui/SupabaseWizard.tsx
var import_react = require("react");
var import_flint = require("flint");
init_SupabaseProvider();

// src/ui/Icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var RefreshIcon = ({ size = 14, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v5h-5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 21v-5h5" })
    ]
  }
);
var CheckIcon = ({ size = 14, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6 9 17l-5-5" })
  }
);
var AlertTriangleIcon = ({ size = 14, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 9v4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 17h.01" })
    ]
  }
);
var CopyIcon = ({ size = 13, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" })
    ]
  }
);
var ExternalLinkIcon = ({ size = 13, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 3h6v6" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 14 21 3" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" })
    ]
  }
);
var DatabaseIcon = ({ size = 15, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 5V19A9 3 0 0 0 21 19V5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12A9 3 0 0 0 21 12" })
    ]
  }
);
var ChevronDownIcon = ({ size = 14, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
  }
);
var ChevronUpIcon = ({ size = 14, className = "" }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "svg",
  {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m18 15-6-6-6 6" })
  }
);

// src/ui/SupabaseWizard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var SupabaseWizard = ({
  projectUrl,
  anonKey,
  onUpdateCredentials,
  onTestConnection,
  isTesting
}) => {
  const [copiedSql, setCopiedSql] = (0, import_react.useState)(false);
  const [isExpanded, setIsExpanded] = (0, import_react.useState)(!projectUrl || !anonKey);
  const provider = new SupabaseProvider({ projectUrl, anonKey }, "wizard");
  const sqlScript = provider.getSchemaScript();
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2e3);
    } catch {
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl overflow-hidden divide-y divide-[#282828]", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center justify-between p-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-8 h-8 rounded-lg bg-[#252525] border border-[#333] flex items-center justify-center text-[#34d399] shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DatabaseIcon, { size: 16 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[13px] font-medium text-white", children: "Supabase Free Tier Setup" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "px-2 py-0.5 text-[10px] font-semibold bg-[#162a20] text-[#34d399] border border-[#065f46]/60 rounded-[4px]", children: "Free Forever" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-[11px] text-[#777] mt-0.5", children: "500 MB cloud database with zero subscriptions, payment cards, or usage fees." })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          onClick: () => setIsExpanded(!isExpanded),
          className: "flint-btn text-xs py-1 px-2.5 flex items-center gap-1.5 cursor-pointer",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: isExpanded ? "Hide Steps" : "Show Setup Steps" }),
            isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronUpIcon, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDownIcon, { size: 12 })
          ]
        }
      )
    ] }),
    isExpanded && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "p-4 space-y-4 bg-[#1b1b1b]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-5 h-5 rounded-full bg-[#282828] text-[#aaa] text-[11px] flex items-center justify-center font-semibold border border-[#383838] shrink-0 mt-0.5", children: "1" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-1 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-[#dcddde] font-medium", children: "Create a free project on Supabase" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-[11px] text-[#777] leading-relaxed", children: [
            "Sign in to ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "font-mono text-[#dcddde]", children: "supabase.com" }),
            " and click",
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "New Project" }),
            ". Choose your nearest geographic region and set any secure database password."
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pt-0.5", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "a",
            {
              href: "https://supabase.com/dashboard",
              target: "_blank",
              rel: "noreferrer",
              className: "inline-flex items-center gap-1 text-xs text-[var(--flint-accent,#ea580c)] hover:underline font-medium",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Open Supabase Dashboard" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ExternalLinkIcon, { size: 11 })
              ]
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-5 h-5 rounded-full bg-[#282828] text-[#aaa] text-[11px] flex items-center justify-center font-semibold border border-[#383838] shrink-0 mt-0.5", children: "2" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-2 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-[#dcddde] font-medium", children: "Initialize Sync Schema in SQL Editor" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_flint.Button,
              {
                size: "sm",
                onClick: handleCopySql,
                icon: copiedSql ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CheckIcon, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CopyIcon, { size: 12 }),
                children: copiedSql ? "Copied to Clipboard" : "Copy SQL Script"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-[11px] text-[#777]", children: [
            "In Supabase, open ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "SQL Editor" }),
            " on the left, click ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "New query" }),
            ", paste the copied SQL, and click ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "Run" }),
            "."
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "text-[10px] font-mono bg-[#141414] p-3 rounded-[6px] border border-[#2a2a2a] text-[#888] max-h-24 overflow-y-auto select-all", children: sqlScript })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "w-5 h-5 rounded-full bg-[#282828] text-[#aaa] text-[11px] flex items-center justify-center font-semibold border border-[#383838] shrink-0 mt-0.5", children: "3" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-3 flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs text-[#dcddde] font-medium", children: "Paste Project Credentials" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "text-[11px] text-[#777] mt-0.5", children: [
              "In your Supabase project, go to ",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "Project Settings \u2192 API" }),
              ". Copy your ",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "Project URL" }),
              " and ",
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: "text-white", children: "anon public key" }),
              ":"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-2.5 bg-[#171717] p-3.5 rounded-lg border border-[#262626]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Project URL" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                import_flint.TextInput,
                {
                  isMono: true,
                  value: projectUrl,
                  onChange: (e) => onUpdateCredentials(e.target.value.trim(), anonKey),
                  placeholder: "https://xxxxxxxxxxxxxxxxxxxx.supabase.co",
                  className: "w-full"
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Anon Public API Key" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                import_flint.TextInput,
                {
                  isMono: true,
                  type: "password",
                  value: anonKey,
                  onChange: (e) => onUpdateCredentials(projectUrl, e.target.value.trim()),
                  placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  className: "w-full"
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pt-1 flex items-center justify-between", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-[10px] text-[#666]", children: "Stored locally on this device. Never uploaded to third parties." }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                import_flint.Button,
                {
                  size: "sm",
                  onClick: onTestConnection,
                  disabled: isTesting || !projectUrl || !anonKey,
                  icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RefreshIcon, { size: 12, className: isTesting ? "animate-spin" : "" }),
                  children: isTesting ? "Testing Connection..." : "Verify Connection"
                }
              )
            ] })
          ] })
        ] })
      ] })
    ] })
  ] });
};

// src/ui/UniversalSyncSettingsTab.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var UniversalSyncSettingsTab = ({
  app,
  config: initialConfig,
  engine,
  onSaveConfig
}) => {
  const [config, setConfig] = (0, import_react2.useState)(initialConfig);
  const [telemetry, setTelemetry] = (0, import_react2.useState)(engine.getTelemetry());
  const [testResult, setTestResult] = (0, import_react2.useState)(null);
  const [isTesting, setIsTesting] = (0, import_react2.useState)(false);
  const [isManualSyncing, setIsManualSyncing] = (0, import_react2.useState)(false);
  const [copiedSchema, setCopiedSchema] = (0, import_react2.useState)(null);
  const updateConfig = async (patch) => {
    const updated = { ...config, ...patch };
    setConfig(updated);
    engine.updateConfig(updated);
    await onSaveConfig(updated);
  };
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let result;
      if (config.activeProvider === "supabase") {
        const { SupabaseProvider: SupabaseProvider2 } = await Promise.resolve().then(() => (init_SupabaseProvider(), SupabaseProvider_exports));
        const p = new SupabaseProvider2(config.supabase, config.deviceId);
        result = await p.testConnection();
      } else if (config.activeProvider === "turso") {
        const p = new TursoProvider(config.turso, config.deviceId);
        result = await p.testConnection();
      } else if (config.activeProvider === "cloudflare_d1") {
        const p = new CloudflareD1Provider(config.cloudflareD1, config.deviceId);
        result = await p.testConnection();
      } else {
        const p = new CustomRestProvider(config.customRest, config.deviceId);
        result = await p.testConnection();
      }
      setTestResult(result);
      if (result.success) {
        app.workspace.showToast("Database connection verified successfully", "success");
      } else {
        app.workspace.showToast(result.message || "Connection test failed", "warning");
      }
    } catch (e) {
      setTestResult({ success: false, message: e?.message || String(e) });
    } finally {
      setIsTesting(false);
    }
  };
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await engine.syncNow();
      setTelemetry(engine.getTelemetry());
      if (res.success) {
        app.workspace.showToast(res.message, "success");
      } else {
        app.workspace.showToast(res.message, "warning");
      }
    } catch (e) {
      app.workspace.showToast(`Sync error: ${e?.message || String(e)}`, "warning");
    } finally {
      setIsManualSyncing(false);
    }
  };
  const handleCopySchema = async (type, schema) => {
    try {
      await navigator.clipboard.writeText(schema);
      setCopiedSchema(type);
      setTimeout(() => setCopiedSchema(null), 2e3);
    } catch {
    }
  };
  const formatLastSync = (ts) => {
    if (!ts) return "Never synced";
    const diff = Math.floor((Date.now() - ts) / 1e3);
    if (diff < 30) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const isSyncing = telemetry.lastStatus === "syncing" || isManualSyncing;
  const isError = telemetry.lastStatus === "error";
  const isSuccess = telemetry.lastStatus === "success";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex flex-col gap-5 max-w-3xl pb-8 font-sans", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex items-center justify-between px-1", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "text-sm font-semibold text-white mb-0.5", children: "Universal External Sync" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-[11px] text-[#777]", children: "Synchronize your notes across devices using your personal cloud database with zero subscription fees." })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      import_flint2.SettingCard,
      {
        title: "Sync Status & Telemetry",
        description: "Real-time connection state, delta synchronization, and execution metrics.",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Connection Status",
              description: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "flex items-center gap-3 mt-1 text-[11px] text-[#777]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  "Last synced:",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { className: "text-[#dcddde] font-medium", children: formatLastSync(telemetry.lastSyncedAt) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u2022" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
                  "Total synced:",
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { className: "text-[#dcddde] font-medium", children: telemetry.syncedCount })
                ] }),
                telemetry.conflictCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u2022" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "text-amber-400", children: [
                    "Conflicts resolved: ",
                    telemetry.conflictCount
                  ] })
                ] })
              ] }),
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#181818] border border-[#2a2a2a] text-xs", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "span",
                    {
                      className: `w-2 h-2 rounded-full shrink-0 ${isSyncing ? "bg-amber-400" : isSuccess ? "bg-emerald-400" : isError ? "bg-rose-500" : "bg-neutral-500"}`
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "text-xs text-[#dcddde] font-medium", children: isSyncing ? "Syncing..." : isSuccess ? "Synchronized" : isError ? "Sync Error" : "Ready" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_flint2.Button,
                  {
                    size: "sm",
                    onClick: handleTestConnection,
                    disabled: isTesting,
                    children: isTesting ? "Testing..." : "Test Connection"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_flint2.Button,
                  {
                    variant: "primary",
                    size: "sm",
                    onClick: handleManualSync,
                    disabled: isSyncing || isTesting,
                    icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RefreshIcon, { size: 12, className: isSyncing ? "animate-spin" : "" }),
                    children: isSyncing ? "Syncing..." : "Sync Now"
                  }
                )
              ] })
            }
          ),
          testResult && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "p-3.5 bg-[#171717] flex items-center justify-between text-xs", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-2", children: [
              testResult.success ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CheckIcon, { size: 14, className: "text-emerald-400 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AlertTriangleIcon, { size: 14, className: "text-rose-400 shrink-0" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: testResult.success ? "text-emerald-300" : "text-rose-300", children: testResult.message })
            ] }),
            testResult.latencyMs !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "text-[11px] font-mono text-[#888]", children: [
              testResult.latencyMs,
              "ms"
            ] })
          ] }),
          telemetry.lastError && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "p-3.5 bg-[#171717] flex items-center gap-2 text-xs text-rose-300 border-t border-[#262626]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AlertTriangleIcon, { size: 14, className: "text-rose-400 shrink-0" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-mono text-[11px]", children: telemetry.lastError })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      import_flint2.SettingCard,
      {
        title: "Database Provider",
        description: "Select and configure your cloud database storage backend.",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Active Provider",
              description: "Choose the remote database service used for syncing.",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex items-center gap-1.5", children: [
                { id: "supabase", label: "Supabase (Free Tier)" },
                { id: "turso", label: "Turso libSQL" },
                { id: "cloudflare_d1", label: "Cloudflare D1" },
                { id: "custom_rest", label: "Custom REST" }
              ].map((prov) => {
                const isSelected = config.activeProvider === prov.id;
                return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => updateConfig({ activeProvider: prov.id }),
                    className: `px-2.5 py-1 text-xs rounded-[5px] border cursor-pointer select-none ${isSelected ? "bg-[var(--flint-accent,#ea580c)] border-transparent text-white font-medium" : "bg-[#181818] border-[#333] text-[#888] hover:text-white hover:border-[#444]"}`,
                    children: prov.label
                  },
                  prov.id
                );
              }) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "p-4 bg-[#1a1a1a]", children: [
            config.activeProvider === "supabase" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              SupabaseWizard,
              {
                projectUrl: config.supabase.projectUrl,
                anonKey: config.supabase.anonKey,
                onUpdateCredentials: (projectUrl, anonKey) => updateConfig({ supabase: { ...config.supabase, projectUrl, anonKey } }),
                onTestConnection: handleTestConnection,
                isTesting
              }
            ),
            config.activeProvider === "turso" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "text-xs font-semibold text-white", children: "Turso libSQL Configuration" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-[11px] text-[#777] mt-0.5", children: "Serverless SQLite at the edge with atomic batch pipelines." })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_flint2.Button,
                  {
                    size: "sm",
                    onClick: () => handleCopySchema(
                      "turso",
                      new TursoProvider(config.turso, "wizard").getSchemaScript()
                    ),
                    icon: copiedSchema === "turso" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CheckIcon, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CopyIcon, { size: 12 }),
                    children: copiedSchema === "turso" ? "Copied" : "Copy SQL Schema"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Database URL" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_flint2.TextInput,
                    {
                      isMono: true,
                      value: config.turso.databaseUrl,
                      onChange: (e) => updateConfig({ turso: { ...config.turso, databaseUrl: e.target.value.trim() } }),
                      placeholder: "libsql://your-db-org.turso.io",
                      className: "w-full"
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Auth Token (JWT)" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_flint2.TextInput,
                    {
                      isMono: true,
                      type: "password",
                      value: config.turso.authToken,
                      onChange: (e) => updateConfig({ turso: { ...config.turso, authToken: e.target.value.trim() } }),
                      placeholder: "eyJhbGciOiJFZERTQ...",
                      className: "w-full"
                    }
                  )
                ] })
              ] })
            ] }),
            config.activeProvider === "cloudflare_d1" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "text-xs font-semibold text-white", children: "Cloudflare D1 Configuration" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-[11px] text-[#777] mt-0.5", children: "Serverless SQLite database integrated with Cloudflare Workers API." })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_flint2.Button,
                  {
                    size: "sm",
                    onClick: () => handleCopySchema(
                      "d1",
                      new CloudflareD1Provider(config.cloudflareD1, "wizard").getSchemaScript()
                    ),
                    icon: copiedSchema === "d1" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CheckIcon, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CopyIcon, { size: 12 }),
                    children: copiedSchema === "d1" ? "Copied" : "Copy D1 Schema"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Account ID" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      import_flint2.TextInput,
                      {
                        isMono: true,
                        value: config.cloudflareD1.accountId,
                        onChange: (e) => updateConfig({
                          cloudflareD1: { ...config.cloudflareD1, accountId: e.target.value.trim() }
                        }),
                        placeholder: "Account ID",
                        className: "w-full"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Database ID" }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      import_flint2.TextInput,
                      {
                        isMono: true,
                        value: config.cloudflareD1.databaseId,
                        onChange: (e) => updateConfig({
                          cloudflareD1: { ...config.cloudflareD1, databaseId: e.target.value.trim() }
                        }),
                        placeholder: "Database UUID",
                        className: "w-full"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Cloudflare API Token" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_flint2.TextInput,
                    {
                      isMono: true,
                      type: "password",
                      value: config.cloudflareD1.apiToken,
                      onChange: (e) => updateConfig({
                        cloudflareD1: { ...config.cloudflareD1, apiToken: e.target.value.trim() }
                      }),
                      placeholder: "API Token with D1 edit permissions",
                      className: "w-full"
                    }
                  )
                ] })
              ] })
            ] }),
            config.activeProvider === "custom_rest" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "text-xs font-semibold text-white", children: "Self-Hosted REST Server Configuration" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-[11px] text-[#777] mt-0.5", children: "Synchronize with your own private server using standard REST endpoints." })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Server Endpoint URL" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_flint2.TextInput,
                    {
                      isMono: true,
                      value: config.customRest.endpointUrl,
                      onChange: (e) => updateConfig({
                        customRest: { ...config.customRest, endpointUrl: e.target.value.trim() }
                      }),
                      placeholder: "https://sync.my-server.com/api",
                      className: "w-full"
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "block text-[11px] font-normal text-[#888] mb-1", children: "Bearer Token (Optional)" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_flint2.TextInput,
                    {
                      isMono: true,
                      type: "password",
                      value: config.customRest.bearerToken,
                      onChange: (e) => updateConfig({
                        customRest: { ...config.customRest, bearerToken: e.target.value.trim() }
                      }),
                      placeholder: "Bearer authentication token",
                      className: "w-full"
                    }
                  )
                ] })
              ] })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      import_flint2.SettingCard,
      {
        title: "Sync Automation & Behavior",
        description: "Configure automatic synchronization, background intervals, and conflict resolution.",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Auto-Sync on Save",
              description: "Automatically uploads changes 2.5 seconds after editing notes without blocking typing.",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_flint2.Toggle,
                {
                  checked: config.autoSyncOnSave,
                  onChange: (val) => updateConfig({ autoSyncOnSave: val })
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Periodic Sync Interval",
              description: "Periodically checks the remote cloud database for notes edited on other devices.",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_flint2.Select,
                {
                  value: config.periodicIntervalSeconds,
                  options: [
                    { value: 0, label: "Manual Only" },
                    { value: 60, label: "Every 1 Minute" },
                    { value: 300, label: "Every 5 Minutes (Default)" },
                    { value: 900, label: "Every 15 Minutes" },
                    { value: 1800, label: "Every 30 Minutes" }
                  ],
                  onChange: (val) => updateConfig({ periodicIntervalSeconds: Number(val) })
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Conflict Resolution Strategy",
              description: "How to reconcile simultaneous edits on the same note across different devices.",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_flint2.Select,
                {
                  value: config.conflictStrategy,
                  options: [
                    { value: "last_write_wins", label: "Newer Timestamp (Last Write Wins)" },
                    { value: "keep_both", label: "Keep Both (Create Duplicate Note)" },
                    { value: "local_wins", label: "Local Always Wins" },
                    { value: "remote_wins", label: "Remote Always Wins" }
                  ],
                  onChange: (val) => updateConfig({ conflictStrategy: val })
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_flint2.SettingItem,
            {
              name: "Device Identifier",
              description: "Unique identifier for this machine to prevent echo sync loops.",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "font-mono text-xs text-[#888] bg-[#181818] px-2.5 py-1 rounded-[5px] border border-[#333] select-all", children: config.deviceId })
            }
          )
        ]
      }
    )
  ] });
};

// src/UniversalSyncExtension.tsx
var UniversalSyncExtension = class extends import_flint3.Extension {
  config = DEFAULT_CONFIG;
  engine;
  statusBarUpdateFn = null;
  async onload() {
    console.log(`[UniversalSync] Initializing version ${this.manifest.version} by ${this.manifest.author}...`);
    const savedData = await this.loadData();
    this.config = Object.assign({}, DEFAULT_CONFIG, savedData?.config);
    this.engine = new SyncEngine(
      this.app,
      this.config,
      savedData?.telemetry,
      savedData?.tombstones,
      savedData?.remoteToLocal,
      savedData?.localToRemote,
      (telemetry) => {
        if (this.statusBarUpdateFn) {
          this.statusBarUpdateFn();
        }
      },
      async (persistedState) => {
        await this.saveData({
          config: this.config,
          telemetry: persistedState.telemetry,
          tombstones: persistedState.tombstones,
          remoteToLocal: persistedState.remoteToLocalMap,
          localToRemote: persistedState.localToRemoteMap
        });
      }
    );
    this.addCommand({
      id: "sync-now",
      title: "Universal Sync: Synchronize Notes Now",
      section: "Sync",
      hotkey: "Ctrl+Shift+S",
      action: async (app) => {
        app.workspace.showToast("Starting cross-device sync...", "info");
        const res = await this.engine.syncNow();
        app.workspace.showToast(res.message, res.success ? "success" : "warning");
      }
    });
    this.addCommand({
      id: "test-connection",
      title: "Universal Sync: Test Database Connection",
      section: "Sync",
      action: async (app) => {
        const provider = createProvider(this.config);
        app.workspace.showToast("Testing database connection...", "info");
        const res = await provider.testConnection();
        app.workspace.showToast(res.message || "Test complete", res.success ? "success" : "warning");
      }
    });
    this.addCommand({
      id: "open-sync-settings",
      title: "Universal Sync: Open Sync Settings & Setup Wizard",
      section: "Sync",
      action: (app) => {
        app.workspace.openSettings(`${this.manifest.id}:universal-sync`);
      }
    });
    this.addStatusBarItem({
      id: "sync-status-indicator",
      alignment: "right",
      order: 15,
      render: (app) => {
        const [telemetry, setTelemetry] = import_react3.default.useState(this.engine.getTelemetry());
        import_react3.default.useEffect(() => {
          this.statusBarUpdateFn = () => setTelemetry(this.engine.getTelemetry());
          return () => {
            this.statusBarUpdateFn = null;
          };
        }, []);
        const isSyncing = telemetry.lastStatus === "syncing";
        const isError = telemetry.lastStatus === "error";
        let dotColor = "bg-emerald-400";
        let text = "Synced";
        let textColor = "text-[#888] hover:text-[#dcddde]";
        if (isSyncing) {
          dotColor = "bg-amber-400";
          text = "Syncing...";
          textColor = "text-amber-400";
        } else if (isError) {
          dotColor = "bg-rose-500";
          text = "Sync Error";
          textColor = "text-rose-400";
        }
        return import_react3.default.createElement(
          "div",
          {
            className: `flex items-center gap-1.5 text-xs font-normal cursor-pointer select-none ${textColor}`,
            title: `Provider: ${this.config.activeProvider} \u2022 Click to sync now`,
            onClick: () => {
              this.engine.syncNow().then((r) => {
                app.workspace.showToast(r.message, r.success ? "success" : "warning");
              });
            }
          },
          import_react3.default.createElement("span", { className: `w-1.5 h-1.5 rounded-full ${dotColor} shrink-0` }),
          import_react3.default.createElement("span", null, text)
        );
      }
    });
    this.registerSettingTab({
      id: "universal-sync",
      name: "Universal Sync",
      render: () => {
        return import_react3.default.createElement(UniversalSyncSettingsTab, {
          app: this.app,
          config: this.config,
          engine: this.engine,
          onSaveConfig: async (newConfig) => {
            this.config = newConfig;
            await this.saveData({
              config: this.config,
              telemetry: this.engine.getTelemetry(),
              tombstones: this.engine.getTombstones(),
              remoteToLocal: this.engine.getRemoteToLocalMap(),
              localToRemote: this.engine.getLocalToRemoteMap()
            });
          }
        });
      }
    });
    if (typeof this.registerSearchProvider === "function") {
      this.registerSearchProvider({
        id: "sync-search",
        prefix: "sync:",
        placeholder: "Search sync status, provider, or trigger action...",
        search: async (query) => {
          const q = query.toLowerCase().trim();
          const telemetry = this.engine.getTelemetry();
          const items = [];
          if ("status".includes(q) || "telemetry".includes(q) || !q) {
            items.push({
              id: "sync:status",
              title: `Sync Status: ${telemetry.lastStatus.toUpperCase()}`,
              description: `Provider: ${this.config.activeProvider} \u2022 Synced: ${telemetry.syncedCount} docs \u2022 Conflicts: ${telemetry.conflictCount}`,
              category: "Universal Sync",
              badge: telemetry.lastStatus,
              onSelect: () => {
                this.app.workspace.openSettings(`${this.manifest.id}:universal-sync`);
              }
            });
          }
          if ("now".includes(q) || "push".includes(q) || "pull".includes(q) || !q) {
            items.push({
              id: "sync:run-now",
              title: "Trigger Immediate Sync Cycle",
              description: `Sync active vault with ${this.config.activeProvider} now`,
              category: "Universal Sync",
              badge: "Action",
              onSelect: () => {
                this.engine.syncNow().then((res) => {
                  this.app.workspace.showToast(res.message, res.success ? "success" : "warning");
                });
              }
            });
          }
          if ("test".includes(q) || "connection".includes(q) || !q) {
            items.push({
              id: "sync:test-conn",
              title: "Test Database Connectivity",
              description: `Verify auth and latency against ${this.config.activeProvider}`,
              category: "Universal Sync",
              badge: "Diagnostic",
              onSelect: async () => {
                const provider = createProvider(this.config);
                this.app.workspace.showToast("Testing database connection...", "info");
                const res = await provider.testConnection();
                this.app.workspace.showToast(res.message || "Test complete", res.success ? "success" : "warning");
              }
            });
          }
          return items;
        }
      });
    }
    if (typeof this.registerTabContextMenuAction === "function") {
      this.registerTabContextMenuAction({
        id: "universal-sync:sync-current-note",
        title: "Sync Note to Cloud",
        order: 45,
        action: async (tab) => {
          this.app.workspace.showToast(`Syncing "${tab.title}" to ${this.config.activeProvider}...`, "info");
          const res = await this.engine.syncNow();
          this.app.workspace.showToast(res.message, res.success ? "success" : "warning");
        }
      });
    }
    if (typeof this.registerDocumentTitleDecorator === "function") {
      this.registerDocumentTitleDecorator({
        id: "universal-sync:sync-badge",
        order: 40,
        render: (_doc) => {
          const telemetry = this.engine.getTelemetry();
          const isSyncing = telemetry.lastStatus === "syncing";
          const isError = telemetry.lastStatus === "error";
          const dotColor = isSyncing ? "bg-amber-400 animate-pulse" : isError ? "bg-rose-500" : "bg-emerald-500";
          const label = isSyncing ? "Syncing" : isError ? "Sync Error" : "Cloud Synced";
          return import_react3.default.createElement(
            "span",
            {
              className: "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono select-none bg-[var(--noether-btn-hover-bg,#333)] text-[var(--noether-text-muted,#888)] border border-[var(--noether-border,#222)]",
              title: `Universal Sync: ${label} (${this.config.activeProvider})`
            },
            import_react3.default.createElement("span", { className: `w-1.5 h-1.5 rounded-full ${dotColor} shrink-0` }),
            import_react3.default.createElement("span", null, this.config.activeProvider)
          );
        }
      });
    }
    this.onEvent("document:saved", () => {
      this.engine.onDocumentSaved();
    });
    this.onEvent("document:deleted", ({ id }) => {
      this.engine.recordDeletion(id);
    });
    this.registerTool({
      name: "sync_now",
      description: "Triggers an immediate cross-device note synchronization cycle with the configured cloud database.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      },
      handler: async () => {
        const result = await this.engine.syncNow();
        const telemetry = this.engine.getTelemetry();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: result.success,
                message: result.message,
                syncedItems: result.syncedCount,
                provider: this.config.activeProvider,
                lastSyncedAt: telemetry.lastSyncedAt ? new Date(telemetry.lastSyncedAt).toISOString() : null
              }, null, 2)
            }
          ]
        };
      }
    });
    this.registerTool({
      name: "get_sync_status",
      description: "Returns the current telemetry, provider information, and synchronization status of the Universal Sync extension.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      },
      handler: async () => {
        const telemetry = this.engine.getTelemetry();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                activeProvider: this.config.activeProvider,
                status: telemetry.lastStatus,
                lastSyncedAt: telemetry.lastSyncedAt ? new Date(telemetry.lastSyncedAt).toISOString() : null,
                totalSyncsCount: telemetry.syncedCount,
                conflictsCount: telemetry.conflictCount,
                lastError: telemetry.lastError,
                autoSyncOnSave: this.config.autoSyncOnSave,
                periodicIntervalSeconds: this.config.periodicIntervalSeconds
              }, null, 2)
            }
          ]
        };
      }
    });
    this.registerTool({
      name: "test_connection",
      description: "Verifies network connectivity and table schema readiness against the configured cloud database.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      },
      handler: async () => {
        const provider = createProvider(this.config);
        const res = await provider.testConnection();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                provider: this.config.activeProvider,
                success: res.success,
                latencyMs: res.latencyMs,
                message: res.message
              }, null, 2)
            }
          ],
          isError: !res.success
        };
      }
    });
    if (this.hasConfiguredCredentials()) {
      setTimeout(() => {
        this.engine.syncNow().catch(() => {
        });
      }, 3500);
    }
    console.log(`[UniversalSync] Loaded successfully. Provider: ${this.config.activeProvider}`);
  }
  onunload() {
    if (this.engine) {
      this.engine.destroy();
    }
    this.statusBarUpdateFn = null;
    console.log("[UniversalSync] Unloaded cleanly.");
  }
  hasConfiguredCredentials() {
    if (this.config.activeProvider === "supabase") {
      return Boolean(this.config.supabase.projectUrl && this.config.supabase.anonKey);
    }
    if (this.config.activeProvider === "turso") {
      return Boolean(this.config.turso.databaseUrl && this.config.turso.authToken);
    }
    if (this.config.activeProvider === "cloudflare_d1") {
      return Boolean(this.config.cloudflareD1.accountId && this.config.cloudflareD1.databaseId && this.config.cloudflareD1.apiToken);
    }
    if (this.config.activeProvider === "custom_rest") {
      return Boolean(this.config.customRest.endpointUrl);
    }
    return false;
  }
};

// src/index.ts
var index_default = UniversalSyncExtension;
