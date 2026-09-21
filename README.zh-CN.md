# Codex Anywhere

> **项目来源与致谢**
>
> 本仓库 Fork 自 [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere)，感谢原作者 **gaotong132** 及所有上游贡献者完成并开源了项目的核心架构。本 Fork 在原项目基础上继续进行界面、远程控制、安全机制、设备管理和移动端适配等改造。这里的新增功能和部署方式由本仓库维护者独立负责，不代表原作者的发布版本或支持承诺。

[English](README.md) | 简体中文 · [MIT 许可证](LICENSE)

一个面向个人使用的自托管 Codex 远程访问方案。它让你可以从手机浏览器或独立 Android 客户端查看并继续电脑上的 Codex 任务，而 Codex、项目源码和实际执行环境仍保留在自己的电脑上。

> [!IMPORTANT]
> 本项目是非官方社区项目，与 OpenAI 无隶属或背书关系。它更适合单个可信用户使用，不应直接作为多租户公共服务部署。

## 项目定位

Codex Anywhere 由三个部分组成：

- **Relay 服务器**：提供公网入口、设备认证、在线状态和加密流量转发。
- **Connector**：运行在自己的 Windows 或 Linux 电脑上，主动连接 Relay，并与本机 Codex 环境通信。
- **Web / Android 客户端**：用于查看任务、发送消息、处理审批和管理会话。

Relay 不是 Codex 的运行主机。默认架构中，项目文件不会为了远程访问而同步到 Relay，服务器也不保存一份 Codex 对话数据库。

```text
手机浏览器 / Android App
          │
          │ HTTPS / WSS
          ▼
     自托管 Relay
  接入 · 认证 · 密文转发
          ▲
          │ Connector 主动建立出站连接
          │
    自己的 Windows / Linux 电脑
      Codex · 项目文件 · 执行环境
```

## 本 Fork 的主要改动

### Codex 风格的移动界面

- 简约浅色视觉风格，针对手机屏幕重新组织导航和信息层级。
- 按项目分组、折叠和搜索会话，并显示未读与任务运行状态。
- 任务回复中显示加载动画，区分正在生成和已经完成的会话。
- 支持发送文字与图片、查看 Markdown、代码块、文件预览、代码变更和可视化内容。
- 可选中 AI 回复中的文字，将一个或多个片段作为引用加入输入区后继续提问。

### 配对与设备管理

- 首次访问使用一次性配对链接，可设置 **1–60 分钟**有效期，默认 10 分钟。
- 配对链接过期只影响尚未使用的首次登记，不会让已经配对的手机在十分钟后掉线。
- 配对成功后，设备使用自己的密钥重新认证，不需要反复输入同一条链接。
- 可查看已批准设备、在线状态、连接次数和最近活动时间，并撤销不再信任的设备。
- Connector 首次连接也必须由 Relay 管理员明确批准，不会因为知道服务器地址就自动获得权限。

### 电脑端自主控制

- Connector 只建立出站连接，电脑无需向公网开放入站端口。
- 服务器批准 Connector 后，电脑仍可以通过停止 Connector 单方面拒绝远程连接。
- Windows 辅助脚本可用于启用、关闭和查看 Connector 状态，并控制是否允许自动启动。
- Relay 授权和本机 Connector 开关共同生效，避免服务器单方面决定电脑是否开放。

### Android 客户端

