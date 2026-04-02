/**
 * 链接处理器
 * 微信公众号不支持外链，需要将链接转换为其他形式
 * 支持两种模式：脚注模式 / 直接展示模式
 */

/**
 * 将 Markdown 中的链接转换为脚注形式
 * [链接文本](url) → 链接文本[^1]  ... [^1]: url
 *
 * 在 Markdown 层面处理（渲染前）
 */
export function processLinksToFootnotes(markdown: string): string {
    const links: { text: string; url: string }[] = [];
    let footnoteIndex = 1;

    // 匹配 [text](url) 但不匹配图片 ![text](url)
    const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;

    const processed = markdown.replace(linkRegex, (match, text, url) => {
        // 跳过锚点链接
        if (url.startsWith('#')) return match;

        const index = footnoteIndex++;
        links.push({ text, url });
        return `**${text}**<sup>[${index}]</sup>`;
    });

    if (links.length === 0) return markdown;

    // 在文末添加脚注区域
    let footnoteSection = '\n\n---\n\n**🔗 参考链接**\n\n';
    links.forEach((link, i) => {
        footnoteSection += `[${i + 1}] ${link.text}: *${link.url}*\n\n`;
    });

    return processed + footnoteSection;
}

/**
 * 在 HTML 层面将 <a> 标签转换为纯文本 + URL 展示
 * （渲染后处理）
 */
export function processLinksInline(html: string): string {
    // 将 <a href="url">text</a> 替换为 text（url）
    return html.replace(
        /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
        (match, url, text) => {
            // 跳过锚点链接
            if (url.startsWith('#')) return text;
            return `<strong>${text}</strong><span style="font-size: 0.85em; color: #999;">（${url}）</span>`;
        }
    );
}
