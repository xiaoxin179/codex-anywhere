# Codex Anywhere

> Project origin: this repository is a fork of [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere). Thank you to gaotong132 for creating and open-sourcing the original project. Subsequent changes in this fork are maintained independently and do not represent an upstream release or support commitment.

English | [简体中文](README.zh-CN.md) · [MIT License](LICENSE)

Codex Anywhere is a self-hosted remote interface for personal Codex use. A phone connects through a browser or the [separate Android client](https://github.com/xiaoxin179/codex-anywhere-app) to a relay, then establishes an encrypted channel to a Connector on your computer. **In the default personal setup, Codex and project files stay on your computer. The server provides access, device authentication, and routing; it does not run the Agent for your PC.**

This is an unofficial community project, not affiliated with or endorsed by OpenAI.

## What this fork adds

- A quieter Codex-inspired light interface with project groups, collapsible sessions, search, unread states, and a loading ring while a task is responding.
- Mobile access to real Codex sessions: continue conversations, send text and images, follow progress, preview files and code changes, and download files after confirmation. Availability depends on the selected Codex environment.
- Single-use pairing links with a configurable **1–60 minute** lifetime (10 minutes by default). Expiry does not disconnect a device that has already paired; it reconnects with its own device key.
- Approved-device and connection-activity views, plus device revocation. Even after the relay approves a Connector, the PC owner can stop the local Connector and disable its automatic startup to refuse remote access.
- A separately maintained Android client. It reads the server address and entry path from a complete pairing link rather than hard-coding an individual deployment, then hosts the same Web interface in a system WebView.
- Environment-scoped sessions. An optional headless Linux execution node can be configured alongside Windows Codex Desktop, but is not required to operate Codex on your own PC.

## How it works

```text
Phone browser / Android app
        │ HTTPS / WSS
        ▼
   Self-hosted relay (access, authentication, ciphertext routing)
        ▲
        │ Connector makes an outbound connection
        │
   Your Windows PC ── Codex Desktop / local project files
```

The PC needs no inbound port. The relay authenticates approved devices and routes encrypted messages; it does not store a Codex conversation database. Codex execution and file access happen on the selected Connector machine. An optional Linux Connector is a separate execution node and does not automatically take over Windows sessions.

## Security boundaries

- First-time phone access uses a single-use pairing link. After pairing, the device private key remains in browser or Android WebView site storage. The relay stores the approval and public key, not a recoverable pairing link or device private key.
- Browser and Connector establish an authenticated end-to-end encrypted channel. Use HTTPS/WSS for public entry. A random entry path only discourages casual discovery; **it is not authentication**.
- The relay remains trusted infrastructure: it serves Web code, manages device trust, and can observe connection timing and traffic size. Encryption cannot eliminate the consequences of a stolen device or a compromised browser, PC, or server.
- When remote access is not needed, stop the local Connector and disable its automatic startup. Revoke lost phones on the relay. Never commit Connector credentials, private keys, pairing links, or personal deployment addresses.
- Clearing the Android app's *cache* normally preserves pairing. Clearing *app data/storage* may delete the WebView device key and require pairing again.

See the [security policy](docs/SECURITY.md) for the fuller threat model.

## Quick start

Use a Linux host with Docker Engine and Docker Compose v2 as the relay, and a Windows PC with Codex Desktop/CLI, Node.js 22+, and PowerShell as the execution node. For public access, first provide a trusted HTTPS/WSS entry point. A domain is optional; an IP address with a port and matching certificate can also work. **Do not expose the relay's loopback service port directly to the internet.**

Clone this fork and initialize the relay:

```bash
git clone https://github.com/xiaoxin179/codex-anywhere.git
cd codex-anywhere
./scripts/relay.sh setup
```

Then install the local Connector following the [deployment guide](docs/deployment.md). After its first connection, approve it on the relay and create a one-time pairing link:

```bash
./scripts/relay.sh approve
./scripts/relay.sh pair https://your-host.example:8443 10
```

The address and port above are **placeholders**. Use your own HTTPS entry point, and do not paste a real pairing link into documentation or public chat. The lifetime argument is optional (default: 10 minutes; allowed range: 1–60).

Manage approved devices with:

```bash
./scripts/relay.sh devices
./scripts/relay.sh revoke
```

The independent [codex-anywhere-app](https://github.com/xiaoxin179/codex-anywhere-app) repository contains the Android source, build instructions, and pairing guidance. The APK does not need a compiled-in server address: paste a complete HTTPS pairing link on first launch. Web-interface updates generally do not require reinstalling the APK.

## Development and repository boundaries

```bash
npm ci
npm run check
npm run build
```

Relay/Web/Connector source lives here; the native Android wrapper lives in its own repository. `build/` and `dist/` are generated output. See the [deployment guide](docs/deployment.md) for detailed configuration, optional Linux execution nodes, and maintenance commands; see the [browser extension guide](extension/README.md) for the optional extension.

This fork retains the upstream [MIT License](LICENSE) and original copyright notice. Thanks again to the upstream author and contributors.
