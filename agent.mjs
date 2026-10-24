// agent.mjs: the coding agent every model runs, on the Claude Agent SDK. The same few options for
// each model; only `model` and `effort` change between runs.
import { query } from '@anthropic-ai/claude-agent-sdk';

export const SYSTEM_PROMPT = `You are a coding agent working in the current folder.
Read the code before you change it, keep the change small,
run the tests, and finish with a sentence or two on what you changed.`;

export function agent({ task, model, effort, cwd, maxBudgetUsd, abortController, env, stderr, onEffort }) {
  const options = {
    model,
    ...(effort ? { effort } : {}),     // not set: the model's own default effort
    cwd,
    systemPrompt: SYSTEM_PROMPT,
    tools: ['Read', 'Edit', 'Bash'],   // the only tools the model gets
    allowedTools: ['Bash'],            // commands run without asking
    permissionMode: 'acceptEdits',     // edits too, inside this folder only
    settingSources: [],                // no CLAUDE.md, no settings files
    strictMcpConfig: true,             // no MCP servers from your own config
    persistSession: false,             // nothing saved under ~/.claude/projects
    title: 'which-claude run',         // a title of our own, so no extra request to make one up
    includePartialMessages: true,      // each reply's token counts as it streams, for the running cost
    maxBudgetUsd,                      // the run stops if it costs more than this
    abortController,
    env,
    stderr,
    // Read-only: the hook only notes the effort Claude Code applied to the turn
    hooks: { Stop: [{ hooks: [async input => { onEffort?.(input.effort?.level); return {}; }] }] },
  };
  return query({ prompt: task, options });
}
