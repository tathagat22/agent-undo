#!/usr/bin/env node
// The `undo` MCP server — Ctrl-Z for AI agents.
//
// An agent checkpoints itself before acting, tracks each file it's about to
// change, and records network mutations. If anything goes wrong, the human
// (or the agent) calls undo_rollback and the world snaps back. Every tool here
// is a thin shell over the in-process Rust engine.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import engine from "./engine.js";

const server = new McpServer({ name: "undo", version: "0.1.0" });

const cwdSchema = {
  cwd: z
    .string()
    .optional()
    .describe("Project directory. Defaults to the server's working directory."),
};
const wd = (cwd?: string) => cwd ?? process.cwd();
const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

server.registerTool(
  "undo_init",
  {
    title: "Initialize undo",
    description:
      "Set up the undo time machine in a project directory. Run this once before checkpointing.",
    inputSchema: cwdSchema,
  },
  async ({ cwd }) => {
    engine.init(wd(cwd));
    return text(`Initialized undo in ${wd(cwd)}/.undo`);
  },
);

server.registerTool(
  "undo_checkpoint",
  {
    title: "Create a checkpoint",
    description:
      "Mark a point in time you can rewind to. Call this BEFORE you start making changes.",
    inputSchema: {
      ...cwdSchema,
      label: z.string().describe("A short description, e.g. 'before refactor'."),
    },
  },
  async ({ cwd, label }) => {
    const id = engine.checkpoint(wd(cwd), label);
    return text(`Checkpoint ${id} created: "${label}"`);
  },
);

server.registerTool(
  "undo_track",
  {
    title: "Track a file before changing it",
    description:
      "Capture a file's current contents BEFORE you create, modify, or delete it. " +
      "This is what makes the change reversible. Call it on every path you're about to touch.",
    inputSchema: {
      ...cwdSchema,
      paths: z
        .array(z.string())
        .describe("Files you're about to change (relative or absolute paths)."),
    },
  },
  async ({ cwd, paths }) => {
    const lines = paths.map((p) => "  " + engine.track(wd(cwd), p));
    return text(`Tracking ${paths.length} file(s):\n${lines.join("\n")}`);
  },
);

server.registerTool(
  "undo_record_http",
  {
    title: "Record a network mutation",
    description:
      "Log a POST/PUT/PATCH/DELETE the agent made, with an optional compensating request " +
      "(e.g. a DELETE that reverses a POST) so it can be undone later.",
    inputSchema: {
      ...cwdSchema,
      method: z.string().describe("HTTP method of the mutation."),
      url: z.string().describe("URL that was called."),
      compensatorMethod: z.string().optional().describe("Method of the reversing request."),
      compensatorUrl: z.string().optional().describe("URL of the reversing request."),
      compensatorBody: z.string().optional().describe("Body of the reversing request."),
    },
  },
  async ({ cwd, method, url, compensatorMethod, compensatorUrl, compensatorBody }) => {
    engine.recordHttp(
      wd(cwd),
      method,
      url,
      compensatorMethod ?? null,
      compensatorUrl ?? null,
      compensatorBody ?? null,
    );
    return text(`Recorded ${method} ${url}`);
  },
);

server.registerTool(
  "undo_status",
  {
    title: "What's changed since the checkpoint",
    description: "Show every effect recorded since the most recent checkpoint.",
    inputSchema: cwdSchema,
  },
  async ({ cwd }) => {
    const status = JSON.parse(engine.statusJson(wd(cwd)));
    if (!status.checkpoint) return text("No checkpoint yet. Call undo_checkpoint first.");
    const [id, label] = status.checkpoint;
    const effects: string[] = (status.effects ?? []).map(describeEffect);
    if (effects.length === 0)
      return text(`On checkpoint ${id} ("${label}"). Nothing recorded yet.`);
    return text(
      `On checkpoint ${id} ("${label}"). ${effects.length} change(s):\n` +
        effects.map((e) => "  " + e).join("\n"),
    );
  },
);

server.registerTool(
  "undo_log",
  {
    title: "Full undo history",
    description: "List every checkpoint and effect in order.",
    inputSchema: cwdSchema,
  },
  async ({ cwd }) => {
    const rows = JSON.parse(engine.logJson(wd(cwd))) as any[];
    if (rows.length === 0) return text("History is empty.");
    const out = rows.map((r) =>
      r.type === "checkpoint"
        ? `● ${r.id}  "${r.label}"`
        : "    " + describeEffect(r.effect),
    );
    return text(out.join("\n"));
  },
);

server.registerTool(
  "undo_rollback",
  {
    title: "Rewind everything",
    description:
      "Reverse every change made since a checkpoint (the latest one by default). " +
      "Files are restored byte-for-byte; network/shell effects are listed for manual handling.",
    inputSchema: {
      ...cwdSchema,
      checkpoint: z
        .string()
        .optional()
        .describe("Checkpoint id to rewind to. Defaults to the most recent."),
    },
  },
  async ({ cwd, checkpoint }) => {
    const report = JSON.parse(engine.rollback(wd(cwd), checkpoint ?? null));
    const lines = [`Rewound to ${report.checkpoint}.`];
    if (report.reverted.length) lines.push(`Reverted:`, ...report.reverted.map((r: string) => "  ✓ " + r));
    if (report.skipped.length) lines.push(`Manual:`, ...report.skipped.map((s: string) => "  • " + s));
    if (!report.reverted.length && !report.skipped.length) lines.push("Nothing to undo.");
    return text(lines.join("\n"));
  },
);

function describeEffect(e: any): string {
  switch (e.kind) {
    case "file_create":
      return `created  ${e.path}`;
    case "file_modify":
      return `modified ${e.path}`;
    case "file_delete":
      return `deleted  ${e.path}`;
    case "http_mutation":
      return `${e.method} ${e.url}`;
    case "exec":
      return `ran      ${e.command}`;
    default:
      return JSON.stringify(e);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("undo MCP server running on stdio");
