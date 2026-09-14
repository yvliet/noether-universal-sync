/**
 * @module UniversalSyncExtension
 * @description
 * Main entry point for the Universal External Sync community extension.
 * Provides cross-device note synchronization for Supabase, Turso, Cloudflare D1,
 * and Custom REST databases with zero user tracking and zero recurring fees.
 *
 * Technical Rationale:
 * - Local-First Guarantee: Operates strictly over local SQLite and memory caches,
 *   performing network synchronization off the main thread with debounced delta batching.
 * - Modular Provider Architecture: Seamlessly switches between Supabase PostgREST,
 *   Turso Hrana v2 pipeline, Cloudflare D1, and Custom REST without altering engine invariants.
 * - Zero Storage Bloat: Propagates deletions through lightweight tombstones with automated 30-day pruning.
 * - First-Class AI Agent Interoperability: Exposes MCP tools (`sync_now`, `get_sync_status`, `test_connection`)
 *   to in-app and external AI copilots.
 *
 * @author Yuliet Li
 * @version 1.0.0
 */

import { Extension, ExtensionManifest, McpToolResult } from 'flint';
import React from 'react';
import { z } from 'zod';
import {
  UniversalSyncConfig,
  DEFAULT_CONFIG,
  SyncTelemetry,
} from './types';
import { SyncEngine, SyncEngineState } from './engine/SyncEngine';
import { UniversalSyncSettingsTab } from './ui/UniversalSyncSettingsTab';
import { createProvider } from './providers';


export class UniversalSyncExtension extends Extension {
  private config: UniversalSyncConfig = DEFAULT_CONFIG;
  private engine!: SyncEngine;
  private statusBarUpdateFn: (() => void) | null = null;

