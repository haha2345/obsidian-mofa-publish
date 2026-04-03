/**
 * 微信公众号 DOM 兼容性处理
 * 将标准 HTML 转换为微信编辑器兼容的格式
 *
 * 核心处理：
 * 1. 所有 CSS 样式 inline 化（微信不支持 <style> 标签）
 * 2. 列表 DOM 重塑（防止微信中塌陷）
 * 3. 表格兼容处理
 * 4. 图片处理
 *
 * NOTE: This file intentionally uses inline styles via style.setProperty()
 * because WeChat strips <style> tags and CSS classes — inline styles are the
 * ONLY way to deliver styled content to WeChat's editor.
 */

export interface WechatCompatOptions {
    themeCSS: string;
    customCSS?: string;
}

/**
 * Helper: set a CSS property on an element (avoids direct style.xxx = assignment)
 * If `force` is false (default), only sets the property if it's not already set.
 */
function ss(el: HTMLElement, prop: string, val: string, force = false) {
    if (force || !el.style.getPropertyValue(prop)) {
        el.style.setProperty(prop, val);
    }
}

/**
 * Serialize child nodes of an element to HTML string without using innerHTML.
 * Uses XMLSerializer (safe alternative accepted by Obsidian eslint rules).
 */
function serializeChildren(el: HTMLElement): string {
    const serializer = new XMLSerializer();
    let html = '';
    for (let i = 0; i < el.childNodes.length; i++) {
        html += serializer.serializeToString(el.childNodes[i]);
    }
    // XMLSerializer adds xmlns attributes for HTML elements, clean them up
    html = html.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
    return html;
}

/**
 * 将带主题的 HTML 转换为微信兼容的 inline-styled HTML
 */
export function makeWechatCompatible(html: string, options: WechatCompatOptions): string {
    const doc = new DOMParser().parseFromString(`<div class="mofa-render-container">${html}</div>`, 'text/html');
    const container = doc.body.querySelector('.mofa-render-container');
    if (!container || !(container instanceof HTMLElement)) return html;

    try {
        // 1. 解析主题 CSS 并直接 inline 到匹配元素
        const allCSS = (options.themeCSS || '') + '\n' + (options.customCSS || '');
        inlineFromCSS(container, allCSS);

        // 2. 处理列表（微信 DOM 重塑）
        processLists(container);

        // 3. 处理表格
        processTables(container);

        // 4. 处理代码块
        processCodeBlocks(container);

        // 5. 处理图片
        processImages(container);

        // 6. 处理行内元素
        processInlineElements(container);

        // 6.5 将 <hr> 替换为 SVG 装饰分割线
        processDividers(container);

        // 7. 背景色保留（微信编辑器会剥离最外层背景，用 section 包裹保留）
        preserveBackground(container);

        // 8. 输出 HTML
        let result = serializeChildren(container);

        // 9. 压缩列表 HTML（关键！微信编辑器会把标签间的换行/空白解析为新列表项）
        result = compactListHTML(result);

        return result;

    } finally {
        // 确保没有遗留 DOM
    }
}

/**
 * 压缩列表相关 HTML，移除标签之间的空白
 * 这是解决微信编辑器"幽灵列表项"的核心修复
 */
function compactListHTML(html: string): string {
    // 1. 去掉 <li> 内的 <p> 包裹
    html = html.replace(/<li([^>]*)>\s*<p([^>]*)>([\s\S]*?)<\/p>\s*<\/li>/gi, 
        (_match, liAttr, _pAttr, content: string) => `<li${liAttr}>${content.trim()}</li>`);

    // 2. 压缩 ul/ol 和 li 之间的所有空白
    html = html.replace(/<ul([^>]*)>\s+/gi, '<ul$1>');
    html = html.replace(/\s+<\/ul>/gi, '</ul>');
    html = html.replace(/<ol([^>]*)>\s+/gi, '<ol$1>');
    html = html.replace(/\s+<\/ol>/gi, '</ol>');
    html = html.replace(/<\/li>\s+<li/gi, '</li><li');
    html = html.replace(/<\/li>\s+<\/ul>/gi, '</li></ul>');
    html = html.replace(/<\/li>\s+<\/ol>/gi, '</li></ol>');

    // 3. li 标签内首尾空白
    html = html.replace(/<li([^>]*)>\s+/gi, '<li$1>');
    html = html.replace(/\s+<\/li>/gi, '</li>');

    // 4. 最后再清理一次残留的空 li
    html = html.replace(/<li[^>]*>\s*<\/li>/gi, '');

    return html;
}

