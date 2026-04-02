/**
 * 图片处理器
 * 处理三种图片来源：本地路径、网络图片、渲染后的图片
 * 两种输出模式：Base64 内嵌（复制模式） / 上传到公众号素材库（API 模式）
 */

import { App, TFile, requestUrl } from 'obsidian';

export interface ProcessedImage {
    originalSrc: string;
    base64: string;
    mimeType: string;
    buffer?: ArrayBuffer;
}

/**
 * 将 HTML 中的所有图片转为 Base64 内嵌
 * 解决微信"此图片来自第三方"的问题
 */
export async function processImagesForCopy(html: string, app: App, sourcePath: string): Promise<string> {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const container = doc.body;

    const images = container.querySelectorAll('img');

    for (const img of Array.from(images)) {
        const src = img.getAttribute('src') || '';

        // 跳过已经是 base64 的图片
        if (src.startsWith('data:')) continue;

        try {
            let base64 = '';

            if (src.startsWith('http://') || src.startsWith('https://')) {
                // 网络图片 → requestUrl → base64
                base64 = await fetchImageAsBase64(src);
            } else {
                // 本地图片（包括 Obsidian vault 内的路径）
                base64 = await readLocalImageAsBase64(src, app, sourcePath);
            }

            if (base64) {
                img.setAttribute('src', base64);
            }
        } catch (error) {
            console.error(`图片处理失败: ${src}`, error);
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
 * 获取 HTML 中所有需要上传的图片信息
 */
export async function extractImages(html: string, app: App, sourcePath: string): Promise<ProcessedImage[]> {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const container = doc.body;
    const images = container.querySelectorAll('img');
    const results: ProcessedImage[] = [];

    for (const img of Array.from(images)) {
        const src = img.getAttribute('src') || '';
        if (!src) continue;

        try {
            let base64 = '';

            if (src.startsWith('data:')) {
                base64 = src;
            } else if (src.startsWith('http://') || src.startsWith('https://')) {
                base64 = await fetchImageAsBase64(src);
            } else {
                base64 = await readLocalImageAsBase64(src, app, sourcePath);
            }

            const mimeMatch = base64.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

            results.push({
                originalSrc: src,
                base64,
                mimeType,
            });
        } catch (error) {
            console.error(`提取图片失败: ${src}`, error);
        }
    }

    return results;
}

/**
 * 从网络获取图片并转为 base64（使用 Obsidian 的 requestUrl）
 */
async function fetchImageAsBase64(url: string): Promise<string> {
    const res = await requestUrl({ url, method: 'GET' });
    const arrayBuffer = res.arrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);

    // 根据 content-type 或 URL 推断 mime type
    const contentType = res.headers['content-type'] || '';
    let mimeType = 'image/png';
    if (contentType.includes('image/')) {
        mimeType = contentType.split(';')[0].trim();
    } else if (url.match(/\.jpe?g/i)) {
        mimeType = 'image/jpeg';
    } else if (url.match(/\.gif/i)) {
        mimeType = 'image/gif';
    } else if (url.match(/\.webp/i)) {
        mimeType = 'image/webp';
    } else if (url.match(/\.svg/i)) {
        mimeType = 'image/svg+xml';
    }

    return `data:${mimeType};base64,${base64}`;
}

/**
 * 读取本地图片为 base64
 */
async function readLocalImageAsBase64(
    path: string,
    app: App,
    sourcePath: string
): Promise<string> {
    // 尝试解析为 vault 内的文件路径
    let file: TFile | null = null;

    // 1. 尝试直接路径
    const abstractFile = app.vault.getAbstractFileByPath(path);
    if (abstractFile instanceof TFile) {
        file = abstractFile;
    }

    // 2. 尝试相对路径（相对于当前笔记）
    if (!file) {
        const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        const relativePath = sourceDir ? `${sourceDir}/${path}` : path;
        const relFile = app.vault.getAbstractFileByPath(relativePath);
        if (relFile instanceof TFile) {
            file = relFile;
        }
    }

    // 3. 尝试 Obsidian 的链接解析
    if (!file) {
        const linkedFile = app.metadataCache.getFirstLinkpathDest(path, sourcePath);
        if (linkedFile) {
            file = linkedFile;
        }
    }

    if (!file) {
        console.warn(`找不到图片文件: ${path}`);
        return '';
    }

    const arrayBuffer = await app.vault.readBinary(file);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);

    const ext = file.extension.toLowerCase();
    const mimeMap: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'image/png';

    return `data:${mimeType};base64,${base64}`;
}
