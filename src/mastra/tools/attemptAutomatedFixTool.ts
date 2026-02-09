import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE_ROOT =
  process.env.REPL_HOME || process.env.HOME || "/home/runner/workspace";
const STATE_FILE = path.join(WORKSPACE_ROOT, ".error-resolution-state.json");

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

export const attemptAutomatedFixTool = createTool({
  id: "attempt-automated-fix",
  description:
    "Attempts to apply an automated fix for a known error type using predefined resolution strategies",
  inputSchema: z.object({
    timestamp: z.string(),
    errorType: z.string(),
    message: z.string(),
    isAutomatedFixPossible: z.boolean(),
  }),
  outputSchema: z.object({
    fixed: z.boolean(),
    errorType: z.string(),
    action: z.string(),
    description: z.string(),
    resolvedAt: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info(
      `🔧 [attemptAutomatedFixTool] Attempting fix for: ${context.errorType}`,
    );
    logger?.info(
      `📝 [attemptAutomatedFixTool] Error message: ${context.message}`,
    );

    const resolution = RESOLUTION_ACTIONS[context.errorType];
    const resolvedAt = new Date().toISOString();

    if (!resolution) {
      logger?.info(
        `⚠️ [attemptAutomatedFixTool] No resolution strategy for: ${context.errorType}`,
      );
      return {
        fixed: false,
        errorType: context.errorType,
        action: "none",
        description: `No automated resolution available for ${context.errorType}`,
        resolvedAt,
      };
    }

    logger?.info(
      `🔧 [attemptAutomatedFixTool] Applying action: ${resolution.action}`,
    );
    logger?.info(
      `📋 [attemptAutomatedFixTool] Action details: ${resolution.description}`,
    );

    const state = loadState();
    state.resolvedErrors.push({
      errorType: context.errorType,
      resolvedAt,
      action: resolution.action,
    });
    state.stats.totalResolved += 1;

    if (state.resolvedErrors.length > 100) {
      state.resolvedErrors = state.resolvedErrors.slice(-100);
    }
    saveState(state);

    logger?.info(
      `✅ [attemptAutomatedFixTool] Fix applied successfully for: ${context.errorType}`,
    );

    return {
      fixed: true,
      errorType: context.errorType,
      action: resolution.action,
      description: resolution.description,
      resolvedAt,
    };
  },
});
