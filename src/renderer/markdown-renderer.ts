import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import mk from 'markdown-it-katex';
import hljs from 'highlight.js';
import { processLinksToFootnotes, processLinksInline } from '../utils/link-handler';
import { buildCodeBlockHtml } from '../utils/code-block-render';
import type { MofaSettings } from '../settings';
import { App, TFile } from 'obsidian';

interface MarkdownTokenLike {
    content: string;
}

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
        
        // 使用 markdown-it-katex 识别真正的数学公式（忽略代码块里的 $）
        // 但我们覆盖它的渲染逻辑，直接输出 Codecogs API 图像而不是复杂的 DOM 结构
        md.use(mk, { throwOnError: false });
        md.renderer.rules.math_inline = (tokens: MarkdownTokenLike[], idx: number) => {
            const formula = tokens[idx].content;
            const url = `https://latex.codecogs.com/png.image?\\dpi{300}\\bg_white%20\\inline%20${encodeURIComponent(formula.trim())}`;
            return `<img class="mofa-math-img" src="${url}" alt="math formula" style="vertical-align: middle; margin: 0 2px;" />`;
        };
        md.renderer.rules.math_block = (tokens: MarkdownTokenLike[], idx: number) => {
            const formula = tokens[idx].content;
            const url = `https://latex.codecogs.com/png.image?\\dpi{300}\\bg_white%20${encodeURIComponent(formula.trim())}`;
            return `\n<section style="text-align: center; margin: 10px 0;"><img class="mofa-math-img" src="${url}" alt="math formula" /></section>\n`;
        };

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
        const processed = this.preprocessWikiImages(content);

        // 3. 处理链接（微信不支持外链）
        let readyMarkdown = processed;
        if (this.settings.linkStyle === 'footnote') {
            readyMarkdown = processLinksToFootnotes(readyMarkdown);
        }

        // 4. 渲染 Markdown → HTML
        let html = this.md.render(readyMarkdown);

        // 4.1 清理空的列表项（breaks:true 导致的各种空 li）
        html = html.replace(/<li>\s*(<br\s*\/?>)?\s*<\/li>/gi, '');
        html = html.replace(/<li>\s*<p>\s*(<br\s*\/?>)?\s*<\/p>\s*<\/li>/gi, '');
        html = html.replace(/\n{3,}/g, '\n\n');

        // 5. 如果是 inline 链接模式，后处理 HTML
        if (this.settings.linkStyle === 'inline') {
            html = processLinksInline(html);
        }

        // 6. 解析图片路径为 Obsidian 资源 URL（预览时能正常显示）
        if (sourcePath) {
            html = this.resolveImagePaths(html, sourcePath);
        }

        // 7. 后处理 Obsidian Callout（将渲染后的 blockquote 含 [!TYPE] 转为样式 div）
        html = this.postRenderCallouts(html);

        // 8. 后处理图片 Caption（图片后紧跟的斜体文字 *xxx* 自动变为居中小字说明）
        html = this.postRenderImageCaptions(html);

        return html;
    }

    /**
     * 后处理图片 Caption：
     * 在 Markdown 中图片后紧跟一行斜体文字（`*caption*`），渲染后变为：
     *   <p><img ...></p>
     *   <p><em>caption text</em></p>
     * 本方法将这种模式合并为居中显示的图文说明块。
     */
    private postRenderImageCaptions(html: string): string {
        // 匹配：含 <img> 的 <p> 标签，紧跟着一个仅含 <em> 的 <p> 标签
        return html.replace(
            /(<p[^>]*>(?:\s*<img[^>]*>\s*)+<\/p>)\s*<p[^>]*>\s*<em[^>]*>([\s\S]*?)<\/em>\s*<\/p>/gi,
            (_, imgBlock, captionText) => {
                return [
                    '<section style="text-align:center;margin:1em 0;">',
                    imgBlock.replace(/<p[^>]*>/, '<p style="text-align:center;margin:0;">'),
                    `<p style="text-align:center;margin:4px 0 0;font-size:14px;color:#999;">${captionText}</p>`,
                    '</section>',
                ].join('\n');
            }
        );
    }

    /**
     * 后处理 Obsidian Callout：在 md.render() 输出的 HTML 中，
     * 检测 <blockquote> 内的 [!TYPE] 标记，替换为美化的 styled div。
     *
     * markdown-it 将 > [!NOTE] 标题\n> 内容 渲染为：
     * <blockquote><p>[!NOTE] 标题<br>内容行...</p></blockquote>
     */
    private postRenderCallouts(html: string): string {
        const calloutIcons: Record<string, string> = {
            NOTE: '📖', TIP: '💡', IMPORTANT: '❗', WARNING: '⚠️',
            CAUTION: '🔥', INFO: 'ℹ️', SUCCESS: '✅', ERROR: '❌',
            QUESTION: '❓', QUOTE: '💬', ABSTRACT: '📌',
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

        // 匹配 <blockquote>...[!TYPE]...</blockquote>
        return html.replace(
            /<blockquote[^>]*>\s*<p[^>]*>\[!(\w+)\]\s*([^<]*?)(?:<br\s*\/?>)?\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi,
            (_match, rawType, titleText, firstBody, restBody) => {
                const type = rawType.trim().toUpperCase();
                const icon = calloutIcons[type] || '📖';
                const bg = calloutColors[type] || '#e0f0ff';
                const border = calloutBorder[type] || '#3b82f6';
                const displayTitle = titleText.trim() || type;

                // 组装 body
                let bodyContent = '';
                const body = (firstBody + restBody).trim();
                if (body) {
                    bodyContent = `<div style="margin:0;">${body}</div>`;
                }

                return [
                    `<div style="background:${bg};border-left:4px solid ${border};border-radius:4px;padding:12px 16px;margin:1em 0;">`,
                    `<p style="font-weight:700;margin:0 0 ${bodyContent ? '6px' : '0'} 0;">${icon} ${displayTitle}</p>`,
                    bodyContent,
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
     */
    private resolveImagePaths(html: string, sourcePath: string): string {
        return html.replace(/<img([^>]*)\ssrc="([^"]*)"([^>]*)>/gi, (match, before, src, after) => {
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
                return match;
            }

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
        // URL 解码（markdown-it 会将中文路径编码为 %XX）
        const decoded = decodeURIComponent(imagePath);

        // 1. 尝试直接路径
        let file = vault.getAbstractFileByPath(decoded);

        // 2. 尝试相对路径
        if (!file) {
            const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            const relativePath = sourceDir ? `${sourceDir}/${decoded}` : decoded;
            file = vault.getAbstractFileByPath(relativePath);
        }

        // 3. 尝试 Obsidian 链接解析（处理不带路径的文件名）
        if (!file) {
            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(decoded, sourcePath);
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
        return buildCodeBlockHtml(code, lang, {
            showLineNumbers: this.settings.showLineNumbers,
            editorCompatMode: this.settings.wechatEditorCompatMode,
        });
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
