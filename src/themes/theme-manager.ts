/**
 * 主题管理器
 * 管理内置主题、SVG 装饰和用户自定义主题
 */

export interface Theme {
    id: string;
    name: string;
    css: string;
    category?: 'basic' | 'elegant' | 'tech' | 'creative';
}

/**
 * 获取所有内置主题
 */
export function getBuiltinThemes(): Theme[] {
    return [
        // ── 基础系列 ──
        { id: 'default', name: '📄 默认白', css: defaultTheme, category: 'basic' },
        { id: 'github', name: '🐙 GitHub', css: githubTheme, category: 'basic' },
        { id: 'dark', name: '🌙 暗夜', css: darkTheme, category: 'basic' },
        // ── 优雅系列 ──
        { id: 'sakura', name: '🌸 樱花', css: sakuraTheme, category: 'elegant' },
        { id: 'mint', name: '🍃 薄荷', css: mintTheme, category: 'elegant' },
        { id: 'coffee', name: '☕ 咖啡', css: coffeeTheme, category: 'elegant' },
        { id: 'ink', name: '🖌️ 水墨', css: inkTheme, category: 'elegant' },
        { id: 'orange', name: '🍊 暖橙', css: orangeTheme, category: 'elegant' },
        // ── 技术系列 ──
        { id: 'sspai', name: '📱 少数派', css: sspaiTheme, category: 'tech' },
        { id: 'rainbow', name: '🌈 彩虹糖', css: rainbowTheme, category: 'creative' },
        // ── 新增高级系列 ──
        { id: 'ocean', name: '🌊 深海', css: oceanTheme, category: 'elegant' },
        { id: 'aurora', name: '🌌 极光', css: auroraTheme, category: 'creative' },
        { id: 'bamboo', name: '🎋 竹韵', css: bambooTheme, category: 'elegant' },
        { id: 'neon', name: '💜 霓虹', css: neonTheme, category: 'creative' },
        { id: 'paper', name: '📰 报纸', css: paperTheme, category: 'tech' },
    ];
}

export function getThemeById(id: string): Theme | undefined {
    return getBuiltinThemes().find((t) => t.id === id);
}

/**
 * 加载外部主题（从 vault 笔记中读取 CSS）
 */
