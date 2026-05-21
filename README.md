# Claudex

[Claude Code CLI](https://docs.anthropic.com/claude-code) 的桌面管理器。可以把它理解为 Claude Code 的「Codex 风格」客户端：UI 不取代 `claude` CLI，而是在外层做项目/会话/配置的可视化管理，把真正的对话交给底层的 `claude` 终端代理执行。

界面是亮色暖白主题，全中文。

---

## 功能概览

### 项目与会话（侧边栏，扁平树）
- **项目卡片**：注册任意工作目录为项目，支持收藏排序、Finder 中打开、移除
- **历史会话**：直接读 `~/.claude/projects/*.jsonl`，每个会话显示首句、最近一句、真实回合数（**只数真实用户消息，不再把 tool_result 当成对话条数**）
- **未注册目录**：在 `~/.claude/projects/` 中发现但未添加为项目的目录会列在底部，一键「加入」即可注册
- **搜索**：按项目名、路径、对话内容关键词跨项目过滤

### 多会话终端
- 每个 tab 一个独立的 PTY 子进程，互不干扰
- tab 标题包含会话首句截断 + sessionId 短前缀，**同一项目下多个恢复出来的会话肉眼可辨**
- 每个 tab 左侧有基于 `sessionId` 哈希的色条（同会话同色、异会话异色），加上 ↻ 图标标记是否为恢复模式
- 状态点（绿/黄/灰）显示运行中 / 启动中 / 已退出

### 配置编辑器
- `~/.claude/settings.json`：默认模型、输出风格、API Key 辅助脚本、工具权限（总是允许 / 拒绝 / 询问）、环境变量。有可视化 / 原始 JSON 双视图

---

## 技术栈

| 分层 | 技术 | 作用 |
|---|---|---|
| 应用壳 | **Electron 33** | 把 web 应用包装成原生 macOS / Linux / Windows app |
| 构建 | **Vite** + `vite-plugin-electron` | 主进程 / 预加载 / 渲染进程一套构建管线，dev 模式 HMR |
| UI | **React 18** + TypeScript + **TailwindCSS** + Lucide | 组件 + 工具类样式 + 图标 |
| 状态 | **Zustand** | 项目列表、tab、视图状态 |
| 终端 | **xterm.js** + **node-pty** | 浏览器端模拟终端 + Node 端 spawn 真 PTY 子进程 |
| 持久化 | **electron-store** | 项目元数据（`~/Library/Application Support/Claudex/`） |
| 打包 | **electron-builder** | 输出 `.dmg` / `.app` / `.AppImage` / `.exe` |

### 目录结构

```
claudex/
├── electron/                 主进程（Node.js + Electron）
│   ├── main.ts              创建窗口、注册 IPC
│   ├── preload.ts           安全地把 IPC 暴露给渲染层
│   ├── pty.ts               node-pty 启动 claude 子进程
│   ├── projects.ts          项目 CRUD（基于 electron-store）
│   ├── sessions.ts          解析 ~/.claude/projects/*.jsonl
│   └── config.ts            读写 settings.json / CLAUDE.md
├── shared/ipc.ts            主/渲染共享的 IPC 类型 + 通道名
├── src/                     渲染进程（React 应用）
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar.tsx       项目+会话扁平树
│   │   ├── TerminalsView.tsx 终端 tab 条
│   │   ├── Terminal.tsx      xterm 实例 + PTY 桥接
│   │   └── SettingsView.tsx
│   ├── store/useStore.ts    Zustand
│   └── styles/index.css     Tailwind
├── tailwind.config.js       亮色主题色板
├── vite.config.ts           主/渲染/preload 三套 Vite 配置
└── package.json
```

### 数据流（终端会话为例）

```
xterm.js (渲染进程) ──IPC pty:write──→ node-pty (主进程) ──→ claude CLI 子进程
                  ←──IPC pty:data───                      ←
```

会话恢复时 Claudex 自动注入 `--resume <sessionId>` 参数。所有子进程都用 `<login shell> -l -i -c 'exec claude ...'` 形式启动，保证 `nvm` / `fnm` / `mise` / `Homebrew` 等 shim 都能加载，行为与你在 Terminal.app 里直接敲 `claude` 一致。

---

## 环境要求

- **Node.js ≥ 20**
- **Claude Code CLI** 已安装且 `claude` 命令在登录 shell 的 `PATH` 里
  ```bash
  npm i -g @anthropic-ai/claude-code
  ```
- macOS（主要测试平台） / Linux / Windows

---

## 开发模式

第一次拉下来：

```bash
npm install
```

`postinstall` 会自动跑 `electron-builder install-app-deps`，把 `node-pty` 这种 native 模块对着当前 Electron 的 ABI 重编译。

启动开发：

```bash
npm run dev
```

会同时启动：
- Vite dev server（端口 5173，渲染层 HMR）
- Vite 构建主进程 / preload，监听变化
- Electron 自动加载 `http://localhost:5173`

修改 `src/**` 渲染层文件 → 浏览器式 HMR 立即生效  
修改 `electron/**` 或 `shared/**` → 主进程重启，需要等 1~2 秒

### 常见问题

**`node-pty` ABI 报错**（升级 Node / Electron 后）：
```bash
npm run rebuild
```

**PostCSS 提示 `text-ink` 不存在**：Tailwind 配置改了之后需要完全重启 Vite，dev server 不会自动重读 `tailwind.config.js`。`Ctrl+C` 后 `npm run dev` 重启即可。

---

## 打包正式版

### 一键打安装包

```bash
npm run build
```

这条命令会依次：
1. `tsc -b` — TypeScript 类型检查 + 增量编译
2. `vite build` — 构建渲染层到 `dist/`，主进程到 `dist-electron/`
3. `electron-builder` — 把上面的产物打成系统安装包

输出目录：`./release/`

macOS arm64 上典型产物：
- `release/Claudex-0.1.0-arm64.dmg` — 双击安装的 dmg 镜像
- `release/mac-arm64/Claudex.app` — 已签名（ad-hoc）的 .app 包，可直接拖进 `/Applications/`

> **首次打包会比较慢**：electron-builder 要下载对应平台的 Electron 二进制并做签名，可能几分钟。后续打包用缓存会快很多。

### 仅构建产物，不打安装包（快速验证用）

```bash
npm run build:dir
```

输出到 `release/mac-arm64/Claudex.app`（或对应平台目录），跳过 dmg / 签名步骤。

### 启动正式构建

**安装到系统：**
1. `npm run build`
2. 双击 `release/Claudex-*.dmg`，把 `Claudex.app` 拖进 `Applications`
3. Spotlight 搜索 `Claudex` 启动，或终端 `open -a Claudex`

**直接跑构建产物（不安装）：**
```bash
open release/mac-arm64/Claudex.app
```

### macOS 第一次打开提示「无法验证开发者」

因为没有配置 Apple Developer ID 证书，系统会拦截。两种解决：

**方法 1（推荐）：去掉 quarantine 标记**
```bash
xattr -dr com.apple.quarantine /Applications/Claudex.app
```

**方法 2：UI 操作**
- 「系统设置 → 隐私与安全性」→ 拉到底，在「Claudex 已被阻止」旁点击「仍要打开」

如果未来要发布给别人，建议申请 Apple Developer ID 并在 `package.json` 的 `build` 字段里配置签名：
```json
"build": {
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAMID)"
  }
}
```

---

## 脚本速查

| 命令 | 说明 |
|---|---|
| `npm install` | 安装依赖，自动重编译 native 模块 |
| `npm run dev` | 开发模式，热更新 |
| `npm run build` | 完整打包，输出 `.dmg` / 安装包 |
| `npm run build:dir` | 只产出 `.app` 目录，跳过 dmg/签名 |
| `npm run rebuild` | 强制重编译 `node-pty` |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | 仅做 TypeScript 类型检查 |

---

## 数据存储位置

| 内容 | 路径 |
|---|---|
| 项目列表元数据 | `~/Library/Application Support/Claudex/config.json`（macOS） |
| Claude Code 全局配置 | `~/.claude/settings.json` |
| 全局记忆 | `~/.claude/CLAUDE.md` |
| 历史会话日志 | `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` |

Claudex 不会动 `~/.claude/projects/` 里的内容，只读取并解析。

---

## 路线图

- 基于 jsonl 的成本 / 用量看板
- subagents 和 slash command 管理
- Hooks 编辑器
- 项目级 `.claude/settings.json` 覆盖配置
- 旁路渲染：在终端旁边再开一个原生 chat 视图（流式读取 jsonl）

