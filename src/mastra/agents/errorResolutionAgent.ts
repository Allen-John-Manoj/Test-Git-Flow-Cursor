import { Agent } from "@mastra/core/agent";
import { readErrorLogsTool } from "../tools/readErrorLogsTool";
import { attemptAutomatedFixTool } from "../tools/attemptAutomatedFixTool";
import { notifyOnFailureTool } from "../tools/notifyOnFailureTool";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export const errorResolutionAgent = new Agent({
  name: "Error Resolution Agent",
  instructions: `
    You are an error resolution agent for a data app log simulator.
    You monitor error logs and apply automated fixes where possible.
    For errors that cannot be automatically fixed, you create notifications for manual intervention.
    
    Note: This automation runs entirely through workflow steps without LLM calls.
    The workflow uses rule-based logic to detect and resolve errors.
  `,
  model: openai("gpt-4o-mini"),
  tools: {
    readErrorLogsTool,
    attemptAutomatedFixTool,
    notifyOnFailureTool,
  },
});
