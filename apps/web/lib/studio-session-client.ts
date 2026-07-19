/**
 * Ensures the browser has a valid studio session cookie before mutation APIs run.
 * GET /api/auth/session auto-bootstraps when no cookie exists.
 */
export async function ensureStudioSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { session?: unknown | null };
    return Boolean(payload.session);
  } catch {
    return false;
  }
}

export async function ensureStudioSessionForMutation(): Promise<void> {
  const ready = await ensureStudioSession();
  if (!ready) {
    throw new Error("Authentication required. Reload the studio to bootstrap a session.");
  }
}
