#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const pluginRoot = resolve(dirname(__filename), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "API_COVERAGE.md",
  ".gitignore",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "TERMS.md",
  "install.sh",
  "assets/canvas-lms-icon.svg",
  "assets/canvas-lms-logo.svg",
  "skills/canvas-lms/SKILL.md",
  "scripts/canvas-mcp-core.mjs",
  "scripts/canvas-mcp-server.mjs",
  "scripts/canvas-mcp-tools.mjs",
];

const MAX_SOURCE_LINES = 500;
const EXPECTED_TOOL_COUNT = 103;

function listMjsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMjsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(relative(pluginRoot, fullPath));
    }
  }
  return files.sort();
}

const scriptFiles = listMjsFiles(resolve(pluginRoot, "scripts"));

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
  assert(typeof manifest.author?.email === "string" && manifest.author.email.includes("@"), "plugin.json author.email must be set");
  assert(manifest.homepage === "https://github.com/hunterschep/canvas-lms-codex-plugin", "plugin.json homepage must point to the GitHub repository");
  assert(manifest.repository === "https://github.com/hunterschep/canvas-lms-codex-plugin", "plugin.json repository must point to the GitHub repository");
  assert(manifest.skills === "./skills/", 'plugin.json skills must point to "./skills/"');
  assert(manifest.mcpServers === "./.mcp.json", 'plugin.json mcpServers must point to "./.mcp.json"');
  assert(Array.isArray(manifest.interface?.capabilities), "plugin.json interface.capabilities must be an array");
  assert(manifest.interface.capabilities.includes("Interactive"), 'plugin.json interface.capabilities must include "Interactive"');
  assert(manifest.interface.capabilities.includes("Write"), 'plugin.json interface.capabilities must include "Write"');
  assert(typeof manifest.interface?.privacyPolicyURL === "string" && manifest.interface.privacyPolicyURL.endsWith("/PRIVACY.md"), "plugin.json interface.privacyPolicyURL must point to PRIVACY.md");
  assert(typeof manifest.interface?.termsOfServiceURL === "string" && manifest.interface.termsOfServiceURL.endsWith("/TERMS.md"), "plugin.json interface.termsOfServiceURL must point to TERMS.md");
  assert(manifest.interface?.composerIcon === "./assets/canvas-lms-icon.svg", 'plugin.json interface.composerIcon must point to "./assets/canvas-lms-icon.svg"');
  assert(manifest.interface?.logo === "./assets/canvas-lms-logo.svg", 'plugin.json interface.logo must point to "./assets/canvas-lms-logo.svg"');
  assert(Array.isArray(manifest.interface?.screenshots), "plugin.json interface.screenshots must be an array");

  const mcpConfig = readJson(".mcp.json");
  const canvasServer = mcpConfig?.mcpServers?.canvas;
  assert(canvasServer, 'Missing ".mcp.json" mcpServers.canvas definition');
  assert(canvasServer.command === "node", 'Source .mcp.json mcpServers.canvas.command must be "node"');
  assert(Array.isArray(canvasServer.args) && typeof canvasServer.args[0] === "string", "mcp server args must include the stdio entrypoint");
  assert(canvasServer.args[0] === "./scripts/canvas-mcp-server.mjs", 'Source .mcp.json must point to "./scripts/canvas-mcp-server.mjs"');
  assert(!Object.prototype.hasOwnProperty.call(canvasServer, "cwd"), 'mcpServers.canvas should not set "cwd"; bundled MCP paths should stay plugin-root-relative');

  const marketplacePath = resolve(repoRoot, ".agents/plugins/marketplace.json");
  assert(existsSync(marketplacePath), "Missing repo marketplace file at .agents/plugins/marketplace.json");
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
  assert(marketplace?.name === "canvas-local-plugins", 'Repo marketplace name must be "canvas-local-plugins"');
  assert(marketplace?.interface?.displayName === "Canvas Local Plugins", 'Repo marketplace display name must be "Canvas Local Plugins"');
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

  const installer = readFileSync(resolve(pluginRoot, "install.sh"), "utf8");
  assert(!installer.includes("Updated Codex MCP config"), "install.sh should not register Canvas as a global mcp_servers entry");
  assert(!installer.includes("[mcp_servers.canvas]"), "install.sh should not write a global [mcp_servers.canvas] block");
  assert(installer.includes('MARKETPLACE_NAME="canvas-local-plugins"'), 'install.sh must keep the repo marketplace name stable as "canvas-local-plugins"');
  assert(installer.includes('SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"'), "install.sh must support being piped to bash without assuming BASH_SOURCE[0] is set");
  assert(installer.includes('NODE_BIN="$(command -v node || true)"'), "install.sh must resolve an absolute node binary for the personal installed MCP config");
  assert(installer.includes('if [[ "${MODE}" == "personal" ]]; then'), "install.sh must only rewrite MCP paths for personal installs");
  assert(installer.includes('canvas["command"] = str(node_bin)'), "install.sh must rewrite the personal MCP command to an absolute node path");
  assert(installer.includes('canvas["args"] = [str(server_path)]'), "install.sh must rewrite the personal MCP script path to an absolute path");
  assert(installer.includes("Leaving workspace .mcp.json plugin-root-relative for repo portability."), "install.sh must keep workspace installs plugin-root-relative");

  return manifest;
}

