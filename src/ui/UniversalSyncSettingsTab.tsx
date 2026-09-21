/**
 * @module UniversalSyncSettingsTab
 * @description
 * Clean, professional settings interface for Universal External Sync.
 * Implements Obsidian-grade design patterns using Noether native UI components.
 */

import React, { useState } from 'react';
import type { NoetherApp } from 'noether';
import {
  SettingCard,
  SettingItem,
  Button,
  TextInput,
  Toggle,
  Select,
} from 'noether';
import {
  UniversalSyncConfig,
  SyncTelemetry,
  SyncProviderType,
  ConflictStrategy,
} from '../types';
import { SyncEngine } from '../engine/SyncEngine';
import { SupabaseWizard } from './SupabaseWizard';
import { TursoProvider } from '../providers/TursoProvider';
import { CloudflareD1Provider } from '../providers/CloudflareD1Provider';
import { CustomRestProvider } from '../providers/CustomRestProvider';
import {
  RefreshIcon,
  CheckIcon,
  AlertTriangleIcon,
  CopyIcon,
  DatabaseIcon,
} from './Icons';

interface UniversalSyncSettingsTabProps {
  app: NoetherApp;
  config: UniversalSyncConfig;
  engine: SyncEngine;
  onSaveConfig: (newConfig: UniversalSyncConfig) => Promise<void>;
}

