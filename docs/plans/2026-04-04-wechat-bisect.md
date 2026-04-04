# WeChat Bisect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为当前文档增加“真实上传排除法”命令，自动定位触发微信 `45166` 的最小失败元素或元素组合。

**Architecture:** 先复用现有正式发布管线生成最终 `sanitizedHtml`，再基于 `.mofa-article` 子节点构建候选块数组，通过 delta debugging 对真实上传结果做缩小；上传记录和最终失败片段统一写入 `_mofa_debug/bisect/`。

**Tech Stack:** TypeScript, Obsidian Plugin API, 微信 `draft/add` 接口, Node `node:test`

---

### Task 1: 建立 bisect 纯函数

**Files:**
- Create: `src/utils/wechat-bisect.ts`
- Test: `tests/wechat-bisect.test.ts`

**Step 1: Write the failing test**

覆盖：
- 单元素触发失败时返回单元素
- 双元素组合触发失败时返回双元素
- 预览文本裁剪

**Step 2: Run test to verify it fails**

Run: `npm test`

**Step 3: Write minimal implementation**

补 `splitIntoGroups`、`deltaDebug`、`clipPreviewText`。

**Step 4: Run test to verify it passes**

Run: `npm test`

### Task 2: 接入 publish-view 真实上传排除法

**Files:**
- Modify: `src/publish-view.ts`

**Step 1: 抽取可复用的正式发布上下文准备逻辑**

复用现有 token、封面、图片上传、sanitize 逻辑。

**Step 2: 增加真实试投与 bisect 报告落盘**

输出：
- 每次请求完整 payload
- 原始文档 ID
- 请求/响应时间
- 微信回包

**Step 3: 增加对 45166 以外错误的中止逻辑**

避免把限流或鉴权错误误判为内容错误。

**Step 4: Run test and build**

Run:
- `npm test`
- `npm run build`

### Task 3: 增加命令入口并同步插件

**Files:**
- Modify: `src/main.ts`
- Optionally Modify: `src/publish-view.ts`

**Step 1: 添加命令**

命令名建议：`定位当前文档出错元素`

**Step 2: 构建并同步到 myVault**

Run:
- `npm run build`
- `cp main.js manifest.json styles.css /Users/mysterio/Documents/myVault/.obsidian/plugins/mofa-publish/`
