import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { MofaSettingTab, MofaSettings, DEFAULT_SETTINGS } from './settings';
import { MofaPublishView, MOFA_VIEW_TYPE } from './publish-view';

export default class MofaPlugin extends Plugin {
    settings: MofaSettings = DEFAULT_SETTINGS;

    async onload() {
        await this.loadSettings();

        // 注册侧边栏视图
        this.registerView(
            MOFA_VIEW_TYPE,
            (leaf) => new MofaPublishView(leaf, this)
        );

        // 添加工具栏图标按钮
        this.addRibbonIcon('send', '墨发 - 发布到公众号', () => {
            void this.activateView();
        });

        // 添加命令
        this.addCommand({
            id: 'open-panel',
            name: '打开发布面板',
            callback: () => {
                void this.activateView();
            },
        });

        this.addCommand({
            id: 'copy-to-wechat',
            name: '复制到公众号',
            callback: async () => {
                await this.copyToWechat();
            },
        });

        this.addCommand({
            id: 'diagnose-wechat-invalid-content',
            name: '定位当前文档出错元素',
            callback: async () => {
                await this.diagnoseWechatInvalidContent();
            },
        });

        // 添加设置面板
        this.addSettingTab(new MofaSettingTab(this.app, this));

        console.debug('墨发插件已加载');
    }

    onunload() {
        console.debug('墨发插件已卸载');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(MOFA_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({
                    type: MOFA_VIEW_TYPE,
                    active: true,
                });
            }
        }

        if (leaf) {
            void workspace.revealLeaf(leaf);
        }
    }

    async copyToWechat() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('请先打开一篇笔记');
            return;
        }

        await this.runWithPublishView(async (view) => {
            await view.copyToClipboard();
        });
    }

    async diagnoseWechatInvalidContent() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('请先打开一篇笔记');
            return;
        }

        await this.runWithPublishView(async (view) => {
            await view.diagnoseWechatFailure();
        });
    }

    private async runWithPublishView(action: (view: MofaPublishView) => Promise<void>) {
        const leaves = this.app.workspace.getLeavesOfType(MOFA_VIEW_TYPE);
        if (leaves.length > 0) {
            const view = leaves[0].view as MofaPublishView;
            await action(view);
        } else {
            await this.activateView();
            setTimeout(() => {
                const newLeaves = this.app.workspace.getLeavesOfType(MOFA_VIEW_TYPE);
                if (newLeaves.length > 0) {
                    const view = newLeaves[0].view as MofaPublishView;
                    void action(view);
                }
            }, 500);
        }
    }
}
