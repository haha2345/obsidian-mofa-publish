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
        // 方式1: 使用 Clipboard API（推荐）
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
        console.warn('Clipboard API 失败，尝试 fallback 方式:', e);

        try {
            // 方式2: fallback - 使用 execCommand
            return copyRichTextFallback(html);
        } catch (e2) {
            console.error('复制失败:', e2);
            new Notice('❌ 复制失败，请重试');
            return false;
        }
    }
}

/**
 * 使用 execCommand 的 fallback 复制方式
 */
function copyRichTextFallback(html: string): boolean {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.opacity = '0';

    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);

    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    const success = document.execCommand('copy');

    if (selection) {
        selection.removeAllRanges();
    }
    document.body.removeChild(container);

    if (success) {
        new Notice('✅ 已复制到剪贴板！请到公众号编辑器粘贴');
    } else {
        new Notice('❌ 复制失败，请重试');
    }

    return success;
}

/**
 * 去除 HTML 标签，获取纯文本
 */
function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}
