"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Settings2 } from "lucide-react";

export function ProductionDefaultsPage() {
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/production-lifecycle")
      .then((response) => response.json())
      .then((payload) => setAutoAdvance(Boolean(payload.settings?.autoAdvance)))
      .catch(() => setMessage("Unable to load lifecycle settings."));
  }, []);

  async function save(nextValue: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/production-lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAdvance: nextValue })
      });
      if (!response.ok) throw new Error("save failed");
      setAutoAdvance(nextValue);
      setMessage("Lifecycle settings saved.");
    } catch {
      setMessage("Unable to save lifecycle settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Settings / Production Defaults</span>
        <h2>Production lifecycle defaults</h2>
        <p>Configure autonomous advancement, governance, and lifecycle routing for the studio.</p>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <h3>Auto-Advance</h3>
          <p className="muted">When enabled, the lifecycle advances to the next stage after required checks pass.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <input
              type="checkbox"
              checked={autoAdvance}
              disabled={saving}
              onChange={(event) => save(event.target.checked)}
            />
            <span>{autoAdvance ? "Auto-advance enabled" : "Manual advancement required"}</span>
          </label>
          {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
        </article>

        <article className="card">
          <h3>Lifecycle entry points</h3>
          <div className="grid" style={{ marginTop: 14 }}>
            <Link className="button" href="/production-workflow/discover">
              <Settings2 size={16} aria-hidden="true" />
              Production Life Cycle
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button" href="/dashboard">
              Executive Dashboard
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
