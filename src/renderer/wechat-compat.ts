/**
 * 微信公众号 DOM 兼容性处理
 * 将标准 HTML 转换为微信编辑器兼容的格式
 *
 * 核心处理：
 * 1. 所有 CSS 样式 inline 化（微信不支持 <style> 标签）
 * 2. 列表 DOM 重塑（防止微信中塌陷）
 * 3. 表格兼容处理
 * 4. 图片处理
 */

export interface WechatCompatOptions {
    themeCSS: string;
    customCSS?: string;
}

/**
 * 将带主题的 HTML 转换为微信兼容的 inline-styled HTML
 */
export function makeWechatCompatible(html: string, options: WechatCompatOptions): string {
    const container = document.createElement('div');
    container.className = 'mofa-render-container';
    container.innerHTML = html;

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
        let result = container.innerHTML;

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
 * 
 * 原因：markdown-it 生成的列表 HTML 包含换行和空格：
 *   <ol>\n<li>\n<p>内容</p>\n</li>\n<li>...
 * 浏览器预览时会忽略这些空白，但微信编辑器会把它们解析为额外的空列表项
 */
function compactListHTML(html: string): string {
    // 1. 去掉 <li> 内的 <p> 包裹（松散列表产生的，微信不需要）
    //    <li><p>内容</p></li> → <li>内容</li>
    html = html.replace(/<li([^>]*)>\s*<p([^>]*)>([\s\S]*?)<\/p>\s*<\/li>/gi, 
        (match, liAttr, pAttr, content) => `<li${liAttr}>${content.trim()}</li>`);

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
 * 解决方案：用 <section> 包裹内容，微信会保留 section 的背景色
 */
function preserveBackground(container: HTMLElement) {
    const articleEl = container.querySelector('.mofa-article') as HTMLElement;
    if (!articleEl) return;

    const bgColor = articleEl.style.backgroundColor;
    if (!bgColor || bgColor === 'transparent' || bgColor === '#fff' || bgColor === '#ffffff' || bgColor === 'rgb(255, 255, 255)') {
        return; // 白色背景不需要特殊处理
    }

    // 给 .mofa-article 内的每个直接子元素添加背景色
    // 这样即使微信剥离了外层背景，每个段落的背景仍然保留
    const children = articleEl.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (!child.style.backgroundColor) {
            child.style.backgroundColor = bgColor;
        }
    }

    // 也给整体包一层 section
    const section = document.createElement('section');
    section.style.backgroundColor = bgColor;
    section.style.padding = articleEl.style.padding || '20px';
    // 把 articleEl 的所有子元素移入 section
    while (articleEl.firstChild) {
        section.appendChild(articleEl.firstChild);
    }
    articleEl.appendChild(section);
}

/**
 * 解析 CSS 文本并将样式直接 inline 到匹配的元素上
 * 这是微信兼容的核心——微信会剥离 <style>，所以必须内联
 */
function inlineFromCSS(container: HTMLElement, cssText: string) {
    // 解析 CSS 规则：提取 selector { ... } 对
    const rules = parseCSSRules(cssText);

    for (const rule of rules) {
        // 将 .mofa-article 选择器替换为容器内可查询的选择器
        // 例如 ".mofa-article h2" → "h2"（在 container 内查找）
        // ".mofa-article" 本身 → 直接应用到 .mofa-article div
        let selector = rule.selector.trim();

        try {
            // 处理 .mofa-article 自身的样式
            if (selector === '.mofa-article') {
                const articleEl = container.querySelector('.mofa-article') || container;
                applyStyles(articleEl as HTMLElement, rule.declarations);
                continue;
            }

            // 去掉 .mofa-article 前缀
            if (selector.startsWith('.mofa-article ')) {
                selector = selector.replace('.mofa-article ', '');
            }

            // 跳过伪元素（微信不支持）
            if (selector.includes('::') || selector.includes(':before') || selector.includes(':after')) {
                continue;
            }

            // 查找匹配元素并 inline 样式
            const elements = container.querySelectorAll(selector);
            elements.forEach((el) => {
                applyStyles(el as HTMLElement, rule.declarations);
            });
        } catch (e) {
            // 无效选择器跳过
            console.warn('CSS 选择器解析失败:', selector, e);
        }
    }
}

/**
 * 解析 CSS 文本为规则数组
 */
function parseCSSRules(cssText: string): Array<{ selector: string; declarations: string }> {
    const rules: Array<{ selector: string; declarations: string }> = [];

    // 移除注释
    cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

    // 用正则提取 selector { declarations }
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

    // 解析新声明
    const props = declarations.split(';').filter(s => s.trim());
    for (const prop of props) {
        const colonIndex = prop.indexOf(':');
        if (colonIndex <= 0) continue;
        const name = prop.slice(0, colonIndex).trim();
        const value = prop.slice(colonIndex + 1).trim();

        // 跳过微信不支持的属性
        if (name.startsWith('-webkit-background-clip') || name === 'background-clip') {
            // 微信不支持 background-clip: text，转为普通颜色
            continue;
        }
        if (name === '-webkit-text-fill-color') {
            // 转为普通 color
            existingMap['color'] = value;
            continue;
        }

        // 不覆盖已有的 inline style（更具体的样式优先）
        if (!existingMap[name]) {
            existingMap[name] = value;
        }
    }

    // 重新序列化
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
 * 批量处理指定标签（保留用于列表等非主题处理）
 */
function processElements(container: HTMLElement, tag: string, styleFn: (el: HTMLElement) => void) {
    container.querySelectorAll(tag).forEach((el) => {
        styleFn(el as HTMLElement);
    });
}

/**
 * 列表 DOM 重塑（微信兼容）
 */
function processLists(container: HTMLElement) {
    // 强力清理所有空的 <li> 元素
    // markdown-it breaks:true 会产生各种形式的空 li：
    // <li></li>, <li><br></li>, <li><p></p></li>, <li><p><br></p></li>, <li>\n</li>
    container.querySelectorAll('li').forEach((li) => {
        const liEl = li as HTMLElement;
        // 检查是否有实质内容
        const text = liEl.textContent?.trim() || '';
        const hasMedia = liEl.querySelector('img, input, pre, code, table, svg');
        if (!text && !hasMedia) {
            liEl.remove();
            return;
        }
        // 额外检查：只包含空 <p> 标签的情况
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
        if (!ulEl.style.paddingLeft) ulEl.style.paddingLeft = '2em';
        if (!ulEl.style.marginBottom) ulEl.style.marginBottom = '1em';

        ulEl.querySelectorAll(':scope > li').forEach((li) => {
            const liEl = li as HTMLElement;
            if (!liEl.style.marginBottom) liEl.style.marginBottom = '0.5em';
            if (!liEl.style.lineHeight) liEl.style.lineHeight = '1.8';
        });
    });

    // 处理有序列表
    container.querySelectorAll('ol').forEach((ol) => {
        const olEl = ol as HTMLElement;
        if (!olEl.style.paddingLeft) olEl.style.paddingLeft = '2em';
        if (!olEl.style.marginBottom) olEl.style.marginBottom = '1em';

        olEl.querySelectorAll(':scope > li').forEach((li) => {
            const liEl = li as HTMLElement;
            if (!liEl.style.marginBottom) liEl.style.marginBottom = '0.5em';
            if (!liEl.style.lineHeight) liEl.style.lineHeight = '1.8';
        });
    });

    // 处理任务列表
    container.querySelectorAll('.task-list-item').forEach((li) => {
        const liEl = li as HTMLElement;
        liEl.style.listStyleType = 'none';
        liEl.style.marginLeft = '-1.5em';

        const checkbox = liEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox) {
            const isChecked = checkbox.checked;
            const icon = document.createElement('span');
            icon.textContent = isChecked ? '☑' : '☐';
            icon.style.marginRight = '0.5em';
            icon.style.fontSize = '1.1em';
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
        wrapper.style.overflowX = 'auto';
        wrapper.style.marginBottom = '1em';
        tableEl.parentNode?.insertBefore(wrapper, tableEl);
        wrapper.appendChild(tableEl);

        if (!tableEl.style.width) tableEl.style.width = '100%';
        tableEl.style.borderCollapse = 'collapse';
        if (!tableEl.style.fontSize) tableEl.style.fontSize = '14px';

        tableEl.querySelectorAll('th').forEach((th) => {
            const thEl = th as HTMLElement;
            if (!thEl.style.padding) thEl.style.padding = '8px 12px';
            if (!thEl.style.border) thEl.style.border = '1px solid #dfe2e5';
            if (!thEl.style.backgroundColor) thEl.style.backgroundColor = '#f6f8fa';
            if (!thEl.style.fontWeight) thEl.style.fontWeight = '600';
            if (!thEl.style.textAlign) thEl.style.textAlign = 'left';
        });

        tableEl.querySelectorAll('td').forEach((td) => {
            const tdEl = td as HTMLElement;
            if (!tdEl.style.padding) tdEl.style.padding = '8px 12px';
            if (!tdEl.style.border) tdEl.style.border = '1px solid #dfe2e5';
        });
    });
}

/**
 * 代码块处理
 */
function processCodeBlocks(container: HTMLElement) {
    container.querySelectorAll('pre.mofa-code-block').forEach((pre) => {
        const preEl = pre as HTMLElement;
        if (!preEl.style.backgroundColor) preEl.style.backgroundColor = '#1e1e1e';
        if (!preEl.style.color) preEl.style.color = '#d4d4d4';
        preEl.style.padding = '16px';
        preEl.style.borderRadius = '8px';
        preEl.style.overflow = 'auto';
        if (!preEl.style.fontSize) preEl.style.fontSize = '13px';
        preEl.style.lineHeight = '1.6';
        preEl.style.marginBottom = '1em';
    });

    container.querySelectorAll(':not(pre) > code').forEach((code) => {
        const codeEl = code as HTMLElement;
        if (!codeEl.style.backgroundColor) codeEl.style.backgroundColor = 'rgba(175, 184, 193, 0.2)';
        if (!codeEl.style.padding) codeEl.style.padding = '2px 6px';
        if (!codeEl.style.borderRadius) codeEl.style.borderRadius = '4px';
        if (!codeEl.style.fontSize) codeEl.style.fontSize = '0.9em';
        if (!codeEl.style.fontFamily) codeEl.style.fontFamily = '"SF Mono", "Fira Code", Menlo, monospace';
    });
}

/**
 * 图片处理
 */
function processImages(container: HTMLElement) {
    container.querySelectorAll('img').forEach((img) => {
        const imgEl = img as HTMLElement;
        if (!imgEl.style.maxWidth) imgEl.style.maxWidth = '100%';
        imgEl.style.height = 'auto';
        if (!imgEl.style.display) imgEl.style.display = 'block';
        if (!imgEl.style.margin) imgEl.style.margin = '1em auto';
    });
}

/**
 * 行内元素处理
 */
function processInlineElements(container: HTMLElement) {
    container.querySelectorAll('strong').forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl.style.fontWeight) htmlEl.style.fontWeight = '700';
    });

    container.querySelectorAll('em').forEach((el) => {
        (el as HTMLElement).style.fontStyle = 'italic';
    });

    container.querySelectorAll('del').forEach((el) => {
        (el as HTMLElement).style.textDecoration = 'line-through';
        if (!(el as HTMLElement).style.color) (el as HTMLElement).style.color = '#999';
    });

    container.querySelectorAll('mark').forEach((el) => {
        if (!(el as HTMLElement).style.backgroundColor) (el as HTMLElement).style.backgroundColor = 'rgba(255, 208, 0, 0.4)';
        (el as HTMLElement).style.padding = '2px 4px';
    });
}

