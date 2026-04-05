import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildCodeBlockHtml } from '../src/utils/code-block-render';

test('buildCodeBlockHtml creates editor-compatible code blocks with stable line structure', () => {
    const highlighted = '<span style="color:#61aeee">const</span> a = 1;\n\nreturn a;';

    const html = buildCodeBlockHtml(highlighted, 'typescript', {
        showLineNumbers: true,
        editorCompatMode: true,
    });

    assert.match(html, /<div class="mofa-code-shell">/);
    assert.match(html, /<div class="mofa-code-header">/);
    assert.match(html, /<span class="mofa-code-lang">typescript<\/span>/);
    assert.match(html, /<pre class="mofa-code-block mofa-code-block-editor"><code class="hljs language-typescript">/);
    assert.equal((html.match(/class="mofa-code-line"/g) || []).length, 3);
    assert.equal((html.match(/class="mofa-code-line-number"/g) || []).length, 3);
    assert.match(html, /class="mofa-code-line-content">&nbsp;<\/span>/);
    assert.doesNotMatch(html, /<pre[^>]*>\s*<div/i);
    assert.doesNotMatch(html, /mofa-code-dot/);
    assert.doesNotMatch(html, /mofa-code-dots/);
    assert.doesNotMatch(html, /<section class="mofa-code-shell">/);
    assert.doesNotMatch(html, /<section class="mofa-code-header">/);
});

test('buildCodeBlockHtml keeps legacy structure when editor compatibility mode is disabled', () => {
    const html = buildCodeBlockHtml('const a = 1;\nreturn a;', 'typescript', {
        showLineNumbers: true,
        editorCompatMode: false,
    });

    assert.match(html, /<pre class="mofa-code-block"><span class="mofa-code-lang">typescript<\/span><code class="hljs language-typescript">/);
    assert.equal(html.includes('mofa-code-shell'), false);
});

test('buildCodeBlockHtml keeps multiline layout without line numbers in editor compatibility mode', () => {
    const html = buildCodeBlockHtml('first line\nsecond line', '', {
        showLineNumbers: false,
        editorCompatMode: true,
    });

    assert.equal((html.match(/class="mofa-code-line"/g) || []).length, 2);
    assert.equal(html.includes('mofa-code-line-number'), false);
    assert.equal(html.includes('mofa-code-header'), false);
});
