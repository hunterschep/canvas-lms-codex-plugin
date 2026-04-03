# Privacy Policy

This project is a community-built Codex plugin for Canvas LMS.

## What the plugin sends

- Canvas API requests are sent only to the `CANVAS_BASE_URL` origin you configure.
- The plugin includes your Canvas bearer token only in requests to that configured Canvas origin.
- Request payloads and responses are processed locally by Codex and the plugin runtime on your machine.

## What the plugin stores

- The plugin does not add its own persistent database or telemetry service.
- Codex may cache the installed plugin bundle and keep local logs according to Codex's own behavior.
- Your Canvas access token is read from your shell environment at runtime.

## What the plugin does not do

- It does not proxy Canvas traffic through a separate third-party service operated by this plugin.
- It does not intentionally transmit your Canvas token to any origin other than the configured Canvas host.

## Your responsibility

- Use a token with the minimum permissions your institution allows.
- Review the source code before using the plugin with institutional or sensitive data.
- Follow your institution's Canvas, privacy, and acceptable use policies.

## Contact

Questions about this repository can be raised through the GitHub repository issues page:

https://github.com/hunterschep/canvas-lms-codex-plugin/issues