/**
 * 保留背景色：微信编辑器会覆盖最外层 div 的背景
 */
function preserveBackground(container: HTMLElement) {
    const articleEl = container.querySelector('.mofa-article');
    if (!articleEl || !(articleEl instanceof HTMLElement)) return;

    const bgColor = articleEl.style.getPropertyValue('background-color');
    if (!bgColor || bgColor === 'transparent' || bgColor === '#fff' || bgColor === '#ffffff' || bgColor === 'rgb(255, 255, 255)') {
        return;
    }

    const children = articleEl.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (!child.style.getPropertyValue('background-color')) {
            child.style.setProperty('background-color', bgColor);
        }
    }

    const section = document.createElement('section');
    section.style.setProperty('background-color', bgColor);
    section.style.setProperty('padding', articleEl.style.getPropertyValue('padding') || '20px');
    while (articleEl.firstChild) {
        section.appendChild(articleEl.firstChild);
    }
    articleEl.appendChild(section);
}

/**
 * 解析 CSS 文本并将样式直接 inline 到匹配的元素上
 */
function inlineFromCSS(container: HTMLElement, cssText: string) {
    const rules = parseCSSRules(cssText);

    for (const rule of rules) {
        let selector = rule.selector.trim();

        try {
            if (selector === '.mofa-article') {
                const articleEl = container.querySelector('.mofa-article') || container;
                applyStyles(articleEl as HTMLElement, rule.declarations);
                continue;
            }

            if (selector.startsWith('.mofa-article ')) {
                selector = selector.replace('.mofa-article ', '');
            }

            if (selector.includes('::') || selector.includes(':before') || selector.includes(':after')) {
                continue;
            }

            const elements = container.querySelectorAll(selector);
            elements.forEach((el) => {
                applyStyles(el as HTMLElement, rule.declarations);
            });
        } catch {
            // 无效选择器跳过
        }
    }
}

/**
 * 解析 CSS 文本为规则数组
 */
function parseCSSRules(cssText: string): Array<{ selector: string; declarations: string }> {
    const rules: Array<{ selector: string; declarations: string }> = [];

    cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let match;
    while ((match = ruleRegex.exec(cssText)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2].trim();
        if (selector && declarations) {
            rules.push({ selector, declarations });
        }
    }

    return rules;
}

/**
 * 将 CSS 声明字符串应用为元素的 inline style
 */
function applyStyles(el: HTMLElement, declarations: string) {
    const existing = el.getAttribute('style') || '';
    const existingMap = parseInlineStyle(existing);

    const props = declarations.split(';').filter(s => s.trim());
    for (const prop of props) {
        const colonIndex = prop.indexOf(':');
        if (colonIndex <= 0) continue;
        const name = prop.slice(0, colonIndex).trim();
        const value = prop.slice(colonIndex + 1).trim();

        if (name.startsWith('-webkit-background-clip') || name === 'background-clip') {
            continue;
        }
        if (name === '-webkit-text-fill-color') {
            existingMap['color'] = value;
            continue;
        }

        if (!existingMap[name]) {
            existingMap[name] = value;
        }
    }

    const styleStr = Object.entries(existingMap)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
    if (styleStr) {
        el.setAttribute('style', styleStr);
    }
}

