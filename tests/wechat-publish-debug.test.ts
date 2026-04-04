import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    buildDraftDebugInfo,
    normalizeWechatTitle,
    resolveOriginalDocumentId,
    type DraftRequestPayload,
} from '../src/utils/wechat-publish-debug';

test('resolveOriginalDocumentId returns absolute path when vault base path exists', () => {
    assert.equal(
        resolveOriginalDocumentId('agent相关/文档.md', '/Users/mysterio/Documents/myVault/'),
        '/Users/mysterio/Documents/myVault/agent相关/文档.md'
    );
    assert.equal(resolveOriginalDocumentId('agent相关/文档.md'), 'agent相关/文档.md');
});

test('buildDraftDebugInfo preserves request payload, ids, response and timestamps', () => {
    const requestPayload: DraftRequestPayload = {
        title: '标题',
        author: '作者',
        digest: '摘要',
        content: '<p>正文</p>',
        thumb_media_id: 'thumb-123',
        need_open_comment: 1,
    };

    const debugInfo = buildDraftDebugInfo({
        requestTime: '2026-04-04T14:00:00.000Z',
        responseTime: '2026-04-04T14:00:02.000Z',
        originalDocumentId: '/Users/mysterio/Documents/myVault/agent相关/文档.md',
        requestPayload,
        jsonResponse: { errcode: 45166, errmsg: 'invalid content hint' },
        httpStatus: 200,
    });

    assert.deepEqual(debugInfo.requestPayload, requestPayload);
    assert.equal(debugInfo.originalDocumentId, '/Users/mysterio/Documents/myVault/agent相关/文档.md');
    assert.deepEqual(debugInfo.jsonResponse, { errcode: 45166, errmsg: 'invalid content hint' });
    assert.equal(debugInfo.requestTime, '2026-04-04T14:00:00.000Z');
    assert.equal(debugInfo.responseTime, '2026-04-04T14:00:02.000Z');
    assert.equal(debugInfo.httpStatus, 200);
});

test('normalizeWechatTitle keeps short titles unchanged', () => {
    assert.equal(normalizeWechatTitle('短标题'), '短标题');
    assert.equal(normalizeWechatTitle('OpenWrt AX6000 教程'), 'OpenWrt AX6000 教程');
});

test('normalizeWechatTitle truncates long mixed titles to 64 UTF-8 bytes', () => {
    const source = '【教程】保姆级红米 AX6000 刷 UBoot 和 OpenWrt 固件_红米 ax6000 刷 openwrt-CSDN 博客';
    const normalized = normalizeWechatTitle(source);

    assert.ok(Buffer.byteLength(normalized, 'utf8') <= 64);
    assert.notEqual(normalized, source);
    assert.ok(normalized.endsWith('...'));
});