Android 外壳在独立仓库维护：[xiaoxin179/codex-anywhere-app](https://github.com/xiaoxin179/codex-anywhere-app)。

- App 不写死某一台服务器、配对链接或个人凭据。
- 首次打开时输入完整配对链接，之后由 WebView 保存该设备的配对身份。
- “重新配对”位于连接状态菜单中，不长期占用主界面。
- 一般的 Web 界面更新只需重新打开 App，不需要重新安装 APK。
- 清除缓存通常不会删除配对身份；清除应用数据或 WebView 存储后可能需要重新配对。

## 安全设计与边界

- 浏览器和 Connector 使用各自的设备密钥。Relay 保存公钥、批准记录和必要的连接状态，不保存设备私钥。
- 一次性配对凭证通过 URL fragment 传递，消费后失效；Relay 只暂存其不可逆校验值和到期时间。
- 浏览器与 Connector 建立经过身份验证的端到端加密通道，Relay 负责路由密文。
- 公网入口应使用 HTTPS/WSS。随机入口路径只能降低被随手扫描发现的概率，**不能替代身份认证**。
- Relay 仍是需要信任的基础设施：它提供客户端网页、管理设备信任，并可以观察连接时间和流量大小。
- 丢失手机后应及时撤销对应设备；不使用远程访问时，可以在电脑上关闭 Connector。

在公开仓库中请始终排除以下内容：

- 真实公网 IP、管理端口和私有入口路径
- 一次性配对链接、Connector Token 与设备私钥
- SSH 私钥、TLS 私钥、证书签发材料和服务器登录信息
- 本机用户名、绝对目录、项目内容、日志与个人会话数据
- Relay 的 `.env`、设备登记文件及任何包含凭据的备份

更完整的威胁模型与实现约束请阅读[安全说明](docs/SECURITY.zh-CN.md)。

## 快速开始

### 1. 准备 Relay

Relay 推荐运行在安装了 Docker Engine 与 Docker Compose v2 的 Linux 主机上：

```bash
git clone https://github.com/xiaoxin179/codex-anywhere.git
cd codex-anywhere
./scripts/relay.sh setup
```

公网入口必须正确支持 HTTPS 和 WebSocket。域名不是强制要求，也可以使用带端口的公网 IP 和与该地址匹配的可信证书。不要把 Relay 的内部监听端口直接暴露到公网。

### 2. 安装并批准 Connector

按照[部署指南](docs/deployment.zh-CN.md)在自己的电脑上安装 Connector。它首次连接后，在 Relay 主机上查看并批准待登记设备：

```bash
./scripts/relay.sh pending
./scripts/relay.sh approve
```

### 3. 生成手机配对链接

```bash
./scripts/relay.sh pair https://your-host.example:8443 10
```

示例地址只是占位符，请替换为自己的 HTTPS 入口。最后的数字代表链接有效分钟数，可省略；允许范围为 1–60，默认 10。不要把真实链接粘贴到 Issue、README、提交记录或公开聊天中。

### 4. 日常管理

```bash
./scripts/relay.sh status
./scripts/relay.sh devices
./scripts/relay.sh revoke
```

Windows 端可以使用自行安装的 Connector 控制脚本执行三类操作：启用、关闭、查看当前状态。关闭时应同时停止运行中的 Connector，并禁止其自动启动；再次启用时恢复启动权限并启动 Connector。

## 开发

要求 Node.js 22 或更高版本：

```bash
npm ci
npm run check
npm run build
```

- Relay、Web 与 Connector 源码位于本仓库。
- Android 原生外壳位于独立仓库，不与本仓库源码混放。
- `build/` 与 `dist/` 是构建产物，不应作为手工维护的源码。
- 修改协议或认证逻辑后，应同时更新 Relay、Web 和 Connector，避免不同版本混用。

## 文档

- [部署指南](docs/deployment.zh-CN.md)
- [安全说明](docs/SECURITY.zh-CN.md)
- [文档索引](docs/README.zh-CN.md)
- [浏览器扩展](extension/README.zh-CN.md)
- [Android 客户端](https://github.com/xiaoxin179/codex-anywhere-app)

## 开源许可

本 Fork 沿用上游项目的 [MIT License](LICENSE)，并保留原始版权声明。

再次感谢 [gaotong132/codex-anywhere](https://github.com/gaotong132/codex-anywhere) 的作者和贡献者。没有上游项目的开源工作，就不会有这份 Fork 的后续改造。