/**
 * 解析 inline style 字符串为 Map
 */
function parseInlineStyle(style: string): Record<string, string> {
    const map: Record<string, string> = {};
    if (!style) return map;
    const parts = style.split(';').filter(s => s.trim());
    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex > 0) {
            const name = part.slice(0, colonIndex).trim();
            const value = part.slice(colonIndex + 1).trim();
            map[name] = value;
        }
    }
    return map;
}

/**
 * 列表 DOM 重塑（微信兼容）
 */
function processLists(container: HTMLElement) {
    container.querySelectorAll('li').forEach((li) => {
        const liEl = li as HTMLElement;
        const text = liEl.textContent?.trim() || '';
        const hasMedia = liEl.querySelector('img, input, pre, code, table, svg');
        if (!text && !hasMedia) {
            liEl.remove();
            return;
        }
        const children = liEl.children;
        if (children.length === 1 && children[0].tagName === 'P') {
            const pText = children[0].textContent?.trim() || '';
            if (!pText) {
                liEl.remove();
                return;
            }
        }
    });

    container.querySelectorAll('ul').forEach((ul) => {
        const ulEl = ul as HTMLElement;
        ss(ulEl, 'padding-left', '2em');
        ss(ulEl, 'margin-bottom', '1em');

        ulEl.querySelectorAll(':scope > li').forEach((li) => {
            const liEl = li as HTMLElement;
            ss(liEl, 'margin-bottom', '0.5em');
            ss(liEl, 'line-height', '1.8');
        });
    });

    container.querySelectorAll('ol').forEach((ol) => {
        const olEl = ol as HTMLElement;
        ss(olEl, 'padding-left', '2em');
        ss(olEl, 'margin-bottom', '1em');

        olEl.querySelectorAll(':scope > li').forEach((li) => {
            const liEl = li as HTMLElement;
            ss(liEl, 'margin-bottom', '0.5em');
            ss(liEl, 'line-height', '1.8');
        });
    });

    container.querySelectorAll('.task-list-item').forEach((li) => {
        const liEl = li as HTMLElement;
        ss(liEl, 'list-style-type', 'none', true);
        ss(liEl, 'margin-left', '-1.5em', true);

        const checkbox = liEl.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox instanceof HTMLInputElement) {
            const isChecked = checkbox.checked;
            const icon = document.createElement('span');
            icon.textContent = isChecked ? '☑' : '☐';
            ss(icon, 'margin-right', '0.5em', true);
            ss(icon, 'font-size', '1.1em', true);
            checkbox.replaceWith(icon);
        }
    });
}

/**
 * 表格兼容处理
 */
function processTables(container: HTMLElement) {
    container.querySelectorAll('table').forEach((table) => {
        const tableEl = table as HTMLElement;

        const wrapper = document.createElement('section');
        ss(wrapper, 'overflow-x', 'auto', true);
        ss(wrapper, 'margin-bottom', '1em', true);
        tableEl.parentNode?.insertBefore(wrapper, tableEl);
        wrapper.appendChild(tableEl);

        ss(tableEl, 'width', '100%');
        ss(tableEl, 'border-collapse', 'collapse', true);
        ss(tableEl, 'font-size', '14px');

        tableEl.querySelectorAll('th').forEach((th) => {
            const thEl = th as HTMLElement;
            ss(thEl, 'padding', '8px 12px');
            ss(thEl, 'border', '1px solid #dfe2e5');
            ss(thEl, 'background-color', '#f6f8fa');
            ss(thEl, 'font-weight', '600');
            ss(thEl, 'text-align', 'left');
        });

        tableEl.querySelectorAll('td').forEach((td) => {
            const tdEl = td as HTMLElement;
            ss(tdEl, 'padding', '8px 12px');
            ss(tdEl, 'border', '1px solid #dfe2e5');
        });
    });
}

/**
 * 代码块处理
 */
