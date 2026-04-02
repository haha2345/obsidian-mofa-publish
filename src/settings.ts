import { App, PluginSettingTab, Setting, Notice, requestUrl } from 'obsidian';
import type MofaPlugin from './main';

export interface MofaSettings {
    // 基础设置
    defaultTheme: string;
    codeHighlight: string;
    linkStyle: 'footnote' | 'inline';
    mathEngine: 'katex' | 'asciimath';

    // 公众号设置
    wechatAppId: string;
    wechatAppSecret: string;

    // 高级设置
    customCssNote: string;
    embedStyle: 'quote' | 'inline';
    showLineNumbers: boolean;
}

export const DEFAULT_SETTINGS: MofaSettings = {
    defaultTheme: 'default',
    codeHighlight: 'github-dark',
    linkStyle: 'footnote',
    mathEngine: 'katex',
    wechatAppId: '',
    wechatAppSecret: '',
    customCssNote: '',
    embedStyle: 'quote',
    showLineNumbers: true,
};

export class MofaSettingTab extends PluginSettingTab {
    plugin: MofaPlugin;

    constructor(app: App, plugin: MofaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ===== 基础设置 =====
        new Setting(containerEl).setName('📌 基础设置').setHeading();

        new Setting(containerEl)
            .setName('默认主题')
            .setDesc('选择文章的排版主题风格')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('default', '默认白')
                    .addOption('github', 'GitHub')
                    .addOption('dark', '暗夜')
                    .addOption('sakura', '樱花')
                    .addOption('mint', '薄荷')
                    .addOption('coffee', '咖啡')
                    .addOption('ink', '水墨')
                    .addOption('orange', '暖橙')
                    .addOption('sspai', '少数派')
                    .addOption('rainbow', '彩虹糖')
                    .setValue(this.plugin.settings.defaultTheme)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultTheme = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('代码高亮主题')
            .setDesc('选择代码块的高亮配色方案')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('github-dark', 'GitHub Dark')
                    .addOption('github', 'GitHub Light')
                    .addOption('monokai', 'Monokai')
                    .addOption('dracula', 'Dracula')
                    .addOption('one-dark', 'One Dark')
                    .setValue(this.plugin.settings.codeHighlight)
                    .onChange(async (value) => {
                        this.plugin.settings.codeHighlight = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('链接处理方式')
            .setDesc('微信公众号不支持外链，选择链接的展示方式')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('footnote', '文末脚注（推荐）')
                    .addOption('inline', '直接展示链接地址')
                    .setValue(this.plugin.settings.linkStyle)
                    .onChange(async (value: 'footnote' | 'inline') => {
                        this.plugin.settings.linkStyle = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('显示代码行号')
            .setDesc('在代码块中显示行号')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showLineNumbers)
                    .onChange(async (value) => {
                        this.plugin.settings.showLineNumbers = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ===== 公众号设置 =====
        new Setting(containerEl).setName('📤 公众号设置（可选）').setHeading();
        containerEl.createEl('p', {
            text: '填写后可使用"一键发送到草稿箱"功能。不填也可以使用"复制到公众号"功能。',
            cls: 'setting-item-description',
        });

        new Setting(containerEl)
            .setName('AppID')
            .setDesc('微信公众号的 AppID')
            .addText((text) =>
                text
                    .setPlaceholder('wx1234567890abcdef')
                    .setValue(this.plugin.settings.wechatAppId)
                    .onChange(async (value) => {
                        this.plugin.settings.wechatAppId = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('AppSecret')
            .setDesc('微信公众号的 AppSecret')
            .addText((text) =>
                text
                    .setPlaceholder('点击输入 AppSecret')
                    .setValue(this.plugin.settings.wechatAppSecret)
                    .onChange(async (value) => {
                        this.plugin.settings.wechatAppSecret = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 测试连接按钮
        new Setting(containerEl)
            .setName('测试连接')
            .setDesc('验证 AppID 和 AppSecret 是否正确')
            .addButton((button) =>
                button
                    .setButtonText('🔗 测试连接')
                    .setCta()
                    .onClick(async () => {
                        if (!this.plugin.settings.wechatAppId || !this.plugin.settings.wechatAppSecret) {
                            const { Notice } = await import('obsidian');
                            new Notice('请先填写 AppID 和 AppSecret');
                            return;
                        }
                        button.setButtonText('连接中...');
                        button.setDisabled(true);
                        try {
                            const { wxTestConnection } = await import('./wechat/wechat-api');
                            await wxTestConnection(
                                this.plugin.settings.wechatAppId,
                                this.plugin.settings.wechatAppSecret
                            );
                        } finally {
                            button.setButtonText('🔗 测试连接');
                            button.setDisabled(false);
                        }
                    })
            );

        // 查询当前公网 IP 按钮
        new Setting(containerEl)
            .setName('查询当前公网 IP')
            .setDesc('查询你的出口 IP，用于添加到公众号 IP 白名单')
            .addButton((button) =>
                button
                    .setButtonText('🌐 查询 IP')
                    .onClick(async () => {
                        button.setButtonText('查询中...');
                        button.setDisabled(true);
                        try {
                            const res = await requestUrl({ url: 'https://api.ipify.org?format=json', method: 'GET' });
                            const ip = res.json.ip;
                            new Notice(`你的公网 IP: ${ip}\n已复制到剪贴板，请到公众号后台 IP 白名单中添加`, 10000);
                            await navigator.clipboard.writeText(ip);
                        } catch (e) {
                            console.error('查询 IP 失败:', e);
                            new Notice('查询失败，请打开浏览器访问 https://ifconfig.me 查看');
                        } finally {
                            button.setButtonText('🌐 查询 IP');
                            button.setDisabled(false);
                        }
                    })
            );

        // 如何获取 AppID 的说明
        const helpEl = containerEl.createEl('details');
        helpEl.createEl('summary', { text: '🔍 如何获取 AppID 和 AppSecret？' });
        const helpContent = helpEl.createEl('div', { cls: 'mofa-help-content' });
        helpContent.createEl('ol')
            .createEl('li', { text: '登录微信公众平台：https://mp.weixin.qq.com' })
            .parentElement?.createEl('li', { text: '进入「设置与开发」→「基本配置」' })
            .parentElement?.createEl('li', { text: '复制开发者 ID（AppID）' })
            .parentElement?.createEl('li', { text: '重置并复制开发者密码（AppSecret）' })
            .parentElement?.createEl('li', { text: '点击上方「查询 IP」按钮获取公网 IP' })
            .parentElement?.createEl('li', { text: '在公众号「IP 白名单」中添加该 IP' })
            .parentElement?.createEl('li', { text: '⚠️ 如果 IP 变化（路由器重启等），需要重新查询并更新白名单' });

        // ===== 高级设置 =====
        new Setting(containerEl).setName('🎨 高级设置').setHeading();

        new Setting(containerEl)
            .setName('自定义主题笔记')
            .setDesc('指定一篇包含自定义 CSS 主题的笔记名（不含 .md 后缀），主题将出现在主题下拉列表中')
            .addText((text) =>
                text
                    .setPlaceholder('例如：我的公众号主题')
                    .setValue(this.plugin.settings.customCssNote)
                    .onChange(async (value) => {
                        this.plugin.settings.customCssNote = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 自定义主题格式说明
        const themeHelpEl = containerEl.createEl('details');
        themeHelpEl.createEl('summary', { text: '📝 如何创建自定义主题？' });
        const themeHelpContent = themeHelpEl.createEl('div', { cls: 'mofa-help-content' });
        themeHelpContent.createEl('p', { text: '在 Vault 中新建一篇笔记，添加 CSS 代码块：' });
        themeHelpContent.createEl('pre').createEl('code', {
            text: '```css title="我的主题"\n.mofa-article {\n    color: #333;\n    background-color: #f9f9f9;\n    padding: 20px;\n}\n.mofa-article h2 {\n    color: #e65100;\n    border-left: 4px solid #e65100;\n    padding-left: 12px;\n}\n```',
        });
        themeHelpContent.createEl('p', { text: '💡 一篇笔记内可放多个代码块，每个都会显示为独立主题。' });
    }
}
