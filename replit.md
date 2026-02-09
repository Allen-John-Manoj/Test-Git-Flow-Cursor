# Error Resolution Automation

## Overview
A time-based automation that monitors a data app's log files every minute for errors and applies automated resolution actions. Built with Mastra framework using rule-based logic (no LLM/AI calls).

## Current State
- Automation is fully functional and tested
- Cron trigger runs every minute (minimum cron interval; 30-second intervals not supported by standard cron)
- Detects 6 error types from the Streamlit Log Simulator
- Uses local file storage for state persistence

## Architecture

### Trigger
- Time-based cron trigger: `* * * * *` (every minute)
- Configurable via `SCHEDULE_CRON_EXPRESSION` environment variable

### Workflow: `error-resolution-workflow`
1. **read-error-logs** - Scans log files for ERROR entries, returns array of detected errors
2. **process-each-error** (foreach) - For each error, either applies automated fix or sends notification
3. **generate-summary** - Creates a summary report of all actions taken

### Error Types & Resolution
| Error Type | Auto-Fix? | Action |
|---|---|---|
| NullPointerException | Yes | null_check_injection |
| ConnectionTimeoutError | Yes | connection_retry |
| OutOfMemoryError | Yes | memory_cleanup |
| FileNotFoundException | Yes | file_path_recovery |
| AuthenticationError | No | notification_sent (CRITICAL) |
| PermissionDenied | No | notification_sent (HIGH) |

### State Storage (Local Files)
- `.error-resolution-state.json` - Tracks resolved/failed errors, stats, last checked timestamp
- `.error-notifications.json` - Stores notifications for errors requiring manual intervention

### Log File Locations Scanned
- `app.log`, `logs/app.log`, `error.log`, `logs/error.log` (in workspace root)

## Project Structure
```
src/mastra/
  agents/errorResolutionAgent.ts     - Agent (required by Mastra, not used for LLM calls)
  tools/readErrorLogsTool.ts         - Tool for reading error logs
  tools/attemptAutomatedFixTool.ts   - Tool for applying automated fixes
  tools/notifyOnFailureTool.ts       - Tool for creating failure notifications
  workflows/errorResolutionWorkflow.ts - Main workflow with foreach and branching logic
  index.ts                           - Mastra instance registration and cron trigger setup
```

## User Preferences
- No AI/LLM usage - purely rule-based automation
- Local storage for state management
