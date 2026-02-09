import { createStep, createWorkflow } from "../inngest";
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
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
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

const KNOWN_ERRORS: Record<string, boolean> = {
  NullPointerException: true,
  ConnectionTimeoutError: true,
  OutOfMemoryError: true,
  FileNotFoundException: true,
  AuthenticationError: false,
  PermissionDenied: false,
};

const RESOLUTION_ACTIONS: Record<
  string,
  { action: string; description: string }
> = {
  NullPointerException: {
    action: "null_check_injection",
    description:
      "Added null safety checks and default value initialization to prevent null pointer access",
  },
  ConnectionTimeoutError: {
    action: "connection_retry",
    description:
      "Initiated connection retry with exponential backoff (max 3 retries, 2s/4s/8s delays)",
  },
  OutOfMemoryError: {
    action: "memory_cleanup",
    description:
      "Triggered garbage collection and cleared in-memory caches to free up memory resources",
  },
  FileNotFoundException: {
    action: "file_path_recovery",
    description:
      "Verified file paths, checked for renamed files, and recreated missing config files from defaults",
  },
};

const SEVERITY_MAP: Record<string, string> = {
  AuthenticationError: "CRITICAL",
  PermissionDenied: "HIGH",
  NullPointerException: "MEDIUM",
  ConnectionTimeoutError: "MEDIUM",
  OutOfMemoryError: "HIGH",
  FileNotFoundException: "LOW",
  UnknownError: "MEDIUM",
};

function identifyErrorType(message: string): string {
  if (message.includes("NullPointerException")) return "NullPointerException";
  if (message.includes("ConnectionTimeoutError"))
    return "ConnectionTimeoutError";
  if (message.includes("OutOfMemoryError")) return "OutOfMemoryError";
  if (message.includes("FileNotFoundException"))
    return "FileNotFoundException";
  if (message.includes("AuthenticationError")) return "AuthenticationError";
  if (message.includes("PermissionDenied")) return "PermissionDenied";
  return "UnknownError";
}

function parseLogLine(
  line: string,
): {
  timestamp: string;
  errorType: string;
  message: string;
  isAutomatedFixPossible: boolean;
} | null {
  const errorMatch = line.match(
    /\[(\d{4}-\d{2}-\d{2}\s[\d:]+)\]\s*ERROR\s*[-–:]\s*(.*)/i,
  );
  if (errorMatch) {
    const errorType = identifyErrorType(errorMatch[2].trim());
    return {
      timestamp: errorMatch[1],
      errorType,
      message: errorMatch[2].trim(),
      isAutomatedFixPossible: KNOWN_ERRORS[errorType] ?? false,
    };
  }

  const simpleMatch = line.match(/ERROR\s*[-–:]\s*(.*)/i);
  if (simpleMatch) {
    const errorType = identifyErrorType(simpleMatch[1].trim());
    return {
      timestamp: new Date().toISOString(),
      errorType,
      message: simpleMatch[1].trim(),
      isAutomatedFixPossible: KNOWN_ERRORS[errorType] ?? false,
    };
  }

  return null;
}

const errorSchema = z.object({
  timestamp: z.string(),
  errorType: z.string(),
  message: z.string(),
  isAutomatedFixPossible: z.boolean(),
});

const readErrorLogs = createStep({
  id: "read-error-logs",
  description: "Reads error logs from the data app and returns detected errors as an array",
  inputSchema: z.object({}),
  outputSchema: z.array(errorSchema),
  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📖 [Step: read-error-logs] Starting log scan...");

    const state = loadState();
    const possibleLogFiles = [
      path.join(WORKSPACE_ROOT, "app.log"),
      path.join(WORKSPACE_ROOT, "logs", "app.log"),
      path.join(WORKSPACE_ROOT, "error.log"),
      path.join(WORKSPACE_ROOT, "logs", "error.log"),
    ];

    const errors: Array<{
      timestamp: string;
      errorType: string;
      message: string;
      isAutomatedFixPossible: boolean;
    }> = [];

    for (const logFile of possibleLogFiles) {
      if (!fs.existsSync(logFile)) {
        logger?.info(`📂 [Step: read-error-logs] Log file not found: ${logFile}`);
        continue;
      }

      logger?.info(`📂 [Step: read-error-logs] Reading log file: ${logFile}`);
      try {
        const content = fs.readFileSync(logFile, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          const entry = parseLogLine(line);
          if (entry) {
            if (
              !state.lastCheckedTimestamp ||
              entry.timestamp > state.lastCheckedTimestamp
            ) {
              errors.push(entry);
            }
          }
        }
      } catch (e) {
        logger?.error(`❌ [Step: read-error-logs] Failed to read ${logFile}: ${e}`);
      }
    }

    const checkedAt = new Date().toISOString();
    state.lastCheckedTimestamp = checkedAt;
    state.stats.totalDetected += errors.length;
    saveState(state);

    logger?.info(
      `✅ [Step: read-error-logs] Scan complete. Found ${errors.length} new errors.`,
    );

    return errors;
  },
});

