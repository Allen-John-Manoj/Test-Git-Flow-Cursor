import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE_ROOT =
  process.env.REPL_HOME || process.env.HOME || "/home/runner/workspace";
const STATE_FILE = path.join(WORKSPACE_ROOT, ".error-resolution-state.json");

interface ErrorEntry {
  timestamp: string;
  errorType: string;
  message: string;
  isAutomatedFixPossible: boolean;
}

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

const KNOWN_ERRORS: Record<string, boolean> = {
  NullPointerException: true,
  ConnectionTimeoutError: true,
  OutOfMemoryError: true,
  FileNotFoundException: true,
  AuthenticationError: false,
  PermissionDenied: false,
};

function parseLogLine(line: string): ErrorEntry | null {
  const errorMatch = line.match(
    /\[(\d{4}-\d{2}-\d{2}\s[\d:]+)\]\s*ERROR\s*[-–:]\s*(.*)/i,
  );
  if (!errorMatch) {
    const simpleMatch = line.match(/ERROR\s*[-–:]\s*(.*)/i);
    if (!simpleMatch) return null;
    const errorMsg = simpleMatch[1].trim();
    const errorType = identifyErrorType(errorMsg);
    return {
      timestamp: new Date().toISOString(),
      errorType,
      message: errorMsg,
      isAutomatedFixPossible: KNOWN_ERRORS[errorType] ?? false,
    };
  }

  const timestamp = errorMatch[1];
  const errorMsg = errorMatch[2].trim();
  const errorType = identifyErrorType(errorMsg);

  return {
    timestamp,
    errorType,
    message: errorMsg,
    isAutomatedFixPossible: KNOWN_ERRORS[errorType] ?? false,
  };
}

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

export const readErrorLogsTool = createTool({
  id: "read-error-logs",
  description:
    "Reads error logs from the data app log file and returns detected errors with their types and timestamps",
  inputSchema: z.object({}),
  outputSchema: z.object({
    errors: z.array(
      z.object({
        timestamp: z.string(),
        errorType: z.string(),
        message: z.string(),
        isAutomatedFixPossible: z.boolean(),
      }),
    ),
    totalFound: z.number(),
    checkedAt: z.string(),
  }),
  execute: async ({ mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📖 [readErrorLogsTool] Starting log scan...");

    const state = loadState();
    const possibleLogFiles = [
      path.join(WORKSPACE_ROOT, "app.log"),
      path.join(WORKSPACE_ROOT, "logs", "app.log"),
      path.join(WORKSPACE_ROOT, "error.log"),
      path.join(WORKSPACE_ROOT, "logs", "error.log"),
    ];

    const errors: ErrorEntry[] = [];

    for (const logFile of possibleLogFiles) {
      if (!fs.existsSync(logFile)) {
        logger?.info(`📂 [readErrorLogsTool] Log file not found: ${logFile}`);
        continue;
      }

      logger?.info(`📂 [readErrorLogsTool] Reading log file: ${logFile}`);
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
        logger?.error(
          `❌ [readErrorLogsTool] Failed to read ${logFile}: ${e}`,
        );
      }
    }

    if (errors.length === 0) {
      logger?.info(
        "📖 [readErrorLogsTool] No log files with errors found. Generating sample scan result.",
      );
    }

    const checkedAt = new Date().toISOString();
    state.lastCheckedTimestamp = checkedAt;
    state.stats.totalDetected += errors.length;
    saveState(state);

    logger?.info(
      `✅ [readErrorLogsTool] Scan complete. Found ${errors.length} new errors.`,
    );

    return {
      errors,
      totalFound: errors.length,
      checkedAt,
    };
  },
});
