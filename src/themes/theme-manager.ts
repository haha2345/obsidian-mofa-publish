/**
 * 主题管理器
 * 管理内置主题和用户自定义主题
 */

export interface Theme {
    id: string;
    name: string;
    css: string;
}

/**
 * 获取所有可用主题
 */
export function getBuiltinThemes(): Theme[] {
    return [
        { id: 'default', name: '默认白', css: defaultTheme },
        { id: 'github', name: 'GitHub', css: githubTheme },
        { id: 'dark', name: '暗夜', css: darkTheme },
        { id: 'sakura', name: '樱花', css: sakuraTheme },
        { id: 'mint', name: '薄荷', css: mintTheme },
        { id: 'coffee', name: '咖啡', css: coffeeTheme },
        { id: 'ink', name: '水墨', css: inkTheme },
        { id: 'orange', name: '暖橙', css: orangeTheme },
        { id: 'sspai', name: '少数派', css: sspaiTheme },
        { id: 'rainbow', name: '彩虹糖', css: rainbowTheme },
    ];
}

export function getThemeById(id: string): Theme | undefined {
    return getBuiltinThemes().find((t) => t.id === id);
}

// ============================================================
// 内置主题 CSS
// ============================================================

const baseTypography = `
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    font-size: 15px;
    line-height: 1.8;
    letter-spacing: 0.5px;
    word-break: break-word;
    overflow-wrap: break-word;
`;

// ---- 1. 默认白 ----
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
`;

// ---- 2. GitHub ----
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

// ---- 3. 暗夜 ----
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

// ---- 4. 樱花 ----
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

// ---- 5. 薄荷 ----
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

// ---- 6. 咖啡 ----
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

// ---- 7. 水墨 ----
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
.mofa-article hr::before { content: "◆ ◇ ◆"; color: #999; letter-spacing: 8px; }
.mofa-article img { border-radius: 2px; }
`;

// ---- 8. 暖橙 ----
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

// ---- 9. 少数派 ----
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

// ---- 10. 彩虹糖 ----
const rainbowTheme = `
.mofa-article {
    ${baseTypography}
    color: #2d3436;
    background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
    background: #fff;
    padding: 20px;
}
.mofa-article h1 { font-size: 1.6em; background: linear-gradient(90deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.mofa-article h2 { font-size: 1.4em; color: #6c5ce7; border-bottom: 3px solid; border-image: linear-gradient(90deg, #667eea, #764ba2) 1; padding-bottom: 6px; }
.mofa-article h3 { font-size: 1.2em; color: #a855f7; }
.mofa-article blockquote { border-left: 4px solid #a78bfa; color: #7c3aed; padding-left: 16px; background: #f5f3ff; border-radius: 0 8px 8px 0; padding: 12px 16px; }
.mofa-article a { color: #7c3aed; }
.mofa-article code:not(.hljs) { background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; }
.mofa-article strong { color: #5b21b6; }
.mofa-article img { border-radius: 12px; box-shadow: 0 4px 15px rgba(124,58,237,0.15); }
`;
