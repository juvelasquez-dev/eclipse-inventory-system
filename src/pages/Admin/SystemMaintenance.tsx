import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useMaintenanceRefresh } from "../../context/MaintenanceContext";
import { fetchAdminMaintenance } from "../../lib/maintenance";
import { supabase } from "../../lib/supabase";
import {
  formatManilaTimestamp,
  fromManilaInput,
  toManilaInput,
  type AdminMaintenanceStatus,
} from "../../utils/maintenance";

export default function SystemMaintenance({ restricted = false }: { restricted?: boolean }) {
  const refreshStatus = useMaintenanceRefresh();
  const [settings, setSettings] = useState<AdminMaintenanceStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [expectedEnd, setExpectedEnd] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  const applySettings = useCallback((value: AdminMaintenanceStatus) => {
    setSettings(value);
    setEnabled(value.enabled);
    setAnnouncement(value.announcement);
    setExpectedEnd(toManilaInput(value.expected_end_at));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timerExpired = false;
    const timer = window.setTimeout(() => {
      timerExpired = true;
      controller.abort();
    }, 10000);
    void fetchAdminMaintenance(controller.signal).then((value) => {
      if (!controller.signal.aborted) {
        applySettings(value);
        setError("");
        setLoading(false);
      }
    }).catch((failure: unknown) => {
      if (controller.signal.aborted && !timerExpired) return;
      console.error("Unable to load maintenance controls:", failure);
      setError("Unable to load maintenance controls. Please retry.");
      setLoading(false);
    });
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [applySettings, reload]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || saving) return;
    setError("");
    setMessage("");
    if (Array.from(announcement).length > 500) {
      setError("The announcement must not exceed 500 characters.");
      return;
    }
    if (!settings.enabled && enabled && !window.confirm(
      "Enable maintenance? Normal application access will be interrupted."
    )) return;

    let expectedEndAt: string | null;
    try {
      expectedEndAt = expectedEnd === toManilaInput(settings.expected_end_at)
        ? settings.expected_end_at
        : fromManilaInput(expectedEnd);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Invalid expected return time.");
      return;
    }

    setSaving(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const { error: saveError } = await supabase.rpc("admin_update_system_maintenance", {
        p_enabled: enabled,
        p_announcement: announcement,
        p_expected_end_at: expectedEndAt,
        p_version: settings.version,
      }).abortSignal(controller.signal);
      if (saveError) throw saveError;
      setMessage("Maintenance settings saved.");
      setLoading(true);
      setReload((value) => value + 1);
    } catch (failure) {
      console.error("Unable to save maintenance settings:", failure);
      setError("Unable to save or confirm settings. Reload the current status before trying again.");
      setSettings(null);
    } finally {
      window.clearTimeout(timer);
      setSaving(false);
      refreshStatus();
    }
  }

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-10">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow">
        <Link to={restricted ? "/" : "/admin"} className="text-sm text-indigo-700 underline">
          {restricted ? "Back to maintenance screen" : "Back to Administration"}
        </Link>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">System Maintenance</h1>
        <p className="mt-2 text-sm text-slate-600">The announcement and expected return are visible to everyone.</p>
        {loading && <p className="mt-6" role="status">Loading maintenance settings...</p>}
        {error && <p className="mt-5 text-sm text-red-700" role="alert">{error}</p>}
        {message && <p className="mt-5 text-sm text-green-700" role="status">{message}</p>}
        {!loading && !settings && (
          <button type="button" className="mt-4 text-indigo-700 underline" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Reload settings</button>
        )}
        {!loading && settings && (
          <form onSubmit={handleSave} className="mt-6 space-y-5">
            <p className="text-sm font-semibold">Current status: {settings.enabled ? "ON" : "OFF"}</p>
            <p className="text-sm text-slate-600">
              Last updated: {formatManilaTimestamp(settings.updated_at)} (Asia/Manila)
              {settings.updated_by_username ? ` by ${settings.updated_by_username}` : ""}
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Enable maintenance mode
            </label>
            <label className="block text-sm font-medium">
              Announcement
              <textarea value={announcement} onChange={(event) => setAnnouncement(Array.from(event.target.value).slice(0, 500).join(""))} rows={4} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" />
              <span className="mt-1 block font-normal text-slate-500">{Array.from(announcement).length}/500 characters</span>
            </label>
            <label className="block text-sm font-medium">
              Expected return (Asia/Manila; optional)
              <input type="datetime-local" value={expectedEnd} onChange={(event) => setExpectedEnd(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <p className="text-sm text-slate-500">Maintenance remains active until an administrator disables it.</p>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save settings"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
