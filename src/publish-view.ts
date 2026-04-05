/**
 * 墨发发布面板 — 侧边栏视图
 * 极简 3 步操作：选主题 → 预览 → 发布
 */

import { FileSystemAdapter, ItemView, WorkspaceLeaf, Notice, TFile, requestUrl } from 'obsidian';
import type MofaPlugin from './main';
import { MarkdownRenderer } from './renderer/markdown-renderer';
import { makeWechatCompatible } from './renderer/wechat-compat';
import { processMermaidBlocks } from './renderer/mermaid-renderer';
import { processImagesForCopy } from './renderer/image-processor';
import { clipPreviewText, deltaDebug } from './utils/wechat-bisect';
import { copyRichTextToClipboard } from './utils/clipboard';
import { getBuiltinThemes, getThemeById, parseExternalTheme, Theme } from './themes/theme-manager';
import { buildDraftDebugInfo, normalizeWechatTitle, resolveOriginalDocumentId, type DraftDebugInfo, type DraftRequestPayload } from './utils/wechat-publish-debug';
import { sanitizeForWechat } from './utils/wechat-sanitize';
import { UploadResult, type WechatBatchGetMaterialResponse, type WechatDraftAddResponse } from './wechat/wechat-api';

export const MOFA_VIEW_TYPE = 'mofa-publish-view';

type DraftPayloadBase = Omit<DraftRequestPayload, 'content'>;
type WechatBatchGetMaterialFn = (
    token: string,
    type: string,
    offset?: number,
    count?: number
) => Promise<WechatBatchGetMaterialResponse>;
type WechatAddDraftFn = (token: string, data: DraftRequestPayload) => Promise<WechatDraftAddResponse>;

interface DraftPreparationContext {
    activeFile: TFile;
    title: string;
    sanitizedHtml: string;
    requestPayloadBase: DraftPayloadBase;
    originalDocumentId: string;
}

interface BisectItem {
    html: string;
    path: string;
    tagName: string;
    preview: string;
}

interface BisectTarget {
    path: string;
    wrapperStart: string;
    wrapperEnd: string;
    items: BisectItem[];
}

interface BisectAttempt {
    label: string;
    result: 'pass' | 'fail-45166' | 'error';
    errcode?: number;
    errmsg?: string;
    fragments: Array<Pick<BisectItem, 'path' | 'tagName' | 'preview'>>;
    debugInfo: DraftDebugInfo;
}