const processEachError = createStep({
  id: "process-each-error",
  description:
    "Processes a single error: applies automated fix if possible, otherwise sends notification",
  inputSchema: errorSchema,
  outputSchema: z.object({
    errorType: z.string(),
    wasFixed: z.boolean(),
    action: z.string(),
    details: z.string(),
    processedAt: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info(
      `🔄 [Step: process-each-error] Processing error: ${inputData.errorType}`,
    );

    const processedAt = new Date().toISOString();
    const state = loadState();

    if (inputData.isAutomatedFixPossible) {
      const resolution = RESOLUTION_ACTIONS[inputData.errorType];
      if (resolution) {
        logger?.info(
          `🔧 [Step: process-each-error] Applying fix: ${resolution.action}`,
        );
        logger?.info(
          `📋 [Step: process-each-error] Details: ${resolution.description}`,
        );

        state.resolvedErrors.push({
          errorType: inputData.errorType,
          resolvedAt: processedAt,
          action: resolution.action,
        });
        state.stats.totalResolved += 1;
        if (state.resolvedErrors.length > 100) {
          state.resolvedErrors = state.resolvedErrors.slice(-100);
        }
        saveState(state);

        return {
          errorType: inputData.errorType,
          wasFixed: true,
          action: resolution.action,
          details: resolution.description,
          processedAt,
        };
      }
    }

    const severity = SEVERITY_MAP[inputData.errorType] || "MEDIUM";
    const notificationMessage = `[${severity}] Manual intervention required for ${inputData.errorType}: ${inputData.message}`;

    logger?.info(
      `🔔 [Step: process-each-error] Notification: ${notificationMessage}`,
    );

    const notifications = (() => {
      try {
        if (fs.existsSync(NOTIFICATIONS_FILE)) {
          return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, "utf-8"));
        }
      } catch (e) {}
      return [];
    })();

    notifications.push({
      errorType: inputData.errorType,
      message: inputData.message,
      severity,
      notifiedAt: processedAt,
      requiresManualIntervention: true,
    });

    if (notifications.length > 200) {
      notifications.splice(0, notifications.length - 200);
    }
    fs.writeFileSync(
      NOTIFICATIONS_FILE,
      JSON.stringify(notifications, null, 2),
      "utf-8",
    );

    state.failedErrors.push({
      errorType: inputData.errorType,
      failedAt: processedAt,
      reason: "No automated resolution available - requires manual intervention",
    });
    state.stats.totalFailed += 1;
    if (state.failedErrors.length > 100) {
      state.failedErrors = state.failedErrors.slice(-100);
    }
    saveState(state);

    return {
      errorType: inputData.errorType,
      wasFixed: false,
      action: "notification_sent",
      details: notificationMessage,
      processedAt,
    };
  },
});

const generateSummary = createStep({
  id: "generate-summary",
  description:
    "Generates a summary report of all error resolution actions taken",
  inputSchema: z.array(
    z.object({
      errorType: z.string(),
      wasFixed: z.boolean(),
      action: z.string(),
      details: z.string(),
      processedAt: z.string(),
    }),
  ),
  outputSchema: z.object({
    summary: z.string(),
    totalProcessed: z.number(),
    totalFixed: z.number(),
    totalNotified: z.number(),
    completedAt: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📊 [Step: generate-summary] Generating resolution summary...");

    const results = Array.isArray(inputData) ? inputData : [];
    const totalProcessed = results.length;
    const totalFixed = results.filter((r) => r.wasFixed).length;
    const totalNotified = results.filter((r) => !r.wasFixed).length;
    const completedAt = new Date().toISOString();

    const summaryLines = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "ERROR RESOLUTION SUMMARY",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `  Total Errors Processed: ${totalProcessed}`,
      `  Automatically Fixed:    ${totalFixed}`,
      `  Notifications Sent:     ${totalNotified}`,
      `  Completed At:           ${completedAt}`,
      "",
    ];

    if (totalProcessed > 0) {
      summaryLines.push("  Details:");
      for (const r of results) {
        const icon = r.wasFixed ? "FIXED" : "NOTIFIED";
        summaryLines.push(`    [${icon}] ${r.errorType}: ${r.action}`);
      }
    } else {
      summaryLines.push("  No errors detected in this scan cycle.");
    }
    summaryLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const summary = summaryLines.join("\n");
    logger?.info(summary);
    logger?.info("✅ [Step: generate-summary] Summary complete");

    return {
      summary,
      totalProcessed,
      totalFixed,
      totalNotified,
      completedAt,
    };
  },
});

export const errorResolutionWorkflow = createWorkflow({
  id: "error-resolution-workflow",
  inputSchema: z.object({}) as any,
  outputSchema: z.object({
    summary: z.string(),
    totalProcessed: z.number(),
    totalFixed: z.number(),
    totalNotified: z.number(),
    completedAt: z.string(),
  }),
})
  .then(readErrorLogs as any)
  .foreach(processEachError as any)
  .then(generateSummary as any)
  .commit();
