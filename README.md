# 墨发 MoFa Publish

> 🚀 **Obsidian 微信公众号一键发布插件** — 小白友好，所见即所得

将 Obsidian 笔记一键排版并发布到微信公众号，支持 10 套精美主题、数学公式、代码高亮、Mermaid 图表，告别繁琐的复制粘贴。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📋 **复制到公众号** | 一键复制排版后的富文本，到公众号编辑器 Ctrl+V 即可 |
| 📤 **发送到草稿箱** | 直接通过 API 创建草稿，自动提取标题，上传图片和封面 |
| 🎨 **15 套高级主题** | 涵盖基础、优雅、技术、创意四大系列，满足各类排版需求 |
| 🖌️ **SVG 装饰元素** | 将分割线 `<hr>` 自动降级解析为波浪、菱形、树叶等 SVG 装饰 |
| 📐 **数学公式** | 支持 `$行内公式$` 和 `$$块级公式$$`（KaTeX） |
| 💻 **代码高亮** | highlight.js 语法高亮 + 微信兼容适配 |
| 📊 **Mermaid 图表** | 自动渲染为图片，微信完美显示流程图、时序图 |
| 🖼️ **图片处理** | 支持 `![[wiki链接]]`、相对路径、网络图片，自动上传到微信 CDN |
| 🔗 **链接转脚注** | 微信不支持外链，自动转为文末脚注 |
| 📱 **多端预览** | 手机 / 电脑预览模式切换 |
| 🛠️ **自定义 CSS** | 零门槛支持从 Obsidian Vault 中读取笔记作为外部 CSS |
| 🔧 **设置面板** | 测试连接、查询公网 IP、完整帮助指南 |

## 📦 安装

### 手动安装

1. 下载最新 [Release](https://github.com/haha2345/obsidian-mofa-publish/releases)
2. 解压后将 `main.js`、`manifest.json`、`styles.css` 复制到：
   ```
   <你的Vault>/.obsidian/plugins/mofa-publish/
   ```
3. 重启 Obsidian → 设置 → 第三方插件 → 启用「墨发 MoFa Publish」

### 从源码构建

```bash
git clone https://github.com/haha2345/obsidian-mofa-publish.git
cd obsidian-mofa-publish
npm install
npm run build
```

## 🚀 快速开始

### 方式一：复制到公众号（无需配置）

1. 打开任意 Markdown 笔记
2. 点击左侧工具栏 📤 图标，打开墨发面板
3. 选择心仪的主题
4. 点击 **「📋 复制到公众号」**
5. 到微信公众号编辑器 **Ctrl+V** 粘贴，完成！

### 方式二：一键发送到草稿箱

1. 在插件设置中填写公众号 **AppID** 和 **AppSecret**
2. 点击 **「🔗 测试连接」** 确认配置正确
3. 打开笔记 → 点击 **「📤 发送到草稿箱」**
4. 到公众号后台查看草稿、预览、发布

> 💡 **需要在公众号后台「IP 白名单」中添加你的公网 IP。** 可在插件设置中点击「🌐 查询 IP」一键获取。

## 📝 Frontmatter 支持

在笔记顶部添加 frontmatter 可控制发布元数据：

```yaml
---
title: 我的文章标题
author: 作者名
digest: 文章摘要，会显示在公众号列表
thumb_media_id: 封面素材ID（可选，不填则自动用文章首图）
open_comment: true
---
```

如果不写 frontmatter：
- **标题**：自动提取文章第一个 `# 标题`，都没有则用文件名
- **封面**：自动上传文章中的第一张图片作为封面
- **作者**：留空

## 🎨 主题预览

| 分类 | 主题 | 风格 |
|------|------|------|
| 📄 **基础** | 默认白 / GitHub / 暗夜 | 干净简洁，开发者最爱，重点突出 |
| ✨ **优雅** | 樱花 / 薄荷 / 咖啡 / 水墨 / 暖橙 / 深海 / 竹韵 | 丰富的图文阅读体验，适配文青、科普等 |
| 💻 **技术** | 少数派 / 报纸 | 极客极简风，或者是经典的双线报头风 |
| 🎨 **创意** | 彩虹糖 / 极光 / 霓虹 | CSS 渐变、赛博朋克风，吸引眼球 |

> 🧩 **新增拓展功能**：可以在设置里指定一篇“自定义主题笔记”，只要在里面写上代码块，就可以自动加载进主题列表中！

## 🔧 技术栈

- **渲染引擎**：[markdown-it](https://github.com/markdown-it/markdown-it) + 插件链
- **数学公式**：[KaTeX](https://katex.org/)
- **代码高亮**：[highlight.js](https://highlightjs.org/)
- **Mermaid**：Obsidian 内置渲染 + 图像导出机制
- **微信 API**：参考多款开源工具架构，全面优化的 access_token 与素材库管理策略

## ❓ 常见问题

<details>
<summary><b>IP 不在白名单？</b></summary>

1. 在插件设置中点击「🌐 查询 IP」获取你的公网 IP
2. 到微信公众平台 → 设置与开发 → 基本配置 → IP 白名单中添加
3. ⚠️ 如果你没有固定公网 IP，路由器重启后 IP 可能变化，需要重新添加
</details>

<details>
<summary><b>图片在草稿中不显示？</b></summary>

确保你的笔记中的图片路径正确（支持 `![[image.png]]` wiki 链接和 `![](path)` 标准语法）。插件会自动上传所有图片到微信 CDN。
</details>

<details>
<summary><b>如何获取 AppID 和 AppSecret？</b></summary>

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入「设置与开发」→「基本配置」
3. 复制 AppID
4. 重置并复制 AppSecret
5. 在 IP 白名单中添加你的公网 IP
</details>

## 📄 开源协议

MIT License

## 🙏 致谢

- [note-to-mp](https://github.com/sunbooshi/note-to-mp) — 微信 API 交互方案参考
- [Obsidian](https://obsidian.md/) — 强大的笔记工具
