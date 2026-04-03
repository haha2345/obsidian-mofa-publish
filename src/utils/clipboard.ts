/**
 * 富文本复制到剪贴板
 * 将 HTML 以富文本格式写入剪贴板，以便直接粘贴到微信公众号编辑器
 */

import { Notice } from 'obsidian';

/**
 * 将 HTML 内容以富文本格式复制到剪贴板
 */
export async function copyRichTextToClipboard(html: string): Promise<boolean> {
    try {
        // 使用 Clipboard API（Obsidian 运行在 Electron 中，此 API 可用）
        const blob = new Blob([html], { type: 'text/html' });
        const plainBlob = new Blob([stripHtml(html)], { type: 'text/plain' });

        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': blob,
                'text/plain': plainBlob,
            }),
        ]);

        new Notice('✅ 已复制到剪贴板！请到公众号编辑器粘贴');
        return true;
    } catch (e) {
        console.error('复制失败:', e);
        new Notice('❌ 复制失败，请重试');
        return false;
    }
}

/**
 * 去除 HTML 标签，获取纯文本
 */
function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}