export const UniversalSyncSettingsTab: React.FC<UniversalSyncSettingsTabProps> = ({
  app,
  config: initialConfig,
  engine,
  onSaveConfig,
}) => {
  const [config, setConfig] = useState<UniversalSyncConfig>(initialConfig);
  const [telemetry, setTelemetry] = useState<SyncTelemetry>(engine.getTelemetry());
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState<string | null>(null);

  const updateConfig = async (patch: Partial<UniversalSyncConfig>) => {
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
      if (config.activeProvider === 'supabase') {
        const { SupabaseProvider } = await import('../providers/SupabaseProvider');
        const p = new SupabaseProvider(config.supabase, config.deviceId);
        result = await p.testConnection();
      } else if (config.activeProvider === 'turso') {
        const p = new TursoProvider(config.turso, config.deviceId);
        result = await p.testConnection();
      } else if (config.activeProvider === 'cloudflare_d1') {
        const p = new CloudflareD1Provider(config.cloudflareD1, config.deviceId);
        result = await p.testConnection();
      } else {
        const p = new CustomRestProvider(config.customRest, config.deviceId);
        result = await p.testConnection();
      }

      setTestResult(result);
      if (result.success) {
        app.workspace.showToast('Database connection verified successfully', 'success');
      } else {
        app.workspace.showToast(result.message || 'Connection test failed', 'warning');
      }
    } catch (e: any) {
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
        app.workspace.showToast(res.message, 'success');
      } else {
        app.workspace.showToast(res.message, 'warning');
      }
    } catch (e: any) {
      app.workspace.showToast(`Sync error: ${e?.message || String(e)}`, 'warning');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCopySchema = async (type: string, schema: string) => {
    try {
      await navigator.clipboard.writeText(schema);
      setCopiedSchema(type);
      setTimeout(() => setCopiedSchema(null), 2000);
    } catch {}
  };

  const formatLastSync = (ts: number | null): string => {
    if (!ts) return 'Never synced';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isSyncing = telemetry.lastStatus === 'syncing' || isManualSyncing;
  const isError = telemetry.lastStatus === 'error';
  const isSuccess = telemetry.lastStatus === 'success';

  return (
    <div className="flex flex-col gap-5 max-w-3xl pb-8 font-sans">
      {/* Overview Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-white mb-0.5">Universal External Sync</h3>
          <p className="text-[11px] text-[#777]">
            Synchronize your notes across devices using your personal cloud database with zero subscription fees.
          </p>
        </div>
      </div>

      {/* Group 1: Sync Status & Telemetry */}
      <SettingCard
        title="Sync Status & Telemetry"
        description="Real-time connection state, delta synchronization, and execution metrics."
      >
        <SettingItem
          name="Connection Status"
          description={
            <span className="flex items-center gap-3 mt-1 text-[11px] text-[#777]">
              <span>
                Last synced:{' '}
                <strong className="text-[#dcddde] font-medium">
                  {formatLastSync(telemetry.lastSyncedAt)}
                </strong>
              </span>
              <span>�</span>
              <span>
                Total synced:{' '}
                <strong className="text-[#dcddde] font-medium">{telemetry.syncedCount}</strong>
              </span>
              {telemetry.conflictCount > 0 && (
                <>
                  <span>�</span>
                  <span className="text-amber-400">
                    Conflicts resolved: {telemetry.conflictCount}
                  </span>
                </>
              )}
            </span>
          }
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#181818] border border-[#2a2a2a] text-xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isSyncing
                    ? 'bg-amber-400'
                    : isSuccess
                    ? 'bg-emerald-400'
                    : isError
                    ? 'bg-rose-500'
                    : 'bg-neutral-500'
                }`}
              />
              <span className="text-xs text-[#dcddde] font-medium">
                {isSyncing
                  ? 'Syncing...'
                  : isSuccess
                  ? 'Synchronized'
                  : isError
                  ? 'Sync Error'
                  : 'Ready'}
              </span>
            </div>

            <Button
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing || isTesting}
              icon={<RefreshIcon size={12} className={isSyncing ? 'animate-spin' : ''} />}
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </SettingItem>

        {testResult && (
          <div className="p-3.5 bg-[#171717] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckIcon size={14} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangleIcon size={14} className="text-rose-400 shrink-0" />
              )}
              <span className={testResult.success ? 'text-emerald-300' : 'text-rose-300'}>
                {testResult.message}
              </span>
            </div>
            {testResult.latencyMs !== undefined && (
              <span className="text-[11px] font-mono text-[#888]">{testResult.latencyMs}ms</span>
            )}
          </div>
        )}

        {telemetry.lastError && (
          <div className="p-3.5 bg-[#171717] flex items-center gap-2 text-xs text-rose-300 border-t border-[#262626]">
            <AlertTriangleIcon size={14} className="text-rose-400 shrink-0" />
            <span className="font-mono text-[11px]">{telemetry.lastError}</span>
          </div>
        )}
      </SettingCard>

      {/* Group 2: Cloud Database Provider */}
      <SettingCard
        title="Database Provider"
        description="Select and configure your cloud database storage backend."
      >
        <SettingItem
          name="Active Provider"
          description="Choose the remote database service used for syncing."
        >
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'supabase', label: 'Supabase (Free Tier)' },
                { id: 'turso', label: 'Turso libSQL' },
                { id: 'cloudflare_d1', label: 'Cloudflare D1' },
                { id: 'custom_rest', label: 'Custom REST' },
              ] as const
            ).map((prov) => {
              const isSelected = config.activeProvider === prov.id;
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => updateConfig({ activeProvider: prov.id as SyncProviderType })}
                  className={`px-2.5 py-1 text-xs rounded-[5px] border select-none ${
                    isSelected
                      ? 'bg-[var(--noether-accent,#ea580c)] border-transparent text-white font-medium'
                      : 'bg-[#181818] border-[#333] text-[#888] hover:text-white hover:border-[#444]'
                  }`}
                >
                  {prov.label}
                </button>
              );
            })}
          </div>
        </SettingItem>

        {/* Provider Specific Configuration View */}
        <div className="p-4 bg-[#1a1a1a]">
          {config.activeProvider === 'supabase' && (
            <SupabaseWizard
              projectUrl={config.supabase.projectUrl}
              anonKey={config.supabase.anonKey}
              onUpdateCredentials={(projectUrl, anonKey) =>
                updateConfig({ supabase: { ...config.supabase, projectUrl, anonKey } })
              }
              onTestConnection={handleTestConnection}
              isTesting={isTesting}
            />
          )}

          {config.activeProvider === 'turso' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Turso libSQL Configuration</h4>
                  <p className="text-[11px] text-[#777] mt-0.5">
                    Serverless SQLite at the edge with atomic batch pipelines.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    handleCopySchema(
                      'turso',
                      new TursoProvider(config.turso, 'wizard').getSchemaScript()
                    )
                  }
                  icon={copiedSchema === 'turso' ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                >
                  {copiedSchema === 'turso' ? 'Copied' : 'Copy SQL Schema'}
                </Button>
              </div>

              <div className="space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]">
                <div>
                  <label className="block text-[11px] font-normal text-[#888] mb-1">
                    Database URL
                  </label>
                  <TextInput
                    isMono
                    value={config.turso.databaseUrl}
                    onChange={(e) =>
                      updateConfig({ turso: { ...config.turso, databaseUrl: e.target.value.trim() } })
                    }
                    placeholder="libsql://your-db-org.turso.io"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-normal text-[#888] mb-1">
                    Auth Token (JWT)
                  </label>
                  <TextInput
                    isMono
                    type="password"
                    value={config.turso.authToken}
                    onChange={(e) =>
                      updateConfig({ turso: { ...config.turso, authToken: e.target.value.trim() } })
                    }
                    placeholder="eyJhbGciOiJFZERTQ..."
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {config.activeProvider === 'cloudflare_d1' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Cloudflare D1 Configuration</h4>
                  <p className="text-[11px] text-[#777] mt-0.5">
                    Serverless SQLite database integrated with Cloudflare Workers API.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    handleCopySchema(
                      'd1',
                      new CloudflareD1Provider(config.cloudflareD1, 'wizard').getSchemaScript()
                    )
                  }
                  icon={copiedSchema === 'd1' ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                >
                  {copiedSchema === 'd1' ? 'Copied' : 'Copy D1 Schema'}
                </Button>
              </div>

              <div className="space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-normal text-[#888] mb-1">
                      Account ID
                    </label>
                    <TextInput
                      isMono
                      value={config.cloudflareD1.accountId}
                      onChange={(e) =>
                        updateConfig({
                          cloudflareD1: { ...config.cloudflareD1, accountId: e.target.value.trim() },
                        })
                      }
                      placeholder="Account ID"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-normal text-[#888] mb-1">
                      Database ID
                    </label>
                    <TextInput
                      isMono
                      value={config.cloudflareD1.databaseId}
                      onChange={(e) =>
                        updateConfig({
                          cloudflareD1: { ...config.cloudflareD1, databaseId: e.target.value.trim() },
                        })
                      }
                      placeholder="Database UUID"
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-normal text-[#888] mb-1">
                    Cloudflare API Token
                  </label>
                  <TextInput
                    isMono
                    type="password"
                    value={config.cloudflareD1.apiToken}
                    onChange={(e) =>
                      updateConfig({
                        cloudflareD1: { ...config.cloudflareD1, apiToken: e.target.value.trim() },
                      })
                    }
                    placeholder="API Token with D1 edit permissions"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {config.activeProvider === 'custom_rest' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Self-Hosted REST Server Configuration</h4>
                <p className="text-[11px] text-[#777] mt-0.5">
                  Synchronize with your own private server using standard REST endpoints.
                </p>
              </div>

              <div className="space-y-3 bg-[#171717] p-3.5 rounded-lg border border-[#262626]">
                <div>
                  <label className="block text-[11px] font-normal text-[#888] mb-1">
                    Server Endpoint URL
                  </label>
                  <TextInput
                    isMono
                    value={config.customRest.endpointUrl}
                    onChange={(e) =>
                      updateConfig({
                        customRest: { ...config.customRest, endpointUrl: e.target.value.trim() },
                      })
                    }
                    placeholder="https://sync.my-server.com/api"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-normal text-[#888] mb-1">
                    Bearer Token (Optional)
                  </label>
                  <TextInput
                    isMono
                    type="password"
                    value={config.customRest.bearerToken}
                    onChange={(e) =>
                      updateConfig({
                        customRest: { ...config.customRest, bearerToken: e.target.value.trim() },
                      })
                    }
                    placeholder="Bearer authentication token"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingCard>

      {/* Group 3: Sync Automation & Behavior */}
      <SettingCard
        title="Sync Automation & Behavior"
        description="Configure automatic synchronization, background intervals, and conflict resolution."
      >
        <SettingItem
          name="Auto-Sync on Save"
          description="Automatically uploads changes 2.5 seconds after editing notes without blocking typing."
        >
          <Toggle
            checked={config.autoSyncOnSave}
            onChange={(val) => updateConfig({ autoSyncOnSave: val })}
          />
        </SettingItem>

        <SettingItem
          name="Periodic Sync Interval"
          description="Periodically checks the remote cloud database for notes edited on other devices."
        >
          <Select
            value={config.periodicIntervalSeconds}
            options={[
              { value: 0, label: 'Manual Only' },
              { value: 60, label: 'Every 1 Minute' },
              { value: 300, label: 'Every 5 Minutes (Default)' },
              { value: 900, label: 'Every 15 Minutes' },
              { value: 1800, label: 'Every 30 Minutes' },
            ]}
            onChange={(val) => updateConfig({ periodicIntervalSeconds: Number(val) })}
          />
        </SettingItem>

        <SettingItem
          name="Conflict Resolution Strategy"
          description="How to reconcile simultaneous edits on the same note across different devices."
        >
          <Select
            value={config.conflictStrategy}
            options={[
              { value: 'last_write_wins', label: 'Newer Timestamp (Last Write Wins)' },
              { value: 'keep_both', label: 'Keep Both (Create Duplicate Note)' },
              { value: 'local_wins', label: 'Local Always Wins' },
              { value: 'remote_wins', label: 'Remote Always Wins' },
            ]}
            onChange={(val) => updateConfig({ conflictStrategy: val as ConflictStrategy })}
          />
        </SettingItem>

        <SettingItem
          name="Device Identifier"
          description="Unique identifier for this machine to prevent echo sync loops."
        >
          <span className="font-mono text-xs text-[#888] bg-[#181818] px-2.5 py-1 rounded-[5px] border border-[#333] select-all">
            {config.deviceId}
          </span>
        </SettingItem>
      </SettingCard>
    </div>
  );
};
