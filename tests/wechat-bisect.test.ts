import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { clipPreviewText, deltaDebug } from '../src/utils/wechat-bisect';

test('deltaDebug finds a single failing item', async () => {
    const items = ['a', 'b', 'bad', 'c'];

    const result = await deltaDebug(items, async (subset) => subset.includes('bad'));

    assert.deepEqual(result, ['bad']);
});

test('deltaDebug keeps the minimal failing pair when failure needs a combination', async () => {
    const items = ['a', 'trigger-1', 'b', 'trigger-2', 'c'];

    const result = await deltaDebug(items, async (subset) => {
        return subset.includes('trigger-1') && subset.includes('trigger-2');
    });

    assert.deepEqual(result, ['trigger-1', 'trigger-2']);
});

test('clipPreviewText trims whitespace and shortens long text', () => {
    assert.equal(clipPreviewText('  多个   空格\\n和换行  ', 20), '多个 空格\\n和换行');
    assert.equal(clipPreviewText('0123456789abcdef', 10), '0123456789...');
});
