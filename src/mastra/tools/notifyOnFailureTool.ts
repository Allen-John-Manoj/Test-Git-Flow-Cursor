import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE_ROOT =
  process.env.REPL_HOME || process.env.HOME || "/home/runner/workspace";
const STATE_FILE = path.join(WORKSPACE_ROOT, ".error-resolution-state.json");
const NOTIFICATIONS_FILE = path.join(
  WORKSPACE_ROOT,
  ".error-notifications.json",
);

interface StateData {
  lastCheckedTimestamp: string | null;
  resolvedErrors: Array<{
    errorType: string;
    resolvedAt: string;
    action: string;
  }>;
  failedErrors: Array<{
    errorType: string;
    failedAt: string;
    reason: string;
  }>;
  stats: {
    totalDetected: number;
    totalResolved: number;
    totalFailed: number;
  };
}

function loadState(): StateData {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {
    lastCheckedTimestamp: null,
    resolvedErrors: [],
    failedErrors: [],
    stats: { totalDetected: 0, totalResolved: 0, totalFailed: 0 },
  };
}

function saveState(state: StateData): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

interface Notification {
  errorType: string;
  message: string;
  severity: string;
  notifiedAt: string;
  requiresManualIntervention: boolean;
}

function loadNotifications(): Notification[] {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const raw = fs.readFileSync(NOTIFICATIONS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

function saveNotifications(notifications: Notification[]): void {
  fs.writeFileSync(
    NOTIFICATIONS_FILE,
    JSON.stringify(notifications, null, 2),
    "utf-8",
  );
}

const SEVERITY_MAP: Record<string, string> = {
  AuthenticationError: "CRITICAL",
  PermissionDenied: "HIGH",
  NullPointerException: "MEDIUM",
  ConnectionTimeoutError: "MEDIUM",
  OutOfMemoryError: "HIGH",
  FileNotFoundException: "LOW",
  UnknownError: "MEDIUM",
};

export const notifyOnFailureTool = createTool({
  id: "notify-on-failure",
  description:
    "Logs a notification for errors that cannot be automatically resolved and require manual intervention",
  inputSchema: z.object({
    timestamp: z.string(),
    errorType: z.string(),
    message: z.string(),
    isAutomatedFixPossible: z.boolean(),
  }),
  outputSchema: z.object({
    notified: z.boolean(),
    errorType: z.string(),
    severity: z.string(),
    notificationMessage: z.string(),
    notifiedAt: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info(
      `🔔 [notifyOnFailureTool] Creating notification for: ${context.errorType}`,
    );

    const severity = SEVERITY_MAP[context.errorType] || "MEDIUM";
    const notifiedAt = new Date().toISOString();

    const notificationMessage = `[${severity}] Manual intervention required for ${context.errorType}: ${context.message}. Automated fix is not available for this error type. Please review and resolve manually.`;

    logger?.info(
      `📢 [notifyOnFailureTool] Severity: ${severity}`,
    );
    logger?.info(
      `📢 [notifyOnFailureTool] Notification: ${notificationMessage}`,
    );

    const notification: Notification = {
      errorType: context.errorType,
      message: context.message,
      severity,
      notifiedAt,
      requiresManualIntervention: true,
    };

    const notifications = loadNotifications();
    notifications.push(notification);

    if (notifications.length > 200) {
      notifications.splice(0, notifications.length - 200);
    }
    saveNotifications(notifications);

    const state = loadState();
    state.failedErrors.push({
      errorType: context.errorType,
      failedAt: notifiedAt,
      reason: "No automated resolution available - requires manual intervention",
    });
    state.stats.totalFailed += 1;

    if (state.failedErrors.length > 100) {
      state.failedErrors = state.failedErrors.slice(-100);
    }
    saveState(state);

    logger?.info(
      `✅ [notifyOnFailureTool] Notification logged for: ${context.errorType}`,
    );

    return {
      notified: true,
      errorType: context.errorType,
      severity,
      notificationMessage,
      notifiedAt,
    };
  },
});
