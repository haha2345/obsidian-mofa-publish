export interface WechatSanitizeLogger {
    warn?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
}

export function sanitizeForWechat(html: string, logger?: WechatSanitizeLogger): string {
    let sanitized = html;

    sanitized = sanitized.replace(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    sanitized = sanitized.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    sanitized = sanitized.replace(/<a\s+(?:id|name)="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    sanitized = sanitized.replace(/<a\s+(?:id|name)="[^"]*"[^>]*\/>/gi, '');

    sanitized = sanitized.replace(
        /<section([^>]*)>\s*<svg[\s\S]*?<\/svg>\s*<\/section>/gi,
        '<section$1><hr style="border:none;border-top:1px solid #eee;margin:1.5em auto;width:80%;"></section>'
    );
    sanitized = sanitized.replace(/<svg[\s\S]*?<\/svg>/gi, '');

    sanitized = sanitized.replace(/<math[\s\S]*?<\/math>/gi, '');
    sanitized = sanitized.replace(/<semantics[\s\S]*?<\/semantics>/gi, '');
    sanitized = sanitized.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, '');

    sanitized = sanitized.replace(/\n---\n/g, '\n');
    sanitized = sanitized.replace(/^---$/gm, '');

    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '');
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    sanitized = sanitized.replace(/\s+class="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s+data-[a-z-]+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s+aria-[a-z-]+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s+id="[^"]*"/gi, '');
    sanitized = sanitized.replace(/<s>([\s\S]*?)<\/s>/gi, '<span style="text-decoration:line-through;color:#999;">$1</span>');

    // eslint-disable-next-line no-control-regex -- WeChat rejects ASCII control characters in HTML payloads, so we strip them before upload.
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    sanitized = sanitized.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '');
    sanitized = sanitized.replace(/\uFE0E|\uFE0F/g, '');

    sanitized = sanitized.replace(/<img[^>]*\ssrc="([^"]*)"[^>]*>/gi, (match, src) => {
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
            return match;
        }
        logger?.warn?.('[MoFa] 移除未上传的本地图片:', src);
        return '';
    });

    logger?.debug?.('[MoFa] sanitizeForWechat 完成，内容长度:', sanitized.length);
    return sanitized;
}