export class MofaPublishView extends ItemView {
    private plugin: MofaPlugin;
    private debugLogDir = '_mofa_debug';
    private previewEl: HTMLElement | null = null;
    private themeSelect: HTMLSelectElement | null = null;
    private previewMode: 'mobile' | 'desktop' = 'mobile';
    private currentHtml: string = '';
    private renderer: MarkdownRenderer;
    private statusEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: MofaPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.renderer = new MarkdownRenderer(plugin.settings, plugin.app);
    }

    getViewType() {
        return MOFA_VIEW_TYPE;
    }

    getDisplayText() {
        return '墨发 发布';
    }

    getIcon() {
        return 'send';
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('mofa-publish-panel');

        // ===== 标题栏 =====
        const header = container.createDiv('mofa-header');
        header.createEl('h3', { text: '📤 发布到公众号' });

        // ===== 主题选择器 =====
        const themeBar = container.createDiv('mofa-theme-bar');
        themeBar.createEl('span', { text: '🎨 主题', cls: 'mofa-label' });

        this.themeSelect = themeBar.createEl('select', { cls: 'mofa-theme-select' });
        await this.loadThemeOptions();
        this.themeSelect.addEventListener('change', () => {
            if (!this.themeSelect) return;
            // 记住选中的主题
            this.plugin.settings.defaultTheme = this.themeSelect.value;
            void this.plugin.saveSettings();
            void this.refreshPreview();
        });

        // ===== 预览区域 =====
        const previewWrapper = container.createDiv('mofa-preview-wrapper');

        // 预览模式切换
        const modeBar = previewWrapper.createDiv('mofa-mode-bar');
        const mobileBtn = modeBar.createEl('button', { text: '📱 手机', cls: 'mofa-mode-btn mofa-mode-active' });
        const desktopBtn = modeBar.createEl('button', { text: '💻 电脑', cls: 'mofa-mode-btn' });

        mobileBtn.addEventListener('click', () => {
            this.previewMode = 'mobile';
            mobileBtn.addClass('mofa-mode-active');
            desktopBtn.removeClass('mofa-mode-active');
            this.updatePreviewSize();
        });
        desktopBtn.addEventListener('click', () => {
            this.previewMode = 'desktop';
            desktopBtn.addClass('mofa-mode-active');
            mobileBtn.removeClass('mofa-mode-active');
            this.updatePreviewSize();
        });

        this.previewEl = previewWrapper.createDiv('mofa-preview');
        this.previewEl.createEl('p', {
            text: '👈 打开一篇笔记后自动预览',
            cls: 'mofa-placeholder',
        });

        // ===== 状态栏 =====
        this.statusEl = container.createDiv('mofa-status');
        this.statusEl.setText('就绪');

        // ===== 操作按钮 =====
        const actionBar = container.createDiv('mofa-action-bar');

        const copyBtn = actionBar.createEl('button', {
            text: '📋 复制到公众号',
            cls: 'mofa-btn mofa-btn-primary',
        });
        copyBtn.addEventListener('click', () => { void this.copyToClipboard(); });

        const draftBtn = actionBar.createEl('button', {
            text: '📤 发送到草稿箱',
            cls: 'mofa-btn mofa-btn-secondary',
        });
        draftBtn.addEventListener('click', () => { void this.publishToDraft(); });

        const diagnoseBtn = actionBar.createEl('button', {
            text: '🧪 定位报错元素',
            cls: 'mofa-btn mofa-btn-secondary',
        });
        diagnoseBtn.addEventListener('click', () => { void this.diagnoseWechatFailure(); });

        // ===== 提示信息 =====
        const tipEl = container.createDiv('mofa-tip');
        tipEl.createEl('p', {
            text: '💡 复制后到微信公众号编辑器直接 Ctrl+V 粘贴即可',
            cls: 'mofa-tip-text',
        });

        // 监听文件切换和修改
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                void this.refreshPreview();
            })
        );

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && file.path === activeFile.path) {
                    // debounce
                    this.debounceRefresh();
                }
            })
        );

        // 初始渲染
        void this.refreshPreview();
    }

    private refreshTimer: ReturnType<typeof setTimeout> | null = null;

    private debounceRefresh() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => { void this.refreshPreview(); }, 800);
    }

    async onClose() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        await Promise.resolve();
    }

    /** 外部导入的主题缓存 */
    private externalThemes: Theme[] = [];

    /**
     * 加载主题下拉选项（内置 + 外部导入）
     */
    private async loadThemeOptions() {
        if (!this.themeSelect) return;
        this.themeSelect.empty();

        const savedThemeId = this.plugin.settings.defaultTheme;
        const builtinThemes = getBuiltinThemes();

        // 预定义分类映射
        const categoryNames = {
            'basic': '📄 基础系列',
            'elegant': '✨ 优雅系列',
            'tech': '💻 技术系列',
            'creative': '🎨 创意系列'
        };

        // 按分类对内置主题进行分组
        const groups: Record<string, Theme[]> = {};
        builtinThemes.forEach(theme => {
            const cat = theme.category || 'basic';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(theme);
        });

        // 依次渲染各个分组
        for (const [catKey, catName] of Object.entries(categoryNames)) {
            if (groups[catKey] && groups[catKey].length > 0) {
                const groupEl = this.themeSelect.createEl('optgroup', { attr: { label: `── ${catName} ──` } });
                groups[catKey].forEach(theme => {
                    const opt = groupEl.createEl('option', { text: theme.name, value: theme.id });
                    if (theme.id === savedThemeId) opt.selected = true;
                });
            }
        }

        // 加载外部主题
        this.externalThemes = await this.loadExternalThemes();
        if (this.externalThemes.length > 0) {
            // 添加分隔 optgroup
            const groupEl = this.themeSelect.createEl('optgroup', { attr: { label: '── 自定义主题 ──' } });
            this.externalThemes.forEach((theme) => {
                const opt = groupEl.createEl('option', { text: theme.name, value: theme.id });
                if (theme.id === savedThemeId) opt.selected = true;
            });
        }
    }

    /**
     * 从 vault 笔记中加载外部主题
     * 支持在设置中指定一个笔记名，笔记中的 ```css 代码块会被解析为主题
     */
    private async loadExternalThemes(): Promise<Theme[]> {
        const themes: Theme[] = [];
        const noteName = this.plugin.settings.customCssNote;
        if (!noteName) return themes;

        // 在 vault 中查找该笔记
        const files = this.app.vault.getMarkdownFiles();
        const matchedFile = files.find(f =>
            f.basename === noteName || f.path === noteName || f.path === noteName + '.md'
        );

        if (matchedFile) {
            const content = await this.app.vault.read(matchedFile);

            // 支持多个代码块，每个作为一个独立主题
            // 格式: ```css title="主题名称"  或直接 ```css
            const codeBlockRegex = /```css(?:\s+title="([^"]*)")?\s*\n([\s\S]*?)```/g;
            let match;
            let index = 0;
            while ((match = codeBlockRegex.exec(content)) !== null) {
                const name = match[1] || `自定义主题 ${index + 1}`;
                const css = match[2].trim();
                if (css) {
                    const theme = parseExternalTheme(css, name);
                    if (theme) {
                        theme.id = `external_${index}`;
                        themes.push(theme);
                        index++;
                    }
                }
            }

            // 如果没有代码块，则将整个文件作为一个 CSS 主题
            if (themes.length === 0 && content.trim()) {
                const theme = parseExternalTheme(content, noteName);
                if (theme) {
                    theme.id = 'external_0';
                    themes.push(theme);
                }
            }
        }

        return themes;
    }

    /**
     * 获取当前选中的主题（内置或外部）
     */
    private getSelectedTheme(): Theme | undefined {
        const selectedId = this.themeSelect?.value || this.plugin.settings.defaultTheme;

        // 先找内置主题
        const builtin = getThemeById(selectedId);
        if (builtin) return builtin;

        // 再找外部主题
        return this.externalThemes.find(t => t.id === selectedId);
    }

    private updatePreviewSize() {
        if (!this.previewEl) return;
        if (this.previewMode === 'mobile') {
            this.previewEl.addClass('mofa-preview-mobile');
            this.previewEl.removeClass('mofa-preview-desktop');
        } else {
            this.previewEl.addClass('mofa-preview-desktop');
            this.previewEl.removeClass('mofa-preview-mobile');
        }
    }

    /**
     * 刷新预览
     */
    async refreshPreview() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !this.previewEl) {
            if (this.previewEl) {
                this.previewEl.empty();
                this.previewEl.createEl('p', { text: '👈 打开一篇笔记后自动预览', cls: 'mofa-placeholder' });
            }
            return;
        }

        if (activeFile.extension !== 'md') {
            this.previewEl.empty();
            this.previewEl.createEl('p', { text: '仅支持 Markdown 文件', cls: 'mofa-placeholder' });
            return;
        }

        this.setStatus('渲染中...');

        try {
            const content = await this.app.vault.read(activeFile);

            // 1. Markdown → HTML
            const rawHtml = this.renderer.render(content, activeFile.path);

            // 2. 处理 Mermaid 图表
            const htmlWithMermaid = await processMermaidBlocks(rawHtml, this.app, activeFile.path);

            // 3. 获取主题 CSS
            const theme = this.getSelectedTheme();
            const themeCSS = theme?.css || '';

            // 4. 包装为文章结构
            let articleHtml = `<div class="mofa-article">${htmlWithMermaid}</div>`;

            // 4.5 替换 <hr> 为 SVG 装饰分割线（预览中也要显示）
            articleHtml = this.replaceDividers(articleHtml);

            // 5. 应用主题样式到预览（使用 inline 化方式，因为 Obsidian 不允许创建 link/style 元素）
            // 基础保护样式已移入 styles.css (.mofa-preview .mofa-article)
            // 主题 CSS 通过 inline 化注入到文章元素
            const previewHtml = makeWechatCompatible(articleHtml, {
                themeCSS,
                editorCompatMode: this.plugin.settings.wechatEditorCompatMode,
            });

            // 使用 DOM API 构建预览内容
            this.previewEl.empty();

            // 解析处理后的文章 HTML 并附加到预览
            const articleDoc = new DOMParser().parseFromString(previewHtml, 'text/html');
            for (const child of Array.from(articleDoc.body.childNodes)) {
                this.previewEl.appendChild(child);
            }

            // 保存原始 HTML 用于复制
            this.currentHtml = articleHtml;
            this.setStatus('✅ 预览就绪');

        } catch (error) {
            console.error('渲染失败:', error);
            if (this.previewEl) {
                this.previewEl.empty();
                const errP = this.previewEl.createEl('p', { cls: 'mofa-error' });
                errP.setText(`渲染失败: ${(error as Error).message}`);
            }
            this.setStatus('❌ 渲染失败');
        }
    }

    /**
     * 复制到公众号（核心功能，零配置可用）
     */
    async copyToClipboard() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('请先打开一篇笔记');
            return;
        }

        this.setStatus('正在处理...');

        try {
            // 重新渲染确保最新
            const content = await this.app.vault.read(activeFile);
            const rawHtml = this.renderer.render(content, activeFile.path);
            const htmlWithMermaid = await processMermaidBlocks(rawHtml, this.app, activeFile.path);

            // 获取主题
            const theme = this.getSelectedTheme();
            const themeCSS = theme?.css || '';

            const articleHtml = `<div class="mofa-article">${htmlWithMermaid}</div>`;

            // 处理图片（全部转 Base64）
            this.setStatus('处理图片中...');
            const htmlWithImages = await processImagesForCopy(articleHtml, this.app, activeFile.path);

            // 微信 DOM 兼容性处理（inline 化样式）
            this.setStatus('适配微信格式...');
            const wechatHtml = makeWechatCompatible(htmlWithImages, {
                themeCSS,
                editorCompatMode: this.plugin.settings.wechatEditorCompatMode,
            });

            // 复制到剪贴板
            await copyRichTextToClipboard(wechatHtml);
            this.setStatus('✅ 已复制！去公众号粘贴吧');

        } catch (error) {
            console.error('复制失败:', error);
            new Notice('❌ 复制失败: ' + (error as Error).message);
            this.setStatus('❌ 复制失败');
        }
    }

    /**
     * 发送到草稿箱（需要 API 配置）
     */
    async publishToDraft() {
        if (!this.plugin.settings.wechatAppId || !this.plugin.settings.wechatAppSecret) {
            new Notice('⚙️ 请先在设置中填写公众号的 app ID 和 app secret');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('请先打开一篇笔记');
            return;
        }

        this.setStatus('正在发布到草稿箱...');

        try {
            const { wxGetToken, wxUploadImage, wxAddDraft, wxBatchGetMaterial } = await import('./wechat/wechat-api');

            this.setStatus('获取 Token...');
            const token = await wxGetToken(
                this.plugin.settings.wechatAppId,
                this.plugin.settings.wechatAppSecret
            );
            console.debug('[MoFa] Token 获取成功');

            const context = await this.prepareDraftContext(activeFile, token, wxUploadImage, wxBatchGetMaterial);
            this.setStatus('创建草稿...');
            const requestPayload: DraftRequestPayload = {
                ...context.requestPayloadBase,
                content: context.sanitizedHtml,
            };
            const sent = await this.sendDraftCandidate(token, wxAddDraft, context.originalDocumentId, requestPayload);
            const res = sent.res;
            console.debug('[MoFa] wxAddDraft 响应:', JSON.stringify(res.json));

            await this.saveDraftAttemptArtifacts(
                res.status === 200 && Boolean(res.json?.media_id) ? 'success' : 'fail',
                context.title,
                context.sanitizedHtml,
                sent.debugInfo
            );

            if (res.status !== 200) {
                const errData = res.json;
                throw new Error(`HTTP ${res.status}: ${errData?.errmsg || '未知错误'}`);
            }

            const draft = res.json;
            if (draft.media_id) {
                new Notice('✅ 已发送到草稿箱！请到公众号后台查看');
                this.setStatus('✅ 发布成功！');
            } else if (draft.errcode) {
                // 解码微信错误码
                const wechatErrors: Record<number, string> = {
                    40007: '媒体文件ID无效（thumb_media_id 错误或已过期）',
                    40155: '请勿添加其他公众号的主页链接',
                    44016: '内容过长（超过 20000 字），请精简后重试',
                    45002: '内容含无效字符（请移除特殊 HTML 标签或字符）',
                    45003: '标题过长（已超过微信公众号标题长度限制）',
                    45021: '草稿数量已达上限（最多 100 篇），请到后台删除旧草稿',
                };
                const readable = wechatErrors[draft.errcode];
                const errMsg = readable
                    ? `[${draft.errcode}] ${readable}`
                    : `微信错误 ${draft.errcode}: ${draft.errmsg}`;
                throw new Error(errMsg);
            } else {
                throw new Error(draft.errmsg || '创建草稿失败（未知错误）');
            }

        } catch (error) {
            console.error('[MoFa] 发布失败:', error);
            console.error('[MoFa] 错误详情:', (error as Error).stack || (error as Error).message);
            new Notice('❌ 发布失败: ' + (error as Error).message);
            this.setStatus('❌ 发布失败');
        }
    }

    /**
     * 真实上传排除法：定位当前文档中触发 45166 的最小失败元素或元素组合
     */
    async diagnoseWechatFailure() {
        if (!this.plugin.settings.wechatAppId || !this.plugin.settings.wechatAppSecret) {
            new Notice('⚙️ 请先在设置中填写公众号的 app ID 和 app secret');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('请先打开一篇笔记');
            return;
        }

        this.setStatus('开始定位 45166...');

        try {
            const { wxGetToken, wxUploadImage, wxAddDraft, wxBatchGetMaterial } = await import('./wechat/wechat-api');

            this.setStatus('获取 Token...');
            const token = await wxGetToken(
                this.plugin.settings.wechatAppId,
                this.plugin.settings.wechatAppSecret
            );

            const context = await this.prepareDraftContext(activeFile, token, wxUploadImage, wxBatchGetMaterial);
            const attempts: BisectAttempt[] = [];

            this.setStatus('验证完整文档是否复现...');
            const fullAttempt = await this.testBisectCandidate(
                token,
                wxAddDraft,
                context.originalDocumentId,
                context.requestPayloadBase,
                context.sanitizedHtml,
                'full-document',
                []
            );
            attempts.push(fullAttempt);

            if (fullAttempt.result === 'pass') {
                await this.saveBisectArtifacts(context.title, context.sanitizedHtml, {
                    mode: 'wechat-45166-bisect',
                    createdAt: new Date().toISOString(),
                    originalDocumentId: context.originalDocumentId,
                    title: context.title,
                    status: 'not_reproduced',
                    finalCandidates: [],
                    attempts,
                });
                new Notice('✅ 当前完整文档已不再复现 45166');
                this.setStatus('✅ 未复现 45166');
                return;
            }

            if (fullAttempt.result === 'error') {
                throw new Error(fullAttempt.errmsg || '完整文档未复现 45166，而是触发了其他错误');
            }

            let currentTarget = this.buildBisectTargetFromHtml(context.sanitizedHtml);
            if (!currentTarget) {
                await this.saveBisectArtifacts(context.title, context.sanitizedHtml, {
                    mode: 'wechat-45166-bisect',
                    createdAt: new Date().toISOString(),
                    originalDocumentId: context.originalDocumentId,
                    title: context.title,
                    status: 'cannot_split',
                    finalCandidates: [],
                    attempts,
                });
                new Notice('⚠️ 当前 HTML 无法继续拆分，请查看 bisect 报告');
                this.setStatus('⚠️ 无法拆分 HTML');
                return;
            }

            let finalItems = [...currentTarget.items];
            let finalHtml = context.sanitizedHtml;
            let depth = 0;

            while (depth < 6 && currentTarget.items.length > 0) {
                const depthLabel = `depth-${depth + 1}`;
                this.setStatus(`定位第 ${depth + 1} 层（${currentTarget.items.length} 块）...`);

                const minimalSubset = await deltaDebug(currentTarget.items, async (subset) => {
                    const subsetItems = [...subset];
                    const html = this.renderBisectTarget(currentTarget, subsetItems);
                    const attempt = await this.testBisectCandidate(
                        token,
                        wxAddDraft,
                        context.originalDocumentId,
                        context.requestPayloadBase,
                        html,
                        `${depthLabel}-${subsetItems.length}`,
                        subsetItems
                    );
                    attempts.push(attempt);

                    if (attempt.result === 'error') {
                        throw new Error(
                            attempt.errcode
                                ? `微信错误 ${attempt.errcode}: ${attempt.errmsg || '未知错误'}`
                                : (attempt.errmsg || '排查中断')
                        );
                    }

                    return attempt.result === 'fail-45166';
                });

                finalItems = [...minimalSubset];
                finalHtml = this.renderBisectTarget(currentTarget, minimalSubset);

                if (minimalSubset.length !== 1) {
                    break;
                }

                const nextTarget = this.buildBisectTargetFromFragment(minimalSubset[0]);
                if (!nextTarget) {
                    break;
                }

                currentTarget = nextTarget;
                depth++;
            }

            await this.saveBisectArtifacts(context.title, finalHtml, {
                mode: 'wechat-45166-bisect',
                createdAt: new Date().toISOString(),
                originalDocumentId: context.originalDocumentId,
                title: context.title,
                status: finalItems.length === 1 ? 'single-fragment' : 'fragment-combination',
                finalCandidates: finalItems.map((item) => ({
                    path: item.path,
                    tagName: item.tagName,
                    preview: item.preview,
                })),
                attempts,
            });

            if (finalItems.length === 1) {
                new Notice(`🎯 已定位到疑似元素：<${finalItems[0].tagName}> ${finalItems[0].preview || finalItems[0].path}`, 12000);
                this.setStatus('🎯 已定位到单个疑似元素');
            } else {
                new Notice(`🧩 已缩小到 ${finalItems.length} 个组合元素，详见 _mofa_debug/bisect`, 12000);
                this.setStatus(`🧩 缩小到 ${finalItems.length} 个组合元素`);
            }
        } catch (error) {
            console.error('[MoFa] 45166 排查失败:', error);
            new Notice('❌ 排查失败: ' + (error as Error).message, 12000);
            this.setStatus('❌ 排查失败');
        }
    }

    private async prepareDraftContext(
        activeFile: TFile,
        token: string,
        wxUploadImage: (data: Blob, filename: string, token: string, type?: string) => Promise<UploadResult>,
        wxBatchGetMaterial: WechatBatchGetMaterialFn
    ): Promise<DraftPreparationContext> {
        this.setStatus('渲染文章...');
        const content = await this.app.vault.read(activeFile);
        const rawHtml = this.renderer.render(content);
        const htmlWithMermaid = await processMermaidBlocks(rawHtml, this.app, activeFile.path);

        const theme = this.getSelectedTheme();
        const themeCSS = theme?.css || '';
        const articleHtml = `<div class="mofa-article">${htmlWithMermaid}</div>`;
        console.debug('[MoFa] 渲染完成，HTML 长度:', articleHtml.length);

        this.setStatus('上传图片...');
        const htmlWithUploadedImages = await this.uploadAllImages(articleHtml, activeFile.path, token, wxUploadImage);
        console.debug('[MoFa] 图片上传完成，HTML 长度:', htmlWithUploadedImages.length);

        this.setStatus('适配微信格式...');
        const wechatHtml = makeWechatCompatible(htmlWithUploadedImages, {
            themeCSS,
            editorCompatMode: this.plugin.settings.wechatEditorCompatMode,
        });
        console.debug('[MoFa] 微信兼容处理完成，HTML 长度:', wechatHtml.length);

        const metadata = this.renderer.extractFrontmatter(content);
        const fm = metadata.frontmatter;

        let title = fm['title'];
        if (!title) {
            const h1Match = content.match(/^#\s+(.+)$/m);
            title = h1Match ? h1Match[1].trim() : activeFile.basename;
        }
        const originalTitle = title;
        title = normalizeWechatTitle(title);
        if (title !== originalTitle) {
            console.warn('[MoFa] 标题超出微信限制，已自动截断:', {
                originalTitle,
                normalizedTitle: title,
            });
        }

        const author = fm['author'] || '';
        const digest = fm['digest'] || '';

        this.setStatus('处理封面...');
        const thumbMediaId = await this.resolveThumbMediaId(
            fm['thumb_media_id'] || '',
            htmlWithUploadedImages,
            activeFile,
            token,
            wxUploadImage,
            wxBatchGetMaterial
        );

        if (!thumbMediaId) {
            throw new Error('文章内没有图片，且公众号后台无可用图片，无法生成封面');
        }

        const sanitizedHtml = sanitizeForWechat(wechatHtml, console);
        console.debug('[MoFa] 清洗后 HTML 长度:', sanitizedHtml.length);
        console.debug('[MoFa] 草稿参数:', {
            title,
            author,
            digest: digest.slice(0, 50),
            thumbMediaId,
            contentLength: sanitizedHtml.length,
        });

        const adapter = this.app.vault.adapter;
        const vaultBasePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;

        return {
            activeFile,
            title,
            sanitizedHtml,
            requestPayloadBase: {
                title,
                author,
                digest,
                thumb_media_id: thumbMediaId,
                need_open_comment: fm['open_comment'] === 'true' ? 1 : 0,
            },
            originalDocumentId: resolveOriginalDocumentId(activeFile.path, vaultBasePath),
        };
    }

    private async resolveThumbMediaId(
        initialThumbMediaId: string,
        htmlWithUploadedImages: string,
        activeFile: TFile,
        token: string,
        wxUploadImage: (data: Blob, filename: string, token: string, type?: string) => Promise<UploadResult>,
        wxBatchGetMaterial: WechatBatchGetMaterialFn
    ): Promise<string> {
        let thumbMediaId = initialThumbMediaId;

        if (!thumbMediaId) {
            const uploadedDoc = new DOMParser().parseFromString(htmlWithUploadedImages, 'text/html');
            const firstImg = uploadedDoc.body.querySelector('img');
            if (firstImg) {
                const src = firstImg.getAttribute('src') || '';
                if (src) {
                    this.setStatus('上传首图作为封面...');
                    const blob = await this.fetchImageAsBlob(src, activeFile.path);
                    if (blob) {
                        const uploadRes = await wxUploadImage(blob, 'cover.png', token, 'image');
                        if (uploadRes.media_id) {
                            thumbMediaId = uploadRes.media_id;
                        }
                    }
                }
            }
        }

        if (!thumbMediaId) {
            try {
                const materials = await wxBatchGetMaterial(token, 'image');
                if ((materials.item_count ?? 0) > 0 && Array.isArray(materials.item) && materials.item[0]?.media_id) {
                    thumbMediaId = materials.item[0].media_id;
                }
            } catch (error) {
                console.warn('获取默认封面失败:', error);
            }
        }

        return thumbMediaId;
    }

    private async sendDraftCandidate(
        token: string,
        wxAddDraft: WechatAddDraftFn,
        originalDocumentId: string,
        requestPayload: DraftRequestPayload
    ): Promise<{
        res: WechatDraftAddResponse;
        debugInfo: DraftDebugInfo;
        result: 'pass' | 'fail-45166' | 'error';
        errcode?: number;
        errmsg?: string;
    }> {
        const requestTime = new Date().toISOString();
        const res = await wxAddDraft(token, requestPayload);
        const responseTime = new Date().toISOString();

        const debugInfo = buildDraftDebugInfo({
            requestTime,
            responseTime,
            originalDocumentId,
            requestPayload,
            jsonResponse: res.json,
            httpStatus: res.status,
        });

        if (res.status === 200 && res.json?.media_id) {
            return { res, debugInfo, result: 'pass' };
        }

        const errcode = typeof res.json?.errcode === 'number' ? res.json.errcode : undefined;
        const errmsg = typeof res.json?.errmsg === 'string' ? res.json.errmsg : undefined;
        return {
            res,
            debugInfo,
            result: errcode === 45166 ? 'fail-45166' : 'error',
            errcode,
            errmsg,
        };
    }

    private async testBisectCandidate(
        token: string,
        wxAddDraft: WechatAddDraftFn,
        originalDocumentId: string,
        requestPayloadBase: DraftPayloadBase,
        html: string,
        label: string,
        fragments: BisectItem[]
    ): Promise<BisectAttempt> {
        const requestPayload: DraftRequestPayload = {
            ...requestPayloadBase,
            content: html,
        };

        const sent = await this.sendDraftCandidate(token, wxAddDraft, originalDocumentId, requestPayload);
        return {
            label,
            result: sent.result,
            errcode: sent.errcode,
            errmsg: sent.errmsg,
            fragments: fragments.map((fragment) => ({
                path: fragment.path,
                tagName: fragment.tagName,
                preview: fragment.preview,
            })),
            debugInfo: sent.debugInfo,
        };
    }

    private async saveDraftAttemptArtifacts(
        subDir: 'success' | 'fail',
        title: string,
        html: string,
        debugInfo: DraftDebugInfo
    ) {
        const folderPath = await this.ensureDebugFolder(subDir);
        const baseName = this.buildDebugBaseName(title);
        const htmlPath = `${folderPath}/${baseName}.html`;
        const debugJsonPath = `${folderPath}/${baseName}_FullDebugLog.json`;

        await this.app.vault.create(htmlPath, this.wrapDebugHtml(html));
        await this.app.vault.create(debugJsonPath, JSON.stringify(debugInfo, null, 2));
    }

    private async saveBisectArtifacts(title: string, html: string, report: Record<string, unknown>) {
        const folderPath = await this.ensureDebugFolder('bisect');
        const baseName = this.buildDebugBaseName(title);
        await this.app.vault.create(`${folderPath}/${baseName}.html`, this.wrapDebugHtml(html));
        await this.app.vault.create(`${folderPath}/${baseName}.json`, JSON.stringify(report, null, 2));
    }

    private async ensureDebugFolder(subDir: string): Promise<string> {
        const folderPath = `${this.debugLogDir}/${subDir}`;
        if (!this.app.vault.getAbstractFileByPath(this.debugLogDir)) {
            await this.app.vault.createFolder(this.debugLogDir);
        }
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
        }
        return folderPath;
    }

    private buildDebugBaseName(title: string): string {
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 30);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${safeTitle}_${timestamp}`;
    }

    private wrapDebugHtml(html: string): string {
        return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>MoFa Debug Output</title></head><body>\n${html}\n</body></html>`;
    }

    private buildBisectTargetFromHtml(html: string): BisectTarget | null {
        const doc = new DOMParser().parseFromString(`<div data-mofa-bisect-root="1">${html}</div>`, 'text/html');
        const root = doc.body.querySelector('[data-mofa-bisect-root="1"]');
        if (!(root instanceof HTMLElement)) {
            return null;
        }

        const article = root.querySelector('.mofa-article');
        if (article instanceof HTMLElement) {
            return this.buildBisectTargetFromElement(article, '.mofa-article');
        }

        return this.buildBisectTargetFromElement(root, 'root');
    }

    private buildBisectTargetFromFragment(item: BisectItem): BisectTarget | null {
        const doc = new DOMParser().parseFromString(`<div data-mofa-bisect-root="1">${item.html}</div>`, 'text/html');
        const root = doc.body.querySelector('[data-mofa-bisect-root="1"]');
        if (!(root instanceof HTMLElement)) {
            return null;
        }

        const meaningfulChildren = Array.from(root.childNodes).filter((node) => this.isMeaningfulNode(node));
        if (meaningfulChildren.length === 1 && meaningfulChildren[0].nodeType === Node.ELEMENT_NODE) {
            return this.buildBisectTargetFromElement(meaningfulChildren[0] as Element, item.path);
        }

        return this.buildBisectTargetFromElement(root, item.path);
    }

    private buildBisectTargetFromElement(element: Element, path: string): BisectTarget | null {
        const children = Array.from(element.childNodes).filter((node) => this.isMeaningfulNode(node));
        if (children.length < 2) {
            return null;
        }

        const { start, end } = this.buildElementShell(element);
        return {
            path,
            wrapperStart: start,
            wrapperEnd: end,
            items: children.map((node, index) => this.nodeToBisectItem(node, path, index)),
        };
    }

    private buildElementShell(element: Element): { start: string; end: string } {
        const emptyClone = element.cloneNode(false);
        const serialized = this.serializeNode(emptyClone);
        const closingTag = `</${element.tagName.toLowerCase()}>`;
        if (serialized.endsWith(closingTag)) {
            return {
                start: serialized.slice(0, -closingTag.length),
                end: closingTag,
            };
        }
        return { start: serialized, end: '' };
    }

    private nodeToBisectItem(node: Node, parentPath: string, index: number): BisectItem {
        const html = this.serializeNode(node);
        const tagName = node.nodeType === Node.ELEMENT_NODE
            ? (node as Element).tagName.toLowerCase()
            : '#text';

        return {
            html,
            path: `${parentPath}[${index}]`,
            tagName,
            preview: clipPreviewText(node.textContent || ''),
        };
    }

    private renderBisectTarget(target: BisectTarget, items: readonly BisectItem[]): string {
        return `${target.wrapperStart}${items.map((item) => item.html).join('')}${target.wrapperEnd}`;
    }

    private isMeaningfulNode(node: Node): boolean {
        if (node.nodeType === Node.TEXT_NODE) {
            return Boolean(node.textContent?.trim());
        }
        return true;
    }

    private serializeNode(node: Node): string {
        return new XMLSerializer()
            .serializeToString(node)
            .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
    }

    /**
     * 上传 HTML 中的所有图片到微信，替换 src 为微信 CDN URL
     * 参考 note-to-mp 的 LocalImageManager 架构：
     * 图片 src 此时仍是 vault 内原始路径（未被转为 app://），
     * 直接通过 vault API 读取本地文件上传
     */
    private async uploadAllImages(
        html: string,
        sourcePath: string,
        token: string,
        uploadFn: (data: Blob, filename: string, token: string, type?: string) => Promise<UploadResult>
    ): Promise<string> {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const images = doc.body.querySelectorAll('img');

        for (const img of Array.from(images)) {
            const src = img.getAttribute('src') || '';
            if (!src) continue;
            // 已经是微信 URL 的跳过
            if (src.includes('mmbiz.qpic.cn')) continue;

            try {
                const blob = await this.fetchImageAsBlob(src, sourcePath);
                if (blob) {
                    // 推断文件名和后缀
                    let filename = 'image.png';
                    const extMatch = src.match(/data:image\/(\w+)/);
                    if (extMatch) {
                        filename = `image.${extMatch[1]}`;
                    } else {
                        // 从路径中提取文件名
                        const pathParts = src.split('/').pop()?.split('?')[0];
                        if (pathParts && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathParts)) {
                            filename = pathParts;
                        }
                    }

                    const result = await uploadFn(blob, filename, token);
                    if (result.url) {
                        img.setAttribute('src', result.url);
                    } else if (result.errcode) {
                        console.warn(`图片上传失败: ${result.errmsg}`);
                    }
                } else {
                    console.warn(`无法读取图片: ${src}`);
                }
            } catch (e) {
                console.warn(`上传图片失败: ${src}`, e);
            }
        }

        const serializer = new XMLSerializer();
        let result = '';
        for (let i = 0; i < doc.body.childNodes.length; i++) {
            result += serializer.serializeToString(doc.body.childNodes[i]);
        }
        return result.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
    }

    /**
     * 获取图片的 Blob 数据
     * 支持：网络图片、DataURI、app:// 协议、Vault 内路径
     *
     * 参考 note-to-mp 的做法：优先通过 vault API 读取本地文件，
     * 避免通过 requestUrl(app://) 获取的不可靠性
     */
    private async fetchImageAsBlob(src: string, sourcePath: string): Promise<Blob | null> {
        try {
            // 1. 网络图片（http/https）→ 使用 Obsidian requestUrl
            if (src.startsWith('http://') || src.startsWith('https://')) {
                const res = await requestUrl({ url: src, method: 'GET' });
                return new Blob([res.arrayBuffer]);
            }

            // 2. data URI → 直接转 Blob
            if (src.startsWith('data:')) {
                const [header, b64data] = src.split(',');
                const mimeMatch = header.match(/data:([^;]+)/);
                const mime = mimeMatch ? mimeMatch[1] : 'image/png';
                const byteString = atob(b64data);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                return new Blob([ab], { type: mime });
            }

            // 3. app:// 协议 → 尝试从 URL 中反解文件名，通过 vault 查找
            if (src.startsWith('app://')) {
                const file = this.resolveAppUrl(src, sourcePath);
                if (file) {
                    const arrayBuf = await this.app.vault.readBinary(file);
                    return new Blob([arrayBuf], { type: this.getMimeType(file.extension) });
                }
                // 回退：尝试 requestUrl
                try {
                    const res = await requestUrl({ url: src, method: 'GET' });
                    return new Blob([res.arrayBuffer]);
                } catch {
                    console.warn(`app:// URL 获取失败: ${src}`);
                    return null;
                }
            }

            // 4. Vault 内路径（相对路径或文件名）→ 直接通过 vault API 读取
            // 注意：先 URL 解码（markdown-it 会将中文路径编码为 %XX）
            const decodedSrc = decodeURIComponent(src);
            console.debug('[MoFa] 解析 vault 图片路径:', src, '->', decodedSrc);
            const file = this.resolveVaultFile(decodedSrc, sourcePath);
            if (file) {
                const arrayBuf = await this.app.vault.readBinary(file);
                return new Blob([arrayBuf], { type: this.getMimeType(file.extension) });
            }

            return null;
        } catch (error) {
            console.warn(`读取图片失败 (${src}):`, error);
            return null;
        }
    }

    /**
     * 从 app:// URL 中提取文件名并在 vault 中查找对应文件
     */
    private resolveAppUrl(appUrl: string, sourcePath: string): TFile | null {
        try {
            // app:// URL 格式: app://xxx/vault-path/to/image.png?timestamp
            const url = new URL(appUrl);
            let pathname = decodeURIComponent(url.pathname);
            // 去掉开头的 /
            if (pathname.startsWith('/')) pathname = pathname.substring(1);

            // 尝试直接用路径查找
            const file = this.resolveVaultFile(pathname, sourcePath);
            if (file) return file;

            // 尝试只用文件名查找
            const filename = pathname.split('/').pop();
            if (filename) {
                return this.resolveVaultFile(filename, sourcePath);
            }
        } catch {
            // URL 解析失败，忽略
        }
        return null;
    }

    /**
     * 在 vault 中查找图片文件（支持直接路径、相对路径、链接解析）
     */
    private resolveVaultFile(imagePath: string, sourcePath: string): TFile | null {
        const vault = this.app.vault;

        // 1. 直接路径
        let file = vault.getAbstractFileByPath(imagePath);
        if (file && file instanceof TFile) return file;

        // 2. 相对路径
        const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        const relPath = sourceDir ? `${sourceDir}/${imagePath}` : imagePath;
        file = vault.getAbstractFileByPath(relPath);
        if (file && file instanceof TFile) return file;

        // 3. Obsidian 链接解析（处理不带路径的文件名）
        const linked = this.app.metadataCache.getFirstLinkpathDest(imagePath, sourcePath);
        if (linked && linked instanceof TFile) return linked;

        return null;
    }

    /**
     * 根据文件扩展名获取 MIME 类型
     */
    private getMimeType(ext: string): string {
        const mimeMap: Record<string, string> = {
            'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
        };
        return mimeMap[ext.toLowerCase()] || 'image/png';
    }

    /**
     * 将 <hr> 替换为 SVG 装饰分割线
     */
    private replaceDividers(html: string): string {
        const svgDividers = [
            `<section style="text-align:center;margin:1.5em 0;line-height:0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30" style="width:80%;height:30px;"><path d="M0,15 Q75,0 150,15 T300,15 T450,15 T600,15" fill="none" stroke="#ccc" stroke-width="1.5" opacity="0.5"/></svg></section>`,
            `<section style="text-align:center;margin:1.5em 0;line-height:0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 20" style="width:80%;height:20px;"><line x1="0" y1="10" x2="260" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/><polygon points="300,2 308,10 300,18 292,10" fill="#ccc" opacity="0.4"/><line x1="340" y1="10" x2="600" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/></svg></section>`,
            `<section style="text-align:center;margin:1.5em 0;line-height:0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" style="width:60px;height:16px;"><circle cx="20" cy="5" r="3" fill="#ccc" opacity="0.4"/><circle cx="50" cy="5" r="3" fill="#ccc" opacity="0.6"/><circle cx="80" cy="5" r="3" fill="#ccc" opacity="0.4"/></svg></section>`,
            `<section style="text-align:center;margin:1.5em 0;line-height:0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 24" style="width:80%;height:24px;"><line x1="0" y1="12" x2="250" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/><path d="M290,12 Q300,2 310,12 Q300,22 290,12Z" fill="#ccc" opacity="0.35"/><line x1="350" y1="12" x2="600" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/></svg></section>`,
        ];

        let index = 0;
        return html.replace(/<hr\s*\/?>/gi, () => {
            const svg = svgDividers[index % svgDividers.length];
            index++;
            return svg;
        });
    }

    private setStatus(text: string) {
        if (this.statusEl) {
            this.statusEl.setText(text);
        }
    }
}
