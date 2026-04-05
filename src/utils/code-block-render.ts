export interface CodeBlockRenderOptions {
    showLineNumbers: boolean;
    editorCompatMode: boolean;
}

function splitCodeLines(code: string): string[] {
    const lines = code.split('\n');
    if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }
    return lines.length > 0 ? lines : [''];
}

function buildLegacyCodeLines(code: string, showLineNumbers: boolean): string {
    if (!showLineNumbers) {
        return code;
    }

    return splitCodeLines(code)
        .map((line, index) => `<span class="mofa-line"><span class="mofa-line-number">${index + 1}</span>${line}</span>`)
        .join('\n');
}

function buildEditorCompatCodeLines(code: string, showLineNumbers: boolean): string {
    return splitCodeLines(code)
        .map((line, index) => {
            const lineNumber = showLineNumbers ? `<span class="mofa-code-line-number">${index + 1}</span>` : '';
            const lineContent = line === '' ? '&nbsp;' : line;
            return `<span class="mofa-code-line">${lineNumber}<span class="mofa-code-line-content">${lineContent}</span></span>`;
        })
        .join('');
}

export function buildCodeBlockHtml(code: string, lang: string, options: CodeBlockRenderOptions): string {
    const languageClass = lang ? ` language-${lang}` : '';
    const langLabel = lang ? `<span class="mofa-code-lang">${lang}</span>` : '';

    if (!options.editorCompatMode) {
        const content = buildLegacyCodeLines(code, options.showLineNumbers);
        return `<pre class="mofa-code-block">${langLabel}<code class="hljs${languageClass}">${content}</code></pre>`;
    }

    const codeLines = buildEditorCompatCodeLines(code, options.showLineNumbers);
    const header = langLabel ? `<div class="mofa-code-header">${langLabel}</div>` : '';
    return [
        '<div class="mofa-code-shell">',
        header,
        `<pre class="mofa-code-block mofa-code-block-editor"><code class="hljs${languageClass}">${codeLines}</code></pre>`,
        '</div>',
    ].join('');
}