/**
 * 将 <hr> 替换为 SVG 装饰分割线
 * 每篇文章中的分割线交替使用不同样式
 */
function processDividers(container: HTMLElement) {
    const svgDividers = [
        // 波浪
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30" style="width:80%;height:30px;display:inline-block;"><path d="M0,15 Q75,0 150,15 T300,15 T450,15 T600,15" fill="none" stroke="#ccc" stroke-width="1.5" opacity="0.5"/></svg></section>`,
        // 菱形
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 20" style="width:80%;height:20px;display:inline-block;"><line x1="0" y1="10" x2="260" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/><polygon points="300,2 308,10 300,18 292,10" fill="#ccc" opacity="0.4"/><line x1="340" y1="10" x2="600" y2="10" stroke="#ccc" stroke-width="0.8" opacity="0.4"/></svg></section>`,
        // 三圆点
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 10" style="width:60%;height:16px;display:inline-block;"><circle cx="270" cy="5" r="3" fill="#ccc" opacity="0.4"/><circle cx="300" cy="5" r="3" fill="#ccc" opacity="0.6"/><circle cx="330" cy="5" r="3" fill="#ccc" opacity="0.4"/></svg></section>`,
        // 树叶
        `<section style="text-align:center;margin:1.5em 0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 24" style="width:80%;height:24px;display:inline-block;"><line x1="0" y1="12" x2="250" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/><path d="M290,12 Q300,2 310,12 Q300,22 290,12Z" fill="#ccc" opacity="0.35"/><line x1="350" y1="12" x2="600" y2="12" stroke="#ccc" stroke-width="0.6" opacity="0.3"/></svg></section>`,
    ];

    const hrs = container.querySelectorAll('hr');
    hrs.forEach((hr, index) => {
        const svgHtml = svgDividers[index % svgDividers.length];
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgHtml;
        const svgSection = wrapper.firstChild as HTMLElement;
        if (svgSection) {
            hr.replaceWith(svgSection);
        }
    });
}
