# 云效 Bug 上报助手 (Chrome 浏览器扩展)

参考 iOS 端 [YunxiaoBugReporter](file:///Users/dimoo/Desktop/demo/YunxiaoBugReporter) 核心架构与功能开发的 Chrome 浏览器扩展。支持在浏览器上**一键截图标注、自动采集当前页面与网络轨迹、AI 智能整理描述，直连阿里云效（Projex）创建 Bug 工作项**。

---

## 🌟 核心特性

- 🎯 **Side Panel 常驻交互**：采用 Chrome Side Panel（右侧常驻侧边栏），避免传统 Popup 弹窗失去焦点自动关闭而丢失填写草稿的问题，边看网页边提单。
- 📸 **高清截屏与 Canvas 标注器**：
  - 支持一键截取当前可见网页、粘贴剪贴板截图 (`Cmd/Ctrl+V`)、本地图片上传；
  - 内置基于 HTML5 Canvas 的**红框框选**与**红箭头指向**标注器，归一化坐标存储，支持随时撤销/清除与原图自然分辨率烘焙。
- 🔍 **环境与证据自动采集**：
  - 自动捕获当前页面的 URL、路由、标题、视口尺寸、浏览器与操作系统、网络状态；
  - 监听并记录最近 50 条 DOM 点击与路由轨迹；
  - 拦截并脱敏记录最近 20 条 `fetch`/`XHR` 网络请求（含请求路径、耗时、状态码、脱敏后请求体/响应体），提单时一次性冻结快照；
  - 自动捕获控制台报错（`console.error` 与未捕获异常）。
- ✨ **Bug AI 智能整理（可选）**：
  - 支持配置 Bug AI 服务，一键将粗略描述与页面上下文整理为规范的标题、问题现象、复现步骤与期望结果。
- 🏷️ **快捷分类与云效动态字段**：
  - 问题类型（UI / 功能 / 崩溃 / 卡顿 / 网络 / 数据）、严重程度、发生频率胶囊选择；
  - 自动拉取当前项目 Bug 类型的必填列表字段（如优先级、环境等）动态渲染，自动带入默认值。
- 📋 **Bug 列表与工作项详情**：
  - 支持切换组织下不同项目（按创建时间倒序，默认选中最新项目）；
  - 分页浏览 Bug 工作项，查看编号、状态、负责人、创建时间；
  - 支持查看工作项详情，自动解析 Markdown/HTML/jsonML 描述，通过 `GetWorkitemFile` 接口换取预签名临时下载地址渲染鉴权内嵌图片，并支持一键在云效 Web 端打开。
- ⚡ **稳健性与配置管理**：
  - 支持中心版 (`standard`) 与 Region 版 (`region`)；
  - **组织 ID 可在设置中自由填写与保存**；
  - **项目 ID 无需在设置中填写**，在「提交 Bug」或「Bug 列表」顶部下拉列表中直接选择与切换，切换时自动同步项目成员与自定义必填字段；
  - 附件并发上传，支持部分成功容错；
  - 自动嵌入图片片段更新描述；
  - 收到 HTTP 401 时自动清空 Token 缓存并重试。

---

## 🚀 安装与加载方式

### 方式一：下载 GitHub 自动构建产物（推荐）

无需本地配置 Node.js 环境，直接下载构建好的扩展压缩包即可使用：

1. 前往本仓库的 [Releases 页面](https://github.com/zhangsiqiang07/yunxiao_chrome_plugins/releases) 下载最新版本的 **`yunxiao-bug-reporter-chrome.zip`**（包含正式版 Tag 与 `Latest Build` 预发布版；也可在 [Actions 页面](https://github.com/zhangsiqiang07/yunxiao_chrome_plugins/actions) 的最近一次成功构建中下载 Artifact）；
2. 将压缩包解压到一个**不会被轻易移动或删除**的本地文件夹（确保文件夹内直接包含 `manifest.json` 等文件）；
3. 打开 Chrome 浏览器，在地址栏访问 `chrome://extensions/`；
4. 在右上角开启 **「开发者模式」 (Developer mode)**；
5. 点击左上角的 **「加载已解压的扩展程序」 (Load unpacked)**，选择刚才解压出来的文件夹；
6. 扩展安装完成后，点击浏览器右上角的拼图图标，将 **「云效 Bug 上报助手」** 固定到工具栏即可使用。

> 💡 **后续更新**：下载新版 `yunxiao-bug-reporter-chrome.zip` 解压覆盖原文件夹，然后在 `chrome://extensions/` 页面点击该扩展卡片上的 **刷新** 按钮即可完成更新。

### 方式二：从源码本地构建安装

如果你需要二次开发或自行打包：

```bash
git clone [https://github.com/zhangsiqiang07/yunxiao_chrome_plugins.git](https://github.com/zhangsiqiang07/yunxiao_chrome_plugins.git)
cd yunxiao_chrome_plugins

# 安装依赖
npm install

# 生产构建（输出至 dist/ 目录）
npm run build

---

## ⌨️ 快捷键

- `Alt + Shift + B`：快速打开/关闭云效 Bug 上报侧边栏；
- `Command + Shift + Y`（Windows: `Ctrl + Shift + Y`）：**一键截取当前网页并自动带入侧边栏打开提 Bug 界面**。

---

## 🛠️ 本地开发与构建

```bash
cd /Users/dimoo/Desktop/demo/yunxiao_chrome_plugins

# 安装依赖
npm install

# 监听开发
npm run dev

# 生产构建
npm run build
```
构建产物将输出至 `dist/` 目录。
