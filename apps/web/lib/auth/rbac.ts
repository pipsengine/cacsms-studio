import type { StudioRole, StudioSession } from "@/lib/auth/session";

export type Permission =
  | "lifecycle.read"
  | "lifecycle.write"
  | "lifecycle.mark-ready"
  | "lifecycle.settings"
  | "production.write"
  | "opportunity.write"
  | "knowledge.write"
  | "intelligence.write"
  | "autonomy.internal";

const rolePermissions: Record<StudioRole, Permission[]> = {
  administrator: [
    "lifecycle.read",
    "lifecycle.write",
    "lifecycle.mark-ready",
    "lifecycle.settings",
    "production.write",
    "opportunity.write",
    "knowledge.write",
    "intelligence.write",
    "autonomy.internal"
  ],
  manager: [
    "lifecycle.read",
    "lifecycle.write",
    "lifecycle.mark-ready",
    "lifecycle.settings",
    "production.write",
    "opportunity.write",
    "knowledge.write",
    "intelligence.write"
  ],
  editor: [
    "lifecycle.read",
    "lifecycle.write",
    "lifecycle.mark-ready",
    "production.write",
    "opportunity.write",
    "knowledge.write",
    "intelligence.write"
  ],
  reviewer: ["lifecycle.read", "lifecycle.mark-ready", "production.write"],
  member: ["lifecycle.read", "lifecycle.write", "production.write", "opportunity.write"],
  viewer: ["lifecycle.read"]
};

export function hasPermission(session: StudioSession | null, permission: Permission): boolean {
  if (!session) return permission === "lifecycle.read";
  return rolePermissions[session.role]?.includes(permission) ?? false;
}

export function requirePermission(session: StudioSession | null, permission: Permission): string | null {
  if (hasPermission(session, permission)) return null;
  return `Role '${session?.role ?? "anonymous"}' cannot perform '${permission}'.`;
}

export function canMarkStageReady(session: StudioSession | null): boolean {
  return hasPermission(session, "lifecycle.mark-ready");
}

export function canManageLifecycleSettings(session: StudioSession | null): boolean {
  return hasPermission(session, "lifecycle.settings");
}
