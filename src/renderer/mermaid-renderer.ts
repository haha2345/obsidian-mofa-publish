/**
 * Mermaid 图表渲染器
 * 
 * 复用 note-to-mp 的成熟方案：
 * 1. 使用 Obsidian 内置的 MarkdownRenderer.render() 渲染 Mermaid
 *    - 这样无需单独引入 mermaid.js，减少包体积
 *    - 利用 Obsidian 已有的 Mermaid 渲染管线，兼容性更好
 * 2. 使用 html-to-image 的 toPng() 将渲染后的 SVG 转为 PNG
 *    - 这是 note-to-mp 实战验证的方案
 *    - 比手动 Canvas 转换更可靠
 * 
 * 参考：https://github.com/sunbooshi/note-to-mp (MIT License)
 */

import { App, MarkdownRenderer, Component } from 'obsidian';
import { toPng } from 'html-to-image';

/**
 * 渲染 Mermaid 代码为 PNG Base64
 * 
 * 流程：
 * 1. 创建隐藏容器
 * 2. 用 Obsidian MarkdownRenderer 渲染 Mermaid 代码块
 * 3. 等待 SVG 生成
 * 4. 用 html-to-image 转为 PNG
 * 5. 返回 Base64 data URL
 */
export async function renderMermaidToPng(
    app: App,
    mermaidCode: string,
    sourcePath: string
): Promise<string> {
    // 创建隐藏容器 - 使用 CSS class 而非 inline style
    const container = document.createElement('div');
    container.addClass('mofa-offscreen-render');
    document.body.appendChild(container);

    const component = new Component();
    component.load();

    try {
        // 用 Obsidian 内置渲染器渲染 Mermaid
        const mermaidMd = '```mermaid\n' + mermaidCode + '\n```';
        await MarkdownRenderer.render(app, mermaidMd, container, sourcePath, component);

        // 等待 Mermaid SVG 渲染完成
        await waitForMermaidSVG(container, 5000);

        const mermaidEl = container.querySelector('.mermaid');
        if (!mermaidEl || !(mermaidEl instanceof HTMLElement) || !mermaidEl.children.length) {
            throw new Error('Mermaid 渲染失败：未生成 SVG');
        }

        const svg = mermaidEl.querySelector('svg');
        if (!svg) {
            throw new Error('Mermaid 渲染失败：未找到 SVG 元素');
        }

        // 使用 html-to-image 转为 PNG（复用 note-to-mp 的方案）
        const pngDataUrl = await toPng(mermaidEl.firstElementChild as HTMLElement, {
            pixelRatio: 2,
            style: { margin: '0' },
        });

        return pngDataUrl;
    } finally {
        component.unload();
        document.body.removeChild(container);
    }
}

/**
 * 处理 HTML 中的所有 Mermaid 占位块
 * 将 .mofa-mermaid 占位符替换为渲染后的 PNG 图片
 */
export async function processMermaidBlocks(
    html: string,
    app: App,
    sourcePath: string
): Promise<string> {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const container = doc.body;

    const mermaidBlocks = container.querySelectorAll('.mofa-mermaid');
    if (mermaidBlocks.length === 0) return html;

    for (let i = 0; i < mermaidBlocks.length; i++) {
        const block = mermaidBlocks[i] as HTMLElement;
        const code = block.getAttribute('data-mermaid') || block.textContent || '';
        if (!code.trim()) continue;

        try {
            // 反转义 HTML 实体
            const decodedCode = decodeHtmlEntities(code);
            const pngDataUrl = await renderMermaidToPng(app, decodedCode, sourcePath);

            // 替换为 img 标签
            const imgEl = document.createElement('img');
            imgEl.src = pngDataUrl;
            imgEl.alt = 'Mermaid 图表';
            imgEl.addClass('mofa-mermaid-img');

            block.parentNode?.replaceChild(imgEl, block);
        } catch (error) {
            console.error(`Mermaid 块 ${i} 处理失败:`, error);
            const errorEl = document.createElement('p');
            errorEl.addClass('mofa-mermaid-error');
            errorEl.textContent = `⚠️ Mermaid 图表渲染失败: ${(error as Error).message}`;
            block.parentNode?.replaceChild(errorEl, block);
        }
    }

    const serializer = new XMLSerializer();
    let result = '';
    for (let i = 0; i < container.childNodes.length; i++) {
        result += serializer.serializeToString(container.childNodes[i]);
    }
    return result.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
}

/**
 * 等待 Mermaid SVG 渲染完成
 */
function waitForMermaidSVG(container: HTMLElement, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            const svg = container.querySelector('.mermaid svg');
            if (svg) {
                // SVG 找到了，等待一小段时间确保渲染完全
                setTimeout(resolve, 200);
                return;
            }
            if (Date.now() - startTime > timeout) {
                reject(new Error('Mermaid 渲染超时'));
                return;
            }
            requestAnimationFrame(check);
        };

        check();
    });
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
