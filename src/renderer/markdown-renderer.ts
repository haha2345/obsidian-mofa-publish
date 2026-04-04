import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import mk from 'markdown-it-katex';
import { processLinksToFootnotes, processLinksInline } from '../utils/link-handler';
import type { MofaSettings } from '../settings';
import { App, TFile } from 'obsidian';

/**
 * 墨发 Markdown 渲染引擎
 * 将 Markdown 转换为微信公众号兼容的 HTML
 */
export class MarkdownRenderer {
    private md: MarkdownIt;
    private settings: MofaSettings;
    private app: App;

    constructor(settings: MofaSettings, app: App) {
        this.settings = settings;
        this.app = app;
        this.md = this.createMarkdownIt();
    }

    private createMarkdownIt(): MarkdownIt {
        const md = new MarkdownIt({
            html: true,
            breaks: true,
            linkify: true,
            typographer: true,
            highlight: (str: string, lang: string) => {
                // Mermaid 代码块特殊处理，不做高亮，后续由 mermaid-renderer 处理
                if (lang === 'mermaid') {
                    return `<div class="mofa-mermaid" data-mermaid="${this.escapeHtml(str)}">${this.escapeHtml(str)}</div>`;
                }

                // 数学公式代码块
                if (lang === 'latex' || lang === 'am' || lang === 'asciimath') {
                    return `<div class="mofa-math" data-lang="${lang}">${this.escapeHtml(str)}</div>`;
                }

                // 常规代码高亮
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        const highlighted = hljs.highlight(str, { language: lang }).value;
                        return this.wrapCodeBlock(highlighted, lang);
                    } catch (e) {
                        console.error('代码高亮失败:', e);
                    }
                }

                // 无法识别语言时，尝试自动检测
                try {
                    const result = hljs.highlightAuto(str);
                    return this.wrapCodeBlock(result.value, result.language || '');
                } catch {
                    return this.wrapCodeBlock(this.escapeHtml(str), '');
                }
            },
        });

        // 加载插件
        md.use(footnote);
        md.use(taskLists, { enabled: true });
        // KaTeX 数学公式：支持 $inline$ 和 $$block$$ 语法
        md.use(mk, {
            throwOnError: false,
            errorColor: '#cc0000',
        });

        return md;
    }

    /**
     * 渲染 Markdown 为 HTML（不含主题样式）
     * @param markdown - Markdown 源文本
     * @param sourcePath - 当前笔记文件路径（用于解析相对路径图片）
     */
    render(markdown: string, sourcePath?: string): string {
        // 1. 分离 frontmatter
        const { content } = this.extractFrontmatter(markdown);

        // 2. 预处理 Obsidian wiki-link 图片语法
        //    ![[image.png]]        → ![](image.png)
        //    ![[image.png|300]]    → ![](image.png){width=300}
        //    ![[image.png|alt文字]] → ![alt文字](image.png)
        let processed = this.preprocessWikiImages(content);

        // 2.5 预处理 Obsidian Callout 语法（> [!NOTE] 等）为 HTML
        processed = this.preprocessCallouts(processed);

        // 3. 处理链接（微信不支持外链）
        if (this.settings.linkStyle === 'footnote') {
            processed = processLinksToFootnotes(processed);
        }

        // 4. 渲染 Markdown → HTML
        let html = this.md.render(processed);

        // 4.1 清理空的列表项（breaks:true 导致的各种空 li）
        // 匹配：<li></li>, <li>\n</li>, <li><br></li>, <li><p></p></li>, <li><p><br></p></li>
        html = html.replace(/<li>\s*(<br\s*\/?>)?\s*<\/li>/gi, '');
        html = html.replace(/<li>\s*<p>\s*(<br\s*\/?>)?\s*<\/p>\s*<\/li>/gi, '');
        // 清理空行产生的多余换行
        html = html.replace(/\n{3,}/g, '\n\n');

        // 5. 如果是 inline 链接模式，后处理 HTML
        if (this.settings.linkStyle === 'inline') {
            html = processLinksInline(html);
        }

        // 6. 解析图片路径为 Obsidian 资源 URL（预览时能正常显示）
        if (sourcePath) {
            html = this.resolveImagePaths(html, sourcePath);
        }

        return html;
    }

    /**
     * 将 Obsidian Callout 语法转换为 HTML div
     * 格式：> [!TYPE] 标题\n> 内容
     * 支持类型：NOTE / TIP / IMPORTANT / WARNING / CAUTION
     */
    private preprocessCallouts(markdown: string): string {
        const calloutIcons: Record<string, string> = {
            NOTE: '📖',
            TIP: '💡',
            IMPORTANT: '❗',
            WARNING: '⚠️',
            CAUTION: '🔥',
            INFO: 'ℹ️',
            SUCCESS: '✅',
            ERROR: '❌',
            QUESTION: '❓',
            QUOTE: '💬',
            ABSTRACT: '📌',
        };
        const calloutColors: Record<string, string> = {
            NOTE: '#e0f0ff', TIP: '#e6f9e6', IMPORTANT: '#f0e0ff',
            WARNING: '#fff3cd', CAUTION: '#fdecea', INFO: '#e0f0ff',
            SUCCESS: '#e6f9e6', ERROR: '#fdecea', QUESTION: '#fff3cd',
            QUOTE: '#f4f4f4', ABSTRACT: '#f0e0ff',
        };
        const calloutBorder: Record<string, string> = {
            NOTE: '#3b82f6', TIP: '#22c55e', IMPORTANT: '#a855f7',
            WARNING: '#f59e0b', CAUTION: '#ef4444', INFO: '#3b82f6',
            SUCCESS: '#22c55e', ERROR: '#ef4444', QUESTION: '#f59e0b',
            QUOTE: '#aaa', ABSTRACT: '#a855f7',
        };

        // 匹配整个 callout 块：以 "> [!TYPE]" 开头，连续的 "> " 行为内容
        return markdown.replace(
            /^(>\s*\[!(\w+)\]([^\n]*)(?:\n>[^\n]*)*)/gm,
            (block) => {
                const lines = block.split('\n');
                const firstLine = lines[0];
                const typeMatch = firstLine.match(/^>\s*\[!(\w+)\]\s*(.*)/);
                if (!typeMatch) return block;

                const type = typeMatch[1].toUpperCase();
                const titleText = typeMatch[2].trim();
                const icon = calloutIcons[type] || '📖';
                const bg = calloutColors[type] || '#e0f0ff';
                const border = calloutBorder[type] || '#3b82f6';
                const displayTitle = titleText || type;

                // 提取内容行（去掉开头 > ）
                const bodyLines = lines.slice(1).map((l) => l.replace(/^>\s?/, ''));
                const body = bodyLines.join('\n').trim();

                return [
                    `<div class="mofa-callout" style="background:${bg};border-left:4px solid ${border};border-radius:4px;padding:12px 16px;margin:1em 0;">`,
                    `<div class="mofa-callout-title" style="font-weight:700;margin-bottom:${body ? '6px' : '0'};">${icon} ${displayTitle}</div>`,
                    body ? `<div class="mofa-callout-body">${body}</div>` : '',
                    `</div>`,
                ].filter(Boolean).join('\n');
            }
        );
    }

    /**
     * 预处理 Obsidian wiki-link 图片
     */
    private preprocessWikiImages(content: string): string {
        // ![[image.png|300]] 或 ![[image.png|alt文字]] 或 ![[image.png]]
        return content.replace(/!\[\[([^\]]+)\]\]/g, (match, inner) => {
            const parts = inner.split('|');
            const filePath = parts[0].trim();
            const param = parts[1]?.trim();

            if (!param) {
                return `![](${filePath})`;
            }

            // 如果参数是纯数字，当作宽度；否则当作 alt 文字
            if (/^\d+$/.test(param)) {
                return `![](${filePath}){width=${param}}`;
            } else {
                return `![${param}](${filePath})`;
            }
        });
    }

    /**
     * 将 HTML 中的图片 src 解析为 Obsidian 资源路径
     * 这样预览面板中的图片才能正常显示
     */
    private resolveImagePaths(html: string, sourcePath: string): string {
        return html.replace(/<img([^>]*)\ssrc="([^"]*)"([^>]*)>/gi, (match, before, src, after) => {
            // 跳过已经是完整 URL 或 data URI 的
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
                return match;
            }

            // 尝试解析为 Vault 内文件
            const resolved = this.resolveVaultImagePath(src, sourcePath);
            if (resolved) {
                return `<img${before} src="${resolved}"${after}>`;
            }

            return match;
        });
    }

    /**
     * 解析图片路径为 Obsidian 内部资源 URL
     */
    private resolveVaultImagePath(imagePath: string, sourcePath: string): string | null {
        const vault = this.app.vault;

        // 1. 尝试直接路径
        let file = vault.getAbstractFileByPath(imagePath);

        // 2. 尝试相对路径
        if (!file) {
            const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            const relativePath = sourceDir ? `${sourceDir}/${imagePath}` : imagePath;
            file = vault.getAbstractFileByPath(relativePath);
        }

        // 3. 尝试 Obsidian 链接解析（处理不带路径的文件名）
        if (!file) {
            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(imagePath, sourcePath);
            if (linkedFile) {
                file = linkedFile;
            }
        }

        if (file && file instanceof TFile) {
            return this.app.vault.getResourcePath(file);
        }

        return null;
    }

    /**
     * 提取 frontmatter
     */
    extractFrontmatter(markdown: string): { frontmatter: Record<string, string>; content: string } {
        const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = markdown.match(fmRegex);

        if (!match) {
            return { frontmatter: {}, content: markdown };
        }

        const fmContent = match[1];
        const content = markdown.slice(match[0].length);
        const frontmatter: Record<string, string> = {};

        fmContent.split('\n').forEach((line) => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.slice(0, colonIndex).trim();
                const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
                frontmatter[key] = value;
            }
        });

        return { frontmatter, content };
    }

    /**
     * 包装代码块（含行号支持）
     */
    private wrapCodeBlock(code: string, lang: string): string {
        const langLabel = lang ? `<span class="mofa-code-lang">${lang}</span>` : '';

        if (this.settings.showLineNumbers) {
            const lines = code.split('\n');
            // 去掉最后的空行
            if (lines[lines.length - 1].trim() === '') {
                lines.pop();
            }
            const numberedCode = lines
                .map((line, i) => `<span class="mofa-line"><span class="mofa-line-number">${i + 1}</span>${line}</span>`)
                .join('\n');
            return `<pre class="mofa-code-block">${langLabel}<code class="hljs language-${lang}">${numberedCode}</code></pre>`;
        }

        return `<pre class="mofa-code-block">${langLabel}<code class="hljs language-${lang}">${code}</code></pre>`;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
