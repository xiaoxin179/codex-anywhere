# Codex Anywhere

> **Origin and acknowledgements**
>
> This repository is a fork of [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere). Thank you to **gaotong132** and all upstream contributors for designing and open-sourcing the original project. This fork continues that work with independent changes to the interface, remote controls, security model, device management, and mobile experience. These additions and deployment choices are maintained here and do not represent an upstream release or support commitment.

English | [简体中文](README.zh-CN.md) · [MIT License](LICENSE)

A self-hosted remote access layer for personal Codex use. It lets you view and continue Codex tasks from a phone browser or the separate Android client while Codex, source code, and the real execution environment remain on your own computer.

> [!IMPORTANT]
> This is an unofficial community project and is not affiliated with or endorsed by OpenAI. It is designed for one trusted user, not as a public multi-tenant service.

## Project model

Codex Anywhere has three main parts:

- **Relay server** — provides the public entry point, device authentication, presence, and encrypted traffic routing.
- **Connector** — runs on your Windows or Linux computer, makes an outbound connection to the Relay, and communicates with the local Codex environment.
- **Web / Android client** — displays tasks, sends messages, handles approvals, and manages sessions.

The Relay is not the Codex execution host. In the default architecture, project files are not synchronized to the Relay for remote access, and the server does not keep a separate Codex conversation database.

```text
Phone browser / Android app
          │
          │ HTTPS / WSS
          ▼
     Self-hosted Relay
 access · authentication · ciphertext routing
          ▲
          │ outbound Connector connection
          │
    Your Windows / Linux computer
      Codex · project files · execution
```

## What this fork adds

### Codex-inspired mobile interface

- A quiet light interface with navigation and information density adapted for phone screens.
- Project grouping, collapsible sessions, search, unread states, and active-task indicators.
- Loading animation while a task is still generating a response.
- Text and image input, Markdown and code rendering, file previews, diffs, and visualization support.
- Select text from one or more AI responses, attach it as quoted context, and ask a follow-up question.

### Pairing and device management

- Single-use pairing links with a configurable **1–60 minute** lifetime and a 10-minute default.
- Link expiry affects only unused first-time enrollment; it does not disconnect an already paired phone.
- After enrollment, each client reconnects with its own device key instead of reusing the pairing link.
- Approved-device views show presence, connection count, and recent activity, with explicit revocation.
- A Connector also requires administrator approval on first connection; knowing the server address is not sufficient.

### PC-side authority

- The Connector uses an outbound connection, so the PC needs no public inbound port.
- Relay approval does not remove local control: stopping the Connector lets the computer owner unilaterally refuse remote access.
- Windows helper scripts can enable, disable, and report Connector state, including whether automatic startup is allowed.
- Relay authorization and the local Connector switch must both permit access.

### Android client

The native wrapper is maintained separately at [xiaoxin179/codex-anywhere-app](https://github.com/xiaoxin179/codex-anywhere-app).

- No personal server, pairing link, or credential is compiled into the APK.
- The user enters a complete pairing link on first launch; the WebView then retains that device identity.
- Re-pairing lives in the connection-status menu instead of occupying the main screen.
- Most Web UI releases require only reopening the app, not installing a new APK.
- Clearing cache normally preserves pairing; clearing app data or WebView storage may require pairing again.

## Security model and boundaries

- Browsers and Connectors use per-device keys. The Relay stores public keys, approvals, and necessary activity state—not device private keys.
- A one-time enrollment secret travels in the URL fragment and becomes invalid after use. The Relay temporarily stores only its one-way verifier and expiry.
- Browser and Connector establish an authenticated end-to-end encrypted channel; the Relay routes ciphertext.
- Public entry must use HTTPS/WSS. A random entry path may reduce casual discovery, but **is not authentication**.
- The Relay remains trusted infrastructure because it serves client code, manages device trust, and can observe timing and traffic size.
- Revoke a lost phone promptly. Stop the local Connector whenever remote access is not needed.

Never publish these values in this repository:

- Real public IPs, administration ports, or private entry paths
- Pairing links, Connector tokens, or device private keys
- SSH or TLS private keys, certificate issuance material, or server login details
- Local usernames, absolute personal paths, project contents, logs, or conversation data
- Relay `.env`, device registries, or credential-bearing backups

Read the full [security policy](docs/SECURITY.md) before exposing a deployment to the internet.

## Quick start

### 1. Prepare the Relay

Use a Linux host with Docker Engine and Docker Compose v2:

```bash
git clone https://github.com/xiaoxin179/codex-anywhere.git
cd codex-anywhere
./scripts/relay.sh setup
```

The public entry point must support HTTPS and WebSocket correctly. A domain is optional; an IP address with a port and a matching trusted certificate can also work. Do not expose the Relay's internal listening port directly to the internet.

### 2. Install and approve the Connector

Follow the [deployment guide](docs/deployment.md) on the computer that runs Codex. After its first connection, inspect and approve the pending device on the Relay host:

```bash
./scripts/relay.sh pending
./scripts/relay.sh approve
```

### 3. Create a phone pairing link

```bash
./scripts/relay.sh pair https://your-host.example:8443 10
```

The address is a placeholder. Replace it with your own HTTPS entry point. The final argument is the lifetime in minutes; it is optional, accepts 1–60, and defaults to 10. Never paste a real pairing link into an issue, README, commit, or public chat.

### 4. Routine administration

```bash
./scripts/relay.sh status
./scripts/relay.sh devices
./scripts/relay.sh revoke
```

On Windows, the installed Connector control helper can expose three operations: enable, disable, and show current status. Disabling should stop the running Connector and prevent automatic startup; enabling restores startup permission and launches it again.

## Development

Node.js 22 or newer is required:

```bash
npm ci
npm run check
npm run build
```

- Relay, Web, and Connector source live in this repository.
- The native Android wrapper lives in its own repository.
- `build/` and `dist/` are generated output, not hand-maintained source.
- After protocol or authentication changes, update Relay, Web, and Connector together to avoid mixed revisions.

## Documentation

- [Deployment guide](docs/deployment.md)
- [Security policy](docs/SECURITY.md)
- [Documentation index](docs/README.md)
- [Browser extension](extension/README.md)
- [Android client](https://github.com/xiaoxin179/codex-anywhere-app)

## License

This fork keeps the upstream [MIT License](LICENSE) and original copyright notice.

Thanks again to the authors and contributors of [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere). This fork would not exist without their open-source work.