function processCodeBlocks(container: HTMLElement) {
    container.querySelectorAll('pre.mofa-code-block').forEach((pre) => {
        const preEl = pre as HTMLElement;
        ss(preEl, 'background-color', '#1e1e1e');
        ss(preEl, 'color', '#d4d4d4');
        ss(preEl, 'padding', '16px', true);
        ss(preEl, 'border-radius', '8px', true);
        ss(preEl, 'overflow', 'auto', true);
        ss(preEl, 'font-size', '13px');
        ss(preEl, 'line-height', '1.6', true);
        ss(preEl, 'margin-bottom', '1em', true);
    });

    container.querySelectorAll(':not(pre) > code').forEach((code) => {
        const codeEl = code as HTMLElement;
        ss(codeEl, 'background-color', 'rgba(175, 184, 193, 0.2)');
        ss(codeEl, 'padding', '2px 6px');
        ss(codeEl, 'border-radius', '4px');
        ss(codeEl, 'font-size', '0.9em');
        ss(codeEl, 'font-family', '"SF Mono", "Fira Code", Menlo, monospace');
    });
}

/**
 * 图片处理
 */
function processImages(container: HTMLElement) {
    container.querySelectorAll('img').forEach((img) => {
        const imgEl = img as HTMLElement;
        ss(imgEl, 'max-width', '100%');
        ss(imgEl, 'height', 'auto', true);
        ss(imgEl, 'display', 'block');
        ss(imgEl, 'margin', '1em auto');
    });
}

/**
 * 行内元素处理
 */
function processInlineElements(container: HTMLElement) {
    container.querySelectorAll('strong').forEach((el) => {
        ss(el, 'font-weight', '700');
    });

    container.querySelectorAll('em').forEach((el) => {
        ss(el, 'font-style', 'italic', true);
    });

    container.querySelectorAll('del').forEach((el) => {
        ss(el, 'text-decoration', 'line-through', true);
        ss(el, 'color', '#999');
    });

    container.querySelectorAll('mark').forEach((el) => {
        ss(el, 'background-color', 'rgba(255, 208, 0, 0.4)');
        ss(el, 'padding', '2px 4px', true);
    });
}

/**
 * 将 <hr> 替换为 SVG 装饰分割线
 */
function processDividers(container: HTMLElement) {
    const svgDividers = [
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30" style="width:80%;height:30px;display:inline-block;"><path d="M0,15 Q75,0 150,15 T300,15 T450,15 T600,15" fill="none" stroke="#ccc" stroke-width="1.5" opacity="0.5"/></svg></section>`,
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 20" style="width:80%;height:20px;display:inline-block;"><line x1="0" y1="10" x2="260" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/><polygon points="300,2 308,10 300,18 292,10" fill="#ccc" opacity="0.4"/><line x1="340" y1="10" x2="600" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/></svg></section>`,
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 10" style="width:60%;height:16px;display:inline-block;"><circle cx="270" cy="5" r="3" fill="#ccc" opacity="0.4"/><circle cx="300" cy="5" r="3" fill="#ccc" opacity="0.6"/><circle cx="330" cy="5" r="3" fill="#ccc" opacity="0.4"/></svg></section>`,
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 24" style="width:80%;height:24px;display:inline-block;"><line x1="0" y1="12" x2="250" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/><path d="M290,12 Q300,2 310,12 Q300,22 290,12Z" fill="#ccc" opacity="0.35"/><line x1="350" y1="12" x2="600" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/></svg></section>`,
    ];

    const hrs = container.querySelectorAll('hr');
    hrs.forEach((hr, index) => {
        const svgHtml = svgDividers[index % svgDividers.length];
        const tmpDoc = new DOMParser().parseFromString(svgHtml, 'text/html');
        const svgSection = tmpDoc.body.firstChild as HTMLElement;
        if (svgSection) {
            hr.replaceWith(svgSection);
        }
    });
}