export function parseExternalTheme(noteContent: string, themeName: string): Theme | null {
    // 支持两种格式：
    // 1. 纯 CSS 文件
    // 2. Markdown 笔记中的 ```css 代码块
    let css = '';

    // 尝试提取代码块中的 CSS
    const codeBlockMatch = noteContent.match(/```css\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
        css = codeBlockMatch[1].trim();
    } else {
        // 整个文件就是 CSS
        css = noteContent.trim();
    }

    if (!css) return null;

    // 如果用户没有写 .mofa-article 前缀，自动包裹
    if (!css.includes('.mofa-article')) {
        css = `.mofa-article {\n${css}\n}`;
    }

    return {
        id: `custom_${Date.now()}`,
        name: `🎨 ${themeName}`,
        css,
        category: 'creative',
    };
}

// ============================================================
// SVG 装饰元素（内联 SVG，微信兼容）
// ============================================================

/** 波浪分割线 SVG */
const svgWaveDivider = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30" style="width:100%;height:30px;display:block;margin:1.5em auto;"><path d="M0,15 Q75,0 150,15 T300,15 T450,15 T600,15" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"/></svg>`;

/** 菱形装饰分割线 */
const svgDiamondDivider = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 20" style="width:100%;height:20px;display:block;margin:1.5em auto;"><line x1="0" y1="10" x2="260" y2="10" stroke="currentColor" stroke-width="0.8" opacity="0.2"/><polygon points="300,2 308,10 300,18 292,10" fill="currentColor" opacity="0.25"/><line x1="340" y1="10" x2="600" y2="10" stroke="currentColor" stroke-width="0.8" opacity="0.2"/></svg>`;

/** 树叶装饰分割线 */
const svgLeafDivider = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 24" style="width:100%;height:24px;display:block;margin:1.5em auto;"><line x1="0" y1="12" x2="250" y2="12" stroke="currentColor" stroke-width="0.6" opacity="0.15"/><path d="M290,12 Q300,2 310,12 Q300,22 290,12Z" fill="currentColor" opacity="0.2"/><line x1="350" y1="12" x2="600" y2="12" stroke="currentColor" stroke-width="0.6" opacity="0.15"/></svg>`;

/** 圆点装饰分割线 */
const svgDotsDivider = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 10" style="width:100%;height:10px;display:block;margin:1.5em auto;"><circle cx="280" cy="5" r="2.5" fill="currentColor" opacity="0.25"/><circle cx="300" cy="5" r="2.5" fill="currentColor" opacity="0.4"/><circle cx="320" cy="5" r="2.5" fill="currentColor" opacity="0.25"/></svg>`;

// ============================================================
// 基础排版常量
// ============================================================

const baseTypography = `
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    font-size: 15px;
    line-height: 1.8;
    letter-spacing: 0.5px;
    word-break: break-word;
    overflow-wrap: break-word;
`;

// ============================================================
// 原有 10 套主题（保持不变）
// ============================================================

const defaultTheme = `
.mofa-article {
    ${baseTypography}
    color: #333;
    background-color: #fff;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 8px; }
.mofa-article h2 { font-size: 1.4em; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #333; }
.mofa-article blockquote { border-left: 4px solid #ddd; color: #666; padding-left: 16px; margin: 16px 0; }
.mofa-article a { color: #576b95; }
.mofa-article strong { color: #1a1a1a; }
.mofa-article img { border-radius: 4px; }
.mofa-article hr { border: none; height: 30px; background: transparent; }
`;

const githubTheme = `
.mofa-article {
    ${baseTypography}
    color: #24292f;
    background-color: #fff;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #1f2328; border-bottom: 1px solid #d1d9e0; padding-bottom: 8px; font-weight: 600; }
.mofa-article h2 { font-size: 1.4em; color: #1f2328; border-bottom: 1px solid #d1d9e0; padding-bottom: 6px; font-weight: 600; }
.mofa-article h3 { font-size: 1.2em; color: #1f2328; font-weight: 600; }
.mofa-article blockquote { border-left: 4px solid #d0d7de; color: #656d76; padding-left: 16px; }
.mofa-article code:not(.hljs) { background: rgba(175,184,193,0.2); padding: 2px 6px; border-radius: 6px; font-size: 0.85em; }
.mofa-article strong { font-weight: 600; }
.mofa-article img { border-radius: 6px; }
`;

const darkTheme = `
.mofa-article {
    ${baseTypography}
    color: #e6edf3;
    background-color: #0d1117;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #f0f6fc; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
.mofa-article h2 { font-size: 1.4em; color: #f0f6fc; border-bottom: 1px solid #30363d; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #e6edf3; }
.mofa-article blockquote { border-left: 4px solid #3b4048; color: #8b949e; padding-left: 16px; }
.mofa-article a { color: #58a6ff; }
.mofa-article code:not(.hljs) { background: rgba(110,118,129,0.4); padding: 2px 6px; border-radius: 6px; }
.mofa-article strong { color: #f0f6fc; }
.mofa-article hr { border-color: #30363d; }
.mofa-article table th { background-color: #161b22; border-color: #30363d; }
.mofa-article table td { border-color: #30363d; }
`;

const sakuraTheme = `
.mofa-article {
    ${baseTypography}
    color: #4a4a4a;
    background-color: #fff5f5;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #d63384; }
.mofa-article h2 { font-size: 1.4em; color: #e07098; border-bottom: 2px solid #fce4ec; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #c2185b; }
.mofa-article blockquote { border-left: 4px solid #f8bbd0; color: #8e6a7a; padding-left: 16px; background: #fef0f5; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #e91e63; }
.mofa-article code:not(.hljs) { background: #fce4ec; color: #c2185b; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #c2185b; }
.mofa-article hr { border-color: #f8bbd0; }
.mofa-article img { border-radius: 8px; box-shadow: 0 2px 12px rgba(233,30,99,0.1); }
`;

const mintTheme = `
.mofa-article {
    ${baseTypography}
    color: #3d4f5f;
    background-color: #f0faf4;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #0d9488; }
.mofa-article h2 { font-size: 1.4em; color: #0f766e; border-left: 4px solid #5eead4; padding-left: 12px; }
.mofa-article h3 { font-size: 1.2em; color: #115e59; }
.mofa-article blockquote { border-left: 4px solid #99f6e4; color: #5f8a80; padding-left: 16px; background: #e6fbf3; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #0d9488; }
.mofa-article code:not(.hljs) { background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #0f766e; }
.mofa-article img { border-radius: 8px; }
`;

const coffeeTheme = `
.mofa-article {
    ${baseTypography}
    color: #4a3728;
    background-color: #faf6f1;
    padding: 20px;
    font-family: Georgia, "Noto Serif SC", "Source Han Serif SC", serif;
}
.mofa-article h1 { font-size: 1.6em; color: #5d3a1a; }
.mofa-article h2 { font-size: 1.4em; color: #6f4e37; border-bottom: 2px solid #d4a574; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #7b5b3a; }
.mofa-article blockquote { border-left: 4px solid #d4a574; color: #8b7355; padding-left: 16px; background: #f5ebe0; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article code:not(.hljs) { background: #eddcd2; color: #6f4e37; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #5d3a1a; }
.mofa-article img { border-radius: 4px; box-shadow: 0 2px 8px rgba(93,58,26,0.15); }
`;

const inkTheme = `
.mofa-article {
    ${baseTypography}
    color: #333;
    background-color: #fefefe;
    padding: 20px;
    font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", serif;
}
.mofa-article h1 { font-size: 1.6em; color: #1a1a1a; text-align: center; letter-spacing: 4px; }
.mofa-article h2 { font-size: 1.35em; color: #2c2c2c; border-bottom: 1px solid #ccc; padding-bottom: 6px; letter-spacing: 2px; }
.mofa-article h3 { font-size: 1.15em; color: #444; letter-spacing: 1px; }
.mofa-article blockquote { border-left: 3px solid #999; color: #666; padding-left: 16px; font-style: italic; }
.mofa-article p { text-indent: 2em; }
.mofa-article strong { color: #1a1a1a; }
.mofa-article hr { border: none; text-align: center; }
.mofa-article img { border-radius: 2px; }
`;

const orangeTheme = `
.mofa-article {
    ${baseTypography}
    color: #3d3d3d;
    background-color: #fffbf5;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #e65100; }
.mofa-article h2 { font-size: 1.4em; color: #ef6c00; background: linear-gradient(to right, #fff3e0, transparent); padding: 8px 12px; border-radius: 4px; }
.mofa-article h3 { font-size: 1.2em; color: #f57c00; }
.mofa-article blockquote { border-left: 4px solid #ffb74d; color: #8d6e63; padding-left: 16px; background: #fff8e1; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #e65100; }
.mofa-article code:not(.hljs) { background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #bf360c; }
.mofa-article img { border-radius: 8px; }
`;

const sspaiTheme = `
.mofa-article {
    ${baseTypography}
    color: #333;
    background-color: #fff;
    padding: 20px;
    font-size: 16px;
}
.mofa-article h1 { font-size: 1.5em; color: #000; font-weight: 700; }
.mofa-article h2 { font-size: 1.3em; color: #d32f2f; font-weight: 700; border-left: 4px solid #d32f2f; padding-left: 12px; }
.mofa-article h3 { font-size: 1.15em; color: #333; font-weight: 600; }
.mofa-article blockquote { border-left: 3px solid #d32f2f; color: #666; padding-left: 16px; }
.mofa-article a { color: #d32f2f; }
.mofa-article code:not(.hljs) { background: #f5f5f5; color: #d32f2f; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
.mofa-article strong { color: #000; }
.mofa-article img { border-radius: 4px; }
.mofa-article p { line-height: 1.9; }
`;

const rainbowTheme = `
.mofa-article {
    ${baseTypography}
    color: #2d3436;
    background-color: #fff;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #6c5ce7; font-weight: 700; }
.mofa-article h2 { font-size: 1.4em; color: #6c5ce7; border-bottom: 3px solid #a78bfa; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #a855f7; }
.mofa-article blockquote { border-left: 4px solid #a78bfa; color: #7c3aed; padding-left: 16px; background: #f5f3ff; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #7c3aed; }
.mofa-article code:not(.hljs) { background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #5b21b6; }
.mofa-article img { border-radius: 12px; box-shadow: 0 4px 15px rgba(124,58,237,0.15); }
`;

// ============================================================
// 新增 5 套高级主题（带 SVG 装饰）
// ============================================================

// ---- 11. 深海 ----
const oceanTheme = `
.mofa-article {
    ${baseTypography}
    color: #c8d6e5;
    background-color: #0a1628;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; color: #48dbfb; text-align: center; letter-spacing: 2px; }
.mofa-article h2 { font-size: 1.4em; color: #0abde3; border-bottom: 2px solid rgba(72,219,251,0.3); padding-bottom: 8px; }
.mofa-article h3 { font-size: 1.2em; color: #45aaf2; }
.mofa-article blockquote { border-left: 4px solid #0abde3; color: #8395a7; padding-left: 16px; background: rgba(10,189,227,0.08); border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #48dbfb; }
.mofa-article code:not(.hljs) { background: rgba(72,219,251,0.15); color: #48dbfb; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #dfe6e9; }
.mofa-article hr { border: none; height: 30px; }
.mofa-article table th { background-color: #1e3a5f; border-color: #2d4a6f; color: #48dbfb; }
.mofa-article table td { border-color: #1e3a5f; }
.mofa-article img { border-radius: 8px; box-shadow: 0 4px 20px rgba(72,219,251,0.15); }
`;

// ---- 12. 极光 ----
const auroraTheme = `
.mofa-article {
    ${baseTypography}
    color: #2d3436;
    background-color: #f8f9fa;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.7em; color: #6c5ce7; font-weight: 800; text-align: center; }
.mofa-article h2 { font-size: 1.4em; color: #00b894; font-weight: 700; padding: 8px 16px; background: linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,184,148,0.08)); border-radius: 8px; }
.mofa-article h3 { font-size: 1.2em; color: #fd79a8; font-weight: 600; }
.mofa-article blockquote { border-left: 4px solid #6c5ce7; color: #636e72; padding-left: 16px; background: linear-gradient(135deg, rgba(108,92,231,0.05), rgba(253,121,168,0.05)); border-radius: 0 12px 12px 0; padding: 14px 18px; }
.mofa-article a { color: #6c5ce7; }
.mofa-article code:not(.hljs) { background: rgba(108,92,231,0.1); color: #6c5ce7; padding: 2px 8px; border-radius: 6px; }
.mofa-article strong { color: #2d3436; }
.mofa-article hr { border: none; height: 24px; }
.mofa-article img { border-radius: 12px; box-shadow: 0 8px 30px rgba(108,92,231,0.12); }
`;

// ---- 13. 竹韵 ----
const bambooTheme = `
.mofa-article {
    ${baseTypography}
    color: #2c3e2d;
    background-color: #f5f8f0;
    padding: 20px;
    font-family: "Noto Serif SC", "Source Han Serif SC", Georgia, serif;
}
.mofa-article h1 { font-size: 1.6em; color: #2e7d32; text-align: center; letter-spacing: 6px; font-weight: 400; }
.mofa-article h2 { font-size: 1.35em; color: #388e3c; letter-spacing: 2px; border-bottom: 1px solid #a5d6a7; padding-bottom: 8px; }
.mofa-article h3 { font-size: 1.15em; color: #43a047; letter-spacing: 1px; }
.mofa-article p { text-indent: 2em; }
.mofa-article blockquote { border-left: 3px solid #81c784; color: #5a7d5c; padding-left: 16px; background: rgba(129,199,132,0.08); border-radius: 0 6px 6px 0; padding: 12px 16px; font-style: italic; }
.mofa-article a { color: #2e7d32; }
.mofa-article code:not(.hljs) { background: #e8f5e9; color: #1b5e20; padding: 2px 6px; border-radius: 3px; }
.mofa-article strong { color: #1b5e20; }
.mofa-article hr { border: none; height: 24px; }
.mofa-article img { border-radius: 4px; box-shadow: 0 2px 10px rgba(46,125,50,0.1); }
`;

// ---- 14. 霓虹 ----
const neonTheme = `
.mofa-article {
    ${baseTypography}
    color: #b8c0cc;
    background-color: #1a1a2e;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.7em; color: #e94560; text-align: center; font-weight: 800; letter-spacing: 2px; text-shadow: 0 0 10px rgba(233,69,96,0.3); }
.mofa-article h2 { font-size: 1.4em; color: #e94560; font-weight: 700; border-left: 4px solid #e94560; padding-left: 14px; }
.mofa-article h3 { font-size: 1.2em; color: #ff6b81; }
.mofa-article blockquote { border-left: 3px solid #e94560; color: #8a8fa3; padding-left: 16px; background: rgba(233,69,96,0.06); border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #e94560; }
.mofa-article code:not(.hljs) { background: rgba(233,69,96,0.12); color: #ff6b81; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #eee; }
.mofa-article hr { border: none; height: 20px; }
.mofa-article table th { background-color: #16213e; border-color: #2a2f4a; color: #e94560; }
.mofa-article table td { border-color: #2a2f4a; }
.mofa-article img { border-radius: 8px; box-shadow: 0 4px 20px rgba(233,69,96,0.15); }
`;

// ---- 15. 报纸 ----
const paperTheme = `
.mofa-article {
    ${baseTypography}
    color: #1a1a1a;
    background-color: #faf8f0;
    padding: 20px;
    font-family: "Noto Serif SC", Georgia, "Times New Roman", serif;
    font-size: 16px;
}
.mofa-article h1 { font-size: 2em; color: #000; text-align: center; font-weight: 900; border-bottom: 3px double #000; padding-bottom: 10px; letter-spacing: 4px; }
.mofa-article h2 { font-size: 1.4em; color: #1a1a1a; font-weight: 800; border-bottom: 1px solid #333; padding-bottom: 4px; }
.mofa-article h3 { font-size: 1.15em; color: #333; font-weight: 700; }
.mofa-article p { text-indent: 2em; line-height: 2; }
.mofa-article blockquote { border-left: 3px solid #666; color: #555; padding-left: 16px; font-style: italic; }
.mofa-article code:not(.hljs) { background: #eee; color: #333; padding: 2px 6px; border-radius: 2px; font-size: 0.9em; }
.mofa-article strong { color: #000; font-weight: 900; }
.mofa-article hr { border: none; border-top: 1px solid #999; margin: 2em 0; }
.mofa-article img { border-radius: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.mofa-article a { color: #333; text-decoration: underline; }
`;

// ============================================================
// 导出 SVG 装饰（供 wechat-compat 使用）
// ============================================================

export const SVG_DIVIDERS = {
    wave: svgWaveDivider,
    diamond: svgDiamondDivider,
    leaf: svgLeafDivider,
    dots: svgDotsDivider,
};
