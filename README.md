# 墨发 MoFa Publish

> 🚀 **Obsidian 微信公众号一键发布插件** — 小白友好，所见即所得

将 Obsidian 笔记一键排版并发布到微信公众号，支持 10 套精美主题、数学公式、代码高亮、Mermaid 图表，告别繁琐的复制粘贴。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📋 **复制到公众号** | 一键复制排版后的富文本，到公众号编辑器 Ctrl+V 即可 |
| 📤 **发送到草稿箱** | 直接通过 API 创建草稿，自动上传图片和封面 |
| 🎨 **10 套内置主题** | 默认白、GitHub、暗夜、樱花、薄荷、咖啡、水墨、暖橙、少数派、彩虹糖 |
| 📐 **数学公式** | 支持 `$行内公式$` 和 `$$块级公式$$`（KaTeX） |
| 💻 **代码高亮** | highlight.js 语法高亮 + 可选行号 |
| 📊 **Mermaid 图表** | 自动渲染为图片，微信完美显示 |
| 🖼️ **图片处理** | 支持 `![[wiki链接]]`、相对路径、网络图片，自动上传到微信 CDN |
| 🔗 **链接转脚注** | 微信不支持外链，自动转为文末脚注 |
| 📱 **多端预览** | 手机 / 电脑预览模式切换 |
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

| 主题 | 风格 |
|------|------|
| 默认白 | 简洁大方，适合大多数内容 |
| GitHub | 程序员最爱的 GitHub 风格 |
| 暗夜 | 深色主题，适合技术文章 |
| 樱花 | 粉色系，适合生活/情感类 |
| 薄荷 | 清新绿色，适合教程类 |
| 咖啡 | 衬线字体，适合深度长文 |
| 水墨 | 中国风排版，首行缩进 |
| 暖橙 | 温暖橙色系，适合推荐类 |
| 少数派 | 致敬少数派的红色强调风 |
| 彩虹糖 | 渐变彩色，适合创意内容 |

## 🔧 技术栈

- **渲染引擎**：[markdown-it](https://github.com/markdown-it/markdown-it) + 插件链
- **数学公式**：[KaTeX](https://katex.org/)
- **代码高亮**：[highlight.js](https://highlightjs.org/)
- **Mermaid**：Obsidian 内置渲染 + [html-to-image](https://github.com/bubkoo/html-to-image) 转 PNG
- **微信 API**：参考 [note-to-mp](https://github.com/sunbooshi/note-to-mp) 的实战方案

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
