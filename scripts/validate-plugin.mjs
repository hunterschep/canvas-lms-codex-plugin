#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pluginRoot = resolve(dirname(__filename), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  ".gitignore",
  "LICENSE",
  "README.md",
  "install.sh",
  "skills/canvas-lms/SKILL.md",
  "scripts/canvas-mcp-core.mjs",
  "scripts/canvas-mcp-server.mjs",
  "scripts/canvas-mcp-tools.mjs",
];

const scriptFiles = [
  "scripts/canvas-mcp-core.mjs",
  "scripts/canvas-mcp-tools.mjs",
  "scripts/canvas-mcp-server.mjs",
  "scripts/validate-plugin.mjs",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(pluginRoot, relativePath), "utf8"));
}

function validateStructure() {
  for (const relativePath of requiredFiles) {
    assert(existsSync(resolve(pluginRoot, relativePath)), `Missing required plugin file: ${relativePath}`);
  }

  const manifest = readJson(".codex-plugin/plugin.json");
  assert(typeof manifest.name === "string" && manifest.name === "canvas-lms", 'plugin.json name must be "canvas-lms"');
  assert(typeof manifest.version === "string" && manifest.version.trim() !== "", "plugin.json version must be a non-empty string");
  assert(typeof manifest.description === "string" && manifest.description.trim() !== "", "plugin.json description must be a non-empty string");
  assert(typeof manifest.author?.name === "string" && manifest.author.name.trim() !== "", "plugin.json author.name must be set");
  assert(manifest.homepage === "https://github.com/hunterschep/canvas-lms-codex-plugin", "plugin.json homepage must point to the GitHub repository");
  assert(manifest.repository === "https://github.com/hunterschep/canvas-lms-codex-plugin", "plugin.json repository must point to the GitHub repository");
  assert(manifest.skills === "./skills/", 'plugin.json skills must point to "./skills/"');
  assert(manifest.mcpServers === "./.mcp.json", 'plugin.json mcpServers must point to "./.mcp.json"');

  const mcpConfig = readJson(".mcp.json");
  const canvasServer = mcpConfig?.mcpServers?.canvas;
  assert(canvasServer, 'Missing ".mcp.json" mcpServers.canvas definition');
  assert(canvasServer.command === "node", 'mcpServers.canvas.command must be "node"');
  assert(Array.isArray(canvasServer.args) && canvasServer.args[0] === "./scripts/canvas-mcp-server.mjs", "mcp server args must point to the stdio entrypoint");

  const marketplacePath = resolve(repoRoot, ".agents/plugins/marketplace.json");
  assert(existsSync(marketplacePath), "Missing repo marketplace file at .agents/plugins/marketplace.json");
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
  const entry = Array.isArray(marketplace.plugins)
    ? marketplace.plugins.find((plugin) => plugin?.name === "canvas-lms")
    : null;
  assert(entry, 'Marketplace is missing a "canvas-lms" entry');
  assert(entry?.source?.path === "./plugins/canvas-lms", 'Marketplace path must be "./plugins/canvas-lms"');
  assert(entry?.policy?.installation === "AVAILABLE", 'Marketplace installation policy must be "AVAILABLE"');
  assert(entry?.policy?.authentication === "ON_INSTALL", 'Marketplace authentication policy must be "ON_INSTALL"');

  const readme = readFileSync(resolve(pluginRoot, "README.md"), "utf8");
  assert(readme.includes("community-built"), 'README must mention that the plugin is community-built');
  assert(readme.includes("not an official Instructure product"), 'README must state that the plugin is not an official Instructure product');

  return manifest;
}

function validateSyntax() {
  for (const relativePath of scriptFiles) {
    const fullPath = resolve(pluginRoot, relativePath);
    const result = spawnSync(process.execPath, ["--check", fullPath], {
      encoding: "utf8",
      });
    assert(result.status === 0, `Syntax check failed for ${relativePath}\n${result.stderr || result.stdout}`);
  }

  const shellResult = spawnSync("bash", ["-n", resolve(pluginRoot, "install.sh")], {
    encoding: "utf8",
  });
  assert(shellResult.status === 0, `Shell syntax check failed for install.sh\n${shellResult.stderr || shellResult.stdout}`);
}

function buildFrame(message) {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\nContent-Type: application/json\r\n\r\n${json}`;
}

function extractFrames(buffer) {
  const messages = [];
  let remaining = buffer;

  while (true) {
    const headerEnd = remaining.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      break;
    }

    const headerText = remaining.slice(0, headerEnd);
    const match = headerText.match(/content-length:\s*(\d+)/i);
    if (!match) {
      throw new Error("Received MCP frame without Content-Length");
    }

    const contentLength = Number.parseInt(match[1], 10);
    const frameEnd = headerEnd + 4 + contentLength;
    if (remaining.length < frameEnd) {
      break;
    }

    const body = remaining.slice(headerEnd + 4, frameEnd);
    messages.push(JSON.parse(body));
    remaining = remaining.slice(frameEnd);
  }

  return { messages, remaining };
}

async function validateMcpHandshake(manifest) {
  const serverPath = resolve(pluginRoot, "scripts/canvas-mcp-server.mjs");
  const child = spawn(process.execPath, [serverPath], {
    cwd: pluginRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const responses = new Map();
  let stdoutBuffer = "";
  let stderrBuffer = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const parsed = extractFrames(stdoutBuffer);
    stdoutBuffer = parsed.remaining;
    for (const message of parsed.messages) {
      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        responses.set(message.id, message);
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
  });

  child.stdin.write(buildFrame({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "validate-plugin", version: "1.0.0" },
    },
  }));
  child.stdin.write(buildFrame({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  }));
  child.stdin.write(buildFrame({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }));

  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      rejectPromise(new Error(`Timed out waiting for MCP responses. stderr:\n${stderrBuffer}`));
    }, 5000);

    const poll = () => {
      if (responses.has(1) && responses.has(2)) {
        clearTimeout(timeout);
        resolvePromise();
        return;
      }
      if (child.exitCode !== null && child.exitCode !== 0) {
        clearTimeout(timeout);
        rejectPromise(new Error(`MCP server exited early with code ${child.exitCode}. stderr:\n${stderrBuffer}`));
        return;
      }
      setTimeout(poll, 25);
    };

    poll();
  });

  child.kill();

  const init = responses.get(1);
  const tools = responses.get(2);

  assert(init?.result?.serverInfo?.name === "canvas-lms", 'MCP initialize response must report server name "canvas-lms"');
  assert(init?.result?.serverInfo?.version === manifest.version, `MCP initialize response must report server version "${manifest.version}"`);
  assert(typeof init?.result?.instructions === "string" && init.result.instructions.includes("student-focused Canvas tools"), "MCP initialize instructions are missing expected guidance");
  assert(Array.isArray(tools?.result?.tools), "tools/list did not return a tool array");
  assert(tools.result.tools.length === 20, `Expected 20 tools, found ${tools.result.tools.length}`);
}

async function main() {
  const manifest = validateStructure();
  validateSyntax();
  await validateMcpHandshake(manifest);
  process.stdout.write("canvas-lms plugin validation passed\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