  public async onload(): Promise<void> {
    console.log(`[UniversalSync] Initializing version ${this.manifest.version} by ${this.manifest.author}...`);

    // 1. Load persisted configuration and state
    const savedData = await this.loadData<{
      config?: UniversalSyncConfig;
      telemetry?: Partial<SyncTelemetry>;
      tombstones?: [string, number][];
      remoteToLocal?: [string, string][];
      localToRemote?: [string, string][];
    }>();

    this.config = Object.assign({}, DEFAULT_CONFIG, savedData?.config);

    // 2. Initialize the sync engine
    this.engine = new SyncEngine(
      this.app,
      this.config,
      savedData?.telemetry,
      savedData?.tombstones,
      savedData?.remoteToLocal,
      savedData?.localToRemote,
      (telemetry: SyncTelemetry) => {
        if (this.statusBarUpdateFn) {
          this.statusBarUpdateFn();
        }
      },
      async (persistedState: SyncEngineState) => {
        await this.saveData({
          config: this.config,
          telemetry: persistedState.telemetry,
          tombstones: persistedState.tombstones,
          remoteToLocal: persistedState.remoteToLocalMap,
          localToRemote: persistedState.localToRemoteMap,
        });
      }
    );

    // 3. Register Command Palette Commands
    this.addCommand({
      id: 'sync-now',
      title: 'Universal Sync: Synchronize Notes Now',
      section: 'Sync',
      hotkey: 'Ctrl+Shift+S',
      action: async (app) => {
        app.workspace.showToast('Starting cross-device sync...', 'info');
        const res = await this.engine.syncNow();
        app.workspace.showToast(res.message, res.success ? 'success' : 'warning');
      },
    });

    this.addCommand({
      id: 'test-connection',
      title: 'Universal Sync: Test Database Connection',
      section: 'Sync',
      action: async (app) => {
        const provider = createProvider(this.config);
        app.workspace.showToast('Testing database connection...', 'info');
        const res = await provider.testConnection();
        app.workspace.showToast(res.message || 'Test complete', res.success ? 'success' : 'warning');
      },
    });

    this.addCommand({
      id: 'open-sync-settings',
      title: 'Universal Sync: Open Sync Settings & Setup Wizard',
      section: 'Sync',
      action: (app) => {
        app.workspace.openSettings(`${this.manifest.id}:universal-sync`);
      },
    });

    // 4. Register Status Bar Indicator (Bottom Bar)
    this.addStatusBarItem({
      id: 'sync-status-indicator',
      alignment: 'right',
      order: 15,
      render: (app) => {
        const [telemetry, setTelemetry] = React.useState<SyncTelemetry>(this.engine.getTelemetry());

        React.useEffect(() => {
          this.statusBarUpdateFn = () => setTelemetry(this.engine.getTelemetry());
          return () => {
            this.statusBarUpdateFn = null;
          };
        }, []);

        const isSyncing = telemetry.lastStatus === 'syncing';
        const isError = telemetry.lastStatus === 'error';

        let dotColor = 'bg-emerald-400';
        let text = 'Synced';
        let textColor = 'text-[#888] hover:text-[#dcddde]';

        if (isSyncing) {
          dotColor = 'bg-amber-400';
          text = 'Syncing...';
          textColor = 'text-amber-400';
        } else if (isError) {
          dotColor = 'bg-rose-500';
          text = 'Sync Error';
          textColor = 'text-rose-400';
        }

        return React.createElement(
          'div',
          {
            className: `flex items-center gap-1.5 text-xs font-normal cursor-pointer select-none ${textColor}`,
            title: `Provider: ${this.config.activeProvider} • Click to sync now`,
            onClick: () => {
              this.engine.syncNow().then((r) => {
                app.workspace.showToast(r.message, r.success ? 'success' : 'warning');
              });
            },
          },
          React.createElement('span', { className: `w-1.5 h-1.5 rounded-full ${dotColor} shrink-0` }),
          React.createElement('span', null, text)
        );
      },
    });


    // 5. Register Settings Tab with Interactive Wizard
    this.registerSettingTab({
      id: 'universal-sync',
      name: 'Universal Sync',
      render: () => {
        return React.createElement(UniversalSyncSettingsTab, {
          app: this.app,
          config: this.config,
          engine: this.engine,
          onSaveConfig: async (newConfig: UniversalSyncConfig) => {
            this.config = newConfig;
            await this.saveData({
              config: this.config,
              telemetry: this.engine.getTelemetry(),
              tombstones: this.engine.getTombstones(),
              remoteToLocal: this.engine.getRemoteToLocalMap(),
              localToRemote: this.engine.getLocalToRemoteMap(),
            });
          },
        });
      },
    });

    // 5a. Register Omnibox Search Provider (Ctrl+P / Ctrl+K with 'sync:')
    if (typeof (this as any).registerSearchProvider === 'function') {
      (this as any).registerSearchProvider({
        id: 'sync-search',
        prefix: 'sync:',
        placeholder: 'Search sync status, provider, or trigger action...',
        search: async (query: string) => {
          const q = query.toLowerCase().trim();
          const telemetry = this.engine.getTelemetry();
          const items: any[] = [];

          if ('status'.includes(q) || 'telemetry'.includes(q) || !q) {
            items.push({
              id: 'sync:status',
              title: `Sync Status: ${telemetry.lastStatus.toUpperCase()}`,
              description: `Provider: ${this.config.activeProvider} • Synced: ${telemetry.syncedCount} docs • Conflicts: ${telemetry.conflictCount}`,
              category: 'Universal Sync',
              badge: telemetry.lastStatus,
              onSelect: () => {
                this.app.workspace.openSettings(`${this.manifest.id}:universal-sync`);
              },
            });
          }

          if ('now'.includes(q) || 'push'.includes(q) || 'pull'.includes(q) || !q) {
            items.push({
              id: 'sync:run-now',
              title: 'Trigger Immediate Sync Cycle',
              description: `Sync active vault with ${this.config.activeProvider} now`,
              category: 'Universal Sync',
              badge: 'Action',
              onSelect: () => {
                this.engine.syncNow().then((res) => {
                  this.app.workspace.showToast(res.message, res.success ? 'success' : 'warning');
                });
              },
            });
          }

          if ('test'.includes(q) || 'connection'.includes(q) || !q) {
            items.push({
              id: 'sync:test-conn',
              title: 'Test Database Connectivity',
              description: `Verify auth and latency against ${this.config.activeProvider}`,
              category: 'Universal Sync',
              badge: 'Diagnostic',
              onSelect: async () => {
                const provider = createProvider(this.config);
                this.app.workspace.showToast('Testing database connection...', 'info');
                const res = await provider.testConnection();
                this.app.workspace.showToast(res.message || 'Test complete', res.success ? 'success' : 'warning');
              },
            });
          }

          return items;
        },
      });
    }

    // 5b. Register Tab Context Menu Action (Right-click tab)
    if (typeof (this as any).registerTabContextMenuAction === 'function') {
      (this as any).registerTabContextMenuAction({
        id: 'universal-sync:sync-current-note',
        title: 'Sync Note to Cloud',
        order: 45,
        action: async (tab: any) => {
          this.app.workspace.showToast(`Syncing "${tab.title}" to ${this.config.activeProvider}...`, 'info');
          const res = await this.engine.syncNow();
          this.app.workspace.showToast(res.message, res.success ? 'success' : 'warning');
        },
      });
    }

    // 5c. Register Universal Document Title Decorator (Sync status pill in header)
    if (typeof (this as any).registerDocumentTitleDecorator === 'function') {
      (this as any).registerDocumentTitleDecorator({
        id: 'universal-sync:sync-badge',
        order: 40,
        render: (_doc: any) => {
          const telemetry = this.engine.getTelemetry();
          const isSyncing = telemetry.lastStatus === 'syncing';
          const isError = telemetry.lastStatus === 'error';
          const dotColor = isSyncing ? 'bg-amber-400 animate-pulse' : isError ? 'bg-rose-500' : 'bg-emerald-500';
          const label = isSyncing ? 'Syncing' : isError ? 'Sync Error' : 'Cloud Synced';

          return React.createElement(
            'span',
            {
              className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono select-none bg-[var(--noether-btn-hover-bg,#333)] text-[var(--noether-text-muted,#888)] border border-[var(--noether-border,#222)]',
              title: `Universal Sync: ${label} (${this.config.activeProvider})`,
            },
            React.createElement('span', { className: `w-1.5 h-1.5 rounded-full ${dotColor} shrink-0` }),
            React.createElement('span', null, this.config.activeProvider)
          );
        },
      });
    }

    // 6. Subscribe to EventBus Events for Real-Time Sync
    this.onEvent('document:saved', () => {
      this.engine.onDocumentSaved();
    });

    this.onEvent('document:deleted', ({ id }) => {
      this.engine.recordDeletion(id);
    });

    // 7. Register Model Context Protocol (MCP) AI Tools
    this.registerTool({
      name: 'sync_now',
      description: 'Triggers an immediate cross-device note synchronization cycle with the configured cloud database.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<McpToolResult> => {
        const result = await this.engine.syncNow();
        const telemetry = this.engine.getTelemetry();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.message,
                syncedItems: result.syncedCount,
                provider: this.config.activeProvider,
                lastSyncedAt: telemetry.lastSyncedAt
                  ? new Date(telemetry.lastSyncedAt).toISOString()
                  : null,
              }, null, 2),
            },
          ],
        };
      },
    });

    this.registerTool({
      name: 'get_sync_status',
      description: 'Returns the current telemetry, provider information, and synchronization status of the Universal Sync extension.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<McpToolResult> => {
        const telemetry = this.engine.getTelemetry();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                activeProvider: this.config.activeProvider,
                status: telemetry.lastStatus,
                lastSyncedAt: telemetry.lastSyncedAt
                  ? new Date(telemetry.lastSyncedAt).toISOString()
                  : null,
                totalSyncsCount: telemetry.syncedCount,
                conflictsCount: telemetry.conflictCount,
                lastError: telemetry.lastError,
                autoSyncOnSave: this.config.autoSyncOnSave,
                periodicIntervalSeconds: this.config.periodicIntervalSeconds,
              }, null, 2),
            },
          ],
        };
      },
    });

    this.registerTool({
      name: 'test_connection',
      description: 'Verifies network connectivity and table schema readiness against the configured cloud database.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (): Promise<McpToolResult> => {
        const provider = createProvider(this.config);
        const res = await provider.testConnection();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                provider: this.config.activeProvider,
                success: res.success,
                latencyMs: res.latencyMs,
                message: res.message,
              }, null, 2),
            },
          ],
          isError: !res.success,
        };
      },
    });

    // 8. Initial opportunistic sync check if credentials exist
    if (this.hasConfiguredCredentials()) {
      setTimeout(() => {
        this.engine.syncNow().catch(() => {});
      }, 3500);
    }

    console.log(`[UniversalSync] Loaded successfully. Provider: ${this.config.activeProvider}`);
  }

  public onunload(): void {
    if (this.engine) {
      this.engine.destroy();
    }
    this.statusBarUpdateFn = null;
    console.log('[UniversalSync] Unloaded cleanly.');
  }

  private hasConfiguredCredentials(): boolean {
    if (this.config.activeProvider === 'supabase') {
      return Boolean(this.config.supabase.projectUrl && this.config.supabase.anonKey);
    }
    if (this.config.activeProvider === 'turso') {
      return Boolean(this.config.turso.databaseUrl && this.config.turso.authToken);
    }
    if (this.config.activeProvider === 'cloudflare_d1') {
      return Boolean(this.config.cloudflareD1.accountId && this.config.cloudflareD1.databaseId && this.config.cloudflareD1.apiToken);
    }
    if (this.config.activeProvider === 'custom_rest') {
      return Boolean(this.config.customRest.endpointUrl);
    }
    return false;
  }
}