function validateSyntax() {
  for (const relativePath of scriptFiles) {
    const fullPath = resolve(pluginRoot, relativePath);
    const lineCount = readFileSync(fullPath, "utf8").split("\n").length;
    assert(lineCount <= MAX_SOURCE_LINES, `${relativePath} has ${lineCount} lines; keep source files at or below ${MAX_SOURCE_LINES} lines`);
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

function buildFrame(message, separator = "\r\n") {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}${separator}Content-Type: application/json${separator}${separator}${json}`;
}

function buildRawJsonLine(message) {
  return `${JSON.stringify(message)}\n`;
}

function extractFrames(buffer) {
  const messages = [];
  let remaining = buffer;

  while (true) {
    const crlfIndex = remaining.indexOf("\r\n\r\n");
    const lfIndex = remaining.indexOf("\n\n");
    let headerEnd = -1;
    let separatorLength = 0;

    if (crlfIndex !== -1 && (lfIndex === -1 || crlfIndex <= lfIndex)) {
      headerEnd = crlfIndex;
      separatorLength = 4;
    } else if (lfIndex !== -1) {
      headerEnd = lfIndex;
      separatorLength = 2;
    }

    if (headerEnd === -1) {
      break;
    }

    const headerText = remaining.slice(0, headerEnd);
    const match = headerText.match(/content-length:\s*(\d+)/i);
    if (!match) {
      throw new Error("Received MCP frame without Content-Length");
    }

    const contentLength = Number.parseInt(match[1], 10);
    const frameEnd = headerEnd + separatorLength + contentLength;
    if (remaining.length < frameEnd) {
      break;
    }

    const body = remaining.slice(headerEnd + separatorLength, frameEnd);
    messages.push(JSON.parse(body));
    remaining = remaining.slice(frameEnd);
  }

  return { messages, remaining };
}

function extractRawJsonMessages(buffer) {
  const messages = [];
  let remaining = buffer;

  while (true) {
    const newlineIndex = remaining.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }

    const line = remaining.slice(0, newlineIndex).replace(/\r$/, "").trim();
    remaining = remaining.slice(newlineIndex + 1);
    if (line === "") {
      continue;
    }

    messages.push(JSON.parse(line));
  }

  return { messages, remaining };
}

function extractMessages(buffer) {
  const framed = extractFrames(buffer);
  if (framed.messages.length > 0 || /^\s*Content-Length:/i.test(framed.remaining)) {
    return framed;
  }

  return extractRawJsonMessages(buffer);
}

async function validateMcpHandshake(manifest, separator) {
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
    const parsed = extractMessages(stdoutBuffer);
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
  }, separator));
  child.stdin.write(buildFrame({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  }, separator));
  child.stdin.write(buildFrame({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, separator));

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
  assert(tools.result.tools.length === EXPECTED_TOOL_COUNT, `Expected ${EXPECTED_TOOL_COUNT} tools, found ${tools.result.tools.length}`);
}

async function validateRawJsonHandshake(manifest) {
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
    const parsed = extractMessages(stdoutBuffer);
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

  child.stdin.write(buildRawJsonLine({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "validate-plugin", version: "1.0.0" },
    },
  }));
  child.stdin.write(buildRawJsonLine({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  }));
  child.stdin.write(buildRawJsonLine({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }));

  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      rejectPromise(new Error(`Timed out waiting for raw JSON MCP responses. stderr:\n${stderrBuffer}`));
    }, 5000);

    const poll = () => {
      if (responses.has(1) && responses.has(2)) {
        clearTimeout(timeout);
        resolvePromise();
        return;
      }
      if (child.exitCode !== null && child.exitCode !== 0) {
        clearTimeout(timeout);
        rejectPromise(new Error(`Raw JSON MCP server exited early with code ${child.exitCode}. stderr:\n${stderrBuffer}`));
        return;
      }
      setTimeout(poll, 25);
    };

    poll();
  });

  child.kill();

  const init = responses.get(1);
  const tools = responses.get(2);

  assert(init?.result?.serverInfo?.name === "canvas-lms", 'Raw JSON initialize response must report server name "canvas-lms"');
  assert(init?.result?.serverInfo?.version === manifest.version, `Raw JSON initialize response must report server version "${manifest.version}"`);
  assert(Array.isArray(tools?.result?.tools), "Raw JSON tools/list did not return a tool array");
  assert(tools.result.tools.length === EXPECTED_TOOL_COUNT, `Expected ${EXPECTED_TOOL_COUNT} tools from raw JSON handshake, found ${tools.result.tools.length}`);
}

async function main() {
  const manifest = validateStructure();
  validateSyntax();
  await validateMcpHandshake(manifest, "\r\n");
  await validateMcpHandshake(manifest, "\n");
  await validateRawJsonHandshake(manifest);
  process.stdout.write("canvas-lms plugin validation passed\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
