# Codex Anywhere

> 项目来源：本仓库基于 [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere) Fork 并继续开发。感谢原作者 gaotong132 开源项目和奠定基础。本仓库的后续改动由 Fork 维护者负责，不代表原作者的发布版本或支持承诺。

[English](README.md) | 简体中文 · [MIT 许可证](LICENSE)

Codex Anywhere 是面向个人使用的自托管远程 Codex 界面。手机通过浏览器或[独立安卓客户端](https://github.com/xiaoxin179/codex-anywhere-app)访问转发服务，再与电脑上的 Connector 建立加密通道。**默认的个人部署中，Codex 和项目文件仍在自己的电脑上；服务器只负责接入、设备认证和转发，不代替电脑运行 Agent。**

本项目与 OpenAI 没有关联，也未得到 OpenAI 的认可或背书。

## 这份 Fork 增加了什么

- 更接近 Codex 的简约浅色界面：项目分组、会话折叠、任务搜索、未读状态，以及生成回复时的加载圆环。
- 支持在手机上查看并继续 Codex 会话、发送文字和图片、跟进任务进度、查看文件与代码变更，并在确认后下载文件。具体能力取决于所连接的 Codex 环境。
- 单次配对链接可设置 **1–60 分钟**有效期，默认 10 分钟。链接过期不影响已配对设备；设备以后使用自己的密钥重新连接。
- 可查看已批准设备及其在线记录，并撤销设备。服务器批准 Connector 之后，本机仍可通过停止 Connector、禁止其自动启动来单方面关闭远程访问。
- 安卓客户端单独维护，不与 Relay/Web 源码混在一起。App 从完整配对链接读取服务器地址和入口路径，源码中不写死某台服务器；配对后使用系统 WebView 承载同一套 Web 界面。
- 支持按执行环境隔离会话。除 Windows 电脑上的 Codex Desktop 外，也可以自行配置 Linux 无头执行节点；这不是使用远程电脑的必需条件。

## 工作原理

```text
手机浏览器 / 安卓 App
        │ HTTPS / WSS
        ▼
   自托管 Relay（接入、认证、密文转发）
        ▲
        │ Connector 主动建立出站连接
        │
   自己的 Windows 电脑 ── Codex Desktop / 本机项目文件
```

电脑不需要开放入站端口。Relay 负责验证已批准的设备并转发加密消息，不保存 Codex 会话数据库；Codex 实际执行和文件读取发生在选中的 Connector 所在机器。可选的 Linux Connector 也是独立的执行节点，不会自动接管 Windows 会话。

## 安全边界

- 手机首次接入使用一次性配对链接。配对后，设备私钥留在手机浏览器或安卓 WebView 的站点数据里；服务器保存批准记录和公钥，不保存可恢复的配对链接或设备私钥。
- 浏览器与 Connector 之间建立经过身份验证的端到端加密通道。公网入口仍应使用 HTTPS/WSS；随机入口路径只是减少随手扫描，**不能代替认证**。
- Relay 主机仍需被信任：它提供网页代码、管理设备信任，并能观察连接时间和流量大小。设备失窃、浏览器数据泄露、电脑或服务器被入侵时，加密不能消除所有风险。
- 不使用时可以关闭本机 Connector，并禁止其自动启动；撤销丢失的手机时还应在 Relay 上撤销该设备。不要把 Connector 凭据、私钥、配对链接或个人部署地址提交到 Git。
- 清除安卓 App 的“缓存”通常不会删除配对身份；清除“数据/存储”可能删除 WebView 设备私钥，需要重新配对。

更完整的威胁边界参见[安全说明](docs/SECURITY.zh-CN.md)。

## 快速开始

需要一台安装 Docker Engine 与 Docker Compose v2 的 Linux 主机作为 Relay，以及一台安装 Codex Desktop/CLI、Node.js 22+ 和 PowerShell 的 Windows 电脑作为执行节点。公网部署请先准备可信的 HTTPS/WSS 入口；可以使用域名，也可以使用带端口的公网 IP 和匹配的证书。**不要直接把 Relay 的回环服务端口暴露到公网。**

在 Relay 主机上获取这份 Fork 并完成初始化：

```bash
git clone https://github.com/xiaoxin179/codex-anywhere.git
cd codex-anywhere
./scripts/relay.sh setup
```

随后按[部署指南](docs/deployment.zh-CN.md)安装本地 Connector。它首次连接后，在 Relay 主机批准设备并生成一次性配对链接：

```bash
./scripts/relay.sh approve
./scripts/relay.sh pair https://your-host.example:8443 10
```

这里的地址和端口**只是占位示例**，应换成自己的 HTTPS 入口；不要把生成的真实配对链接写入文档或聊天记录。有效期参数可省略（默认 10 分钟），允许范围为 1–60 分钟。

日常设备管理：

```bash
./scripts/relay.sh devices
./scripts/relay.sh revoke
```

安卓 App 的源码、构建与配对说明见独立仓库 [codex-anywhere-app](https://github.com/xiaoxin179/codex-anywhere-app)。使用 App 不要求把服务器地址编译进 APK；首次打开时粘贴完整的 HTTPS 配对链接即可。Web 界面更新通常不需要重新安装 APK。

## 开发与项目边界

```bash
npm ci
npm run check
npm run build
```

Relay/Web/Connector 源码保存在本仓库，安卓原生外壳保存在独立仓库。本仓库的 `build/` 和 `dist/` 为构建产物。详细部署参数、可选 Linux 执行节点及维护命令见[部署指南](docs/deployment.zh-CN.md)，扩展功能见[浏览器扩展说明](extension/README.zh-CN.md)。

本项目沿用上游的 [MIT 许可证](LICENSE)，保留原作者版权声明。感谢上游作者和贡献者。
