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
 * NOTE: This file intentionally keeps styles inline via setCssProps()
 * because WeChat strips <style> tags and CSS classes.
 */

export interface WechatCompatOptions {
    themeCSS: string;
    customCSS?: string;
}

/**
 * Helper: set a CSS property on an element while preserving existing values by default.
 * If `force` is false (default), only sets the property if it's not already set.
 */
function ss(el: HTMLElement, prop: string, val: string, force = false) {
    if (force || !el.style.getPropertyValue(prop)) {
        el.setCssProps({ [prop]: val });
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
        processCodeBlocks(container, allCSS);

        // 4.5 将 CSS 中的 ::before 伪元素转为真实 DOM（微信不支持伪元素）
        injectPseudoBeforeContent(container, allCSS);
        injectCodeBlockDots(container, allCSS);
        injectMarkerStyles(container, allCSS);

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
    // 1. 只解包单个 <p> 的 <li>（包含多个 <p> 的保留结构）
    html = html.replace(/<li([^>]*)>\s*<p([^>]*)>([\s\S]*?)<\/p>\s*<\/li>/gi,
        (_match, liAttr, _pAttr, content: string) => {
            // 检查 content 中是否包含其他 <p> 标签（多段落列表项）
            if (/<p[\s>]/i.test(content)) {
                // 多段落，保留原始结构
                return _match;
            }
            return `<li${liAttr}>${content.trim()}</li>`;
        });

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
 * 将 CSS 中带文字 content 的 ::before 伪元素转为真实 <span> DOM 节点。
 * 微信编辑器完全不支持伪元素，此函数解析 CSS 中的 ::before 规则并注入内联元素。
 *
 * 示例：`.mofa-article h3::before { content: "■"; color: #2F54EB; }`
 * 会在每个 h3 前面插入 <span style="color:#2F54EB;display:inline-block">■</span>
 */
function injectPseudoBeforeContent(container: HTMLElement, cssText: string) {
    const beforeRegex = /([^{}]+)::before\s*\{([^{}]+)\}/g;
    let match;
    while ((match = beforeRegex.exec(cssText)) !== null) {
        let selector = match[1].trim();
        const declarations = match[2];

        // 只处理有实际文字 content 的（跳过 content:'' 纯视觉圆点等）
        const contentMatch = declarations.match(/content:\s*["']([^"']+)["']/);
        if (!contentMatch) continue;
        const content = contentMatch[1];
        if (!content) continue;

        // 收集除 content 以外的 CSS 属性（color、margin-right 等）
        const otherProps: string[] = [];
        declarations.split(';').forEach((decl) => {
            const t = decl.trim();
            if (!t || /^content\s*:/i.test(t)) return;
            otherProps.push(t);
        });

        // 清理选择器前缀
        if (selector.startsWith('.mofa-article ')) {
            selector = selector.replace('.mofa-article ', '').trim();
        }

        try {
            container.querySelectorAll(selector).forEach((el) => {
                // 防止重复注入
                if (el.querySelector('.mofa-pseudo-before')) return;
                const span = document.createElement('span');
                span.className = 'mofa-pseudo-before';
                span.textContent = content;
                // inline-block 确保 color / margin 等生效
                const spanProps: Record<string, string> = { display: 'inline-block' };
                otherProps.forEach((prop) => {
                    const ci = prop.indexOf(':');
                    if (ci > 0) {
                        spanProps[prop.slice(0, ci).trim()] = prop.slice(ci + 1).trim();
                    }
                });
                span.setCssProps(spanProps);
                (el as HTMLElement).prepend(span);
            });
        } catch {
            // 无效选择器，忽略
        }
    }
}

/**
 * 将 pre::before 的 CSS 三色圆点装饰（macOS 红黄绿风格）转为真实 DOM 元素。
 * 原始技术：background + box-shadow 偏移实现三个圆点，微信不支持。
 * 替换为：三个真实 <span> 元素内联排列。
 */
function injectCodeBlockDots(container: HTMLElement, cssText: string) {
    // 检测是否存在 pre::before 且含 box-shadow（三色圆点装饰的特征）
    // 使用宽泛匹配，兼容 `.mofa-article pre::before` 和裸 `pre::before`
    const preBeforeMatch = cssText.match(/pre::before\s*\{([^}]+)\}/);
    if (!preBeforeMatch) return;
    const decls = preBeforeMatch[1];
    if (!decls.includes('box-shadow')) return;

    // 从 background 提取第一个圆点色，从 box-shadow 提取后两个
    const bgMatch = decls.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/);
    const shadowMatches = [...decls.matchAll(/#([0-9a-fA-F]{3,8})/g)].map((m) => `#${m[1]}`);
    // 去掉背景色自身，剩余的就是 box-shadow 中的颜色
    const firstColor = bgMatch ? bgMatch[1] : '#ff5f56';
    const shadowColors = shadowMatches.filter((c) => c !== firstColor).slice(0, 2);
    const dotColors = [firstColor, ...shadowColors];
    // 保底：如果解析失败就用默认三色
    while (dotColors.length < 3) dotColors.push(['#ffbd2e', '#27c93f'][dotColors.length - 1] ?? '#ccc');

    container.querySelectorAll('pre').forEach((pre) => {
        // 防止重复注入
        if (pre.querySelector('.mofa-code-dots')) return;

        const dotsRow = document.createElement('div');
        dotsRow.className = 'mofa-code-dots';
        dotsRow.setCssProps({
            display: 'block',
            'margin-bottom': '12px',
            'line-height': '1',
        });

        dotColors.forEach((color) => {
            const dot = document.createElement('span');
            dot.setCssProps({
                display: 'inline-block',
                width: '12px',
                height: '12px',
                'border-radius': '50%',
                'background-color': color,
                'margin-right': '6px',
            });
            dotsRow.appendChild(dot);
        });

        pre.prepend(dotsRow);
    });
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
            child.setCssProps({ 'background-color': bgColor });
        }
    }

    const section = document.createElement('section');
    section.setCssProps({
        'background-color': bgColor,
        padding: articleEl.style.getPropertyValue('padding') || '20px',
    });
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

    // 处理无序列表
    container.querySelectorAll('ul').forEach((ul) => {
        const ulEl = ul as HTMLElement;
        ss(ulEl, 'padding-left', '2em');
        ss(ulEl, 'margin-bottom', '1em');

        // 根据嵌套层级设置 list-style-type（与 Obsidian 编辑器保持一致）
        const depth = getListDepth(ulEl);
        if (depth === 0) {
            ss(ulEl, 'list-style-type', 'disc', true);
        } else if (depth === 1) {
            ss(ulEl, 'list-style-type', 'circle', true);
        } else {
            ss(ulEl, 'list-style-type', 'square', true);
        }

        ulEl.querySelectorAll(':scope > li').forEach((li) => {
            const liEl = li as HTMLElement;
            ss(liEl, 'margin-bottom', '0.5em');
            ss(liEl, 'line-height', '1.8');
        });
    });

    // 处理有序列表
    container.querySelectorAll('ol').forEach((ol) => {
        const olEl = ol as HTMLElement;
        ss(olEl, 'padding-left', '2em');
        ss(olEl, 'margin-bottom', '1em');

        // 根据嵌套层级设置 list-style-type
        const depth = getListDepth(olEl);
        if (depth === 0) {
            ss(olEl, 'list-style-type', 'decimal', true);
        } else if (depth === 1) {
            ss(olEl, 'list-style-type', 'lower-alpha', true);
        } else {
            ss(olEl, 'list-style-type', 'lower-roman', true);
        }

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
 * 获取列表元素的嵌套深度（0 = 顶层）1 = 第二层，以此类推）
 */
function getListDepth(el: HTMLElement): number {
    let depth = 0;
    let parent = el.parentElement;
    while (parent) {
        if (parent.tagName === 'UL' || parent.tagName === 'OL') {
            depth++;
        }
        // 停止在容器元素
        if (parent.classList.contains('mofa-render-container') || parent.classList.contains('mofa-article')) {
            break;
        }
        parent = parent.parentElement;
    }
    return depth;
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
/**
 * 将 CSS 中的 ::marker 伪元素转为 li 元素上的真实内联样式。
 * 微信不支持 ::marker，将颜色等属性直接应用到 li 元素，以保证列表符号颜色正确显示。
 */
function injectMarkerStyles(container: HTMLElement, cssText: string) {
    const markerRegex = /([^{}]+)::marker\s*\{([^{}]+)\}/g;
    let match;
    while ((match = markerRegex.exec(cssText)) !== null) {
        let selector = match[1].trim();
        const declarations = match[2];

        // 从声明中提取 color、font-size 等属性
        const props: Array<{ name: string; value: string }> = [];
        declarations.split(';').forEach((decl) => {
            const ci = decl.indexOf(':');
            if (ci > 0) {
                props.push({ name: decl.slice(0, ci).trim(), value: decl.slice(ci + 1).trim() });
            }
        });
        if (props.length === 0) continue;

        // 清理选择器前缀
        if (selector.startsWith('.mofa-article ')) {
            selector = selector.replace('.mofa-article ', '').trim();
        }

        try {
            container.querySelectorAll(selector).forEach((el) => {
                const markerProps: Record<string, string> = {};
                props.forEach(({ name, value }) => {
                    // ::marker 的属性（color、font-size）可直接应用到 li，在支持 ::marker 的环境中会继承给符号
                    markerProps[name] = value;
                });
                (el as HTMLElement).setCssProps(markerProps);
            });
        } catch {
            // 无效选择器
        }
    }
}

function processCodeBlocks(container: HTMLElement, cssText = '') {
    // hljs class → inline color 映射（One Dark 主题配色）
    const hljsColors: Record<string, string> = {
        'hljs-keyword': '#c678dd',
        'hljs-built_in': '#e6c07b',
        'hljs-type': '#e6c07b',
        'hljs-literal': '#d19a66',
        'hljs-number': '#d19a66',
        'hljs-string': '#98c379',
        'hljs-template-string': '#98c379',
        'hljs-regexp': '#98c379',
        'hljs-symbol': '#61aeee',
        'hljs-variable': '#e06c75',
        'hljs-attr': '#d19a66',
        'hljs-attribute': '#d19a66',
        'hljs-params': '#e06c75',
        'hljs-comment': '#5c6370',
        'hljs-doctag': '#c678dd',
        'hljs-meta': '#61aeee',
        'hljs-section': '#e06c75',
        'hljs-tag': '#e06c75',
        'hljs-name': '#e06c75',
        'hljs-selector-tag': '#e06c75',
        'hljs-selector-id': '#61aeee',
        'hljs-selector-class': '#e6c07b',
        'hljs-title': '#61aeee',
        'hljs-function': '#61aeee',
        'hljs-class': '#e6c07b',
        'hljs-property': '#61aeee',
        'hljs-punctuation': '#abb2bf',
        'hljs-operator': '#56b6c2',
        'hljs-addition': '#98c379',
        'hljs-deletion': '#e06c75',
    };

    container.querySelectorAll('pre.mofa-code-block').forEach((pre) => {
        const preEl = pre as HTMLElement;
        ss(preEl, 'background-color', '#21252b');
        ss(preEl, 'color', '#d4d4d4');
        ss(preEl, 'padding', '16px', true);
        ss(preEl, 'border-radius', '8px', true);
        ss(preEl, 'overflow', 'auto', true);
        ss(preEl, 'font-size', '13px');
        ss(preEl, 'line-height', '1.6', true);
        ss(preEl, 'margin-bottom', '1em', true);
        ss(preEl, 'box-shadow', '0 4px 12px rgba(0,0,0,0.1)', true);
        ss(preEl, 'position', 'relative', true);

        // 将 hljs 的 class 转为 inline color（sanitizer 会删除 class）
        for (const [cls, color] of Object.entries(hljsColors)) {
            preEl.querySelectorAll(`.${cls}`).forEach((el) => {
                (el as HTMLElement).setCssProps({ color });
            });
        }
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
