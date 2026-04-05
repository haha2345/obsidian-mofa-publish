import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { sanitizeForWechat } from '../src/utils/wechat-sanitize';

test('sanitizeForWechat strips all anchor tags but keeps visible text', () => {
    const html = '<p><a href="https://mp.weixin.qq.com">https://mp.weixin.qq.com</a><a id="fn1" href="#fnref1">回跳</a></p>';

    const result = sanitizeForWechat(html);

    assert.equal(result, '<p>https://mp.weixin.qq.com回跳</p>');
});

test('sanitizeForWechat removes invisible selectors and local images', () => {
    const warnings: string[] = [];
    const html = '<p>↩︎ emoji\uFE0F hidden\u200B dir\u200E bell\x07</p><img src="assets/test.png"><img src="https://mmbiz.qpic.cn/test.png">';

    const result = sanitizeForWechat(html, {
        warn: (...args: unknown[]) => warnings.push(args.map(String).join(' ')),
    });

    assert.equal(result.includes('\uFE0E'), false);
    assert.equal(result.includes('\uFE0F'), false);
    assert.equal(result.includes('\u200B'), false);
    assert.equal(result.includes('\u200E'), false);
    assert.equal(result.includes('\x07'), false);
    assert.equal(result.includes('assets/test.png'), false);
    assert.match(result, /https:\/\/mmbiz\.qpic\.cn\/test\.png/);
    assert.equal(warnings.length, 1);
});
