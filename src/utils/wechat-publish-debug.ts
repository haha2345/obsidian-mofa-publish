export interface DraftRequestPayload {
    title: string;
    author: string;
    digest: string;
    content: string;
    thumb_media_id: string;
    need_open_comment: 0 | 1;
}

export interface DraftDebugInfo<TResponse = unknown> {
    requestTime: string;
    responseTime: string;
    originalDocumentId: string;
    requestPayload: DraftRequestPayload;
    jsonResponse: TResponse;
    httpStatus: number;
}

const WECHAT_TITLE_MAX_BYTES = 64;

export function resolveOriginalDocumentId(filePath: string, vaultBasePath?: string): string {
    if (!vaultBasePath) {
        return filePath;
    }

    const normalizedBasePath = vaultBasePath.replace(/[\\/]+$/, '');
    const normalizedFilePath = filePath.replace(/^[\\/]+/, '');
    return `${normalizedBasePath}/${normalizedFilePath}`;
}

export function buildDraftDebugInfo<TResponse>(params: DraftDebugInfo<TResponse>): DraftDebugInfo<TResponse> {
    return { ...params };
}

export function normalizeWechatTitle(title: string, maxBytes: number = WECHAT_TITLE_MAX_BYTES): string {
    if (Buffer.byteLength(title, 'utf8') <= maxBytes) {
        return title;
    }

    const suffix = '...';
    const suffixBytes = Buffer.byteLength(suffix, 'utf8');
    let result = '';

    for (const char of title) {
        const next = result + char;
        if (Buffer.byteLength(next, 'utf8') + suffixBytes > maxBytes) {
            break;
        }
        result = next;
    }

    return result ? `${result}${suffix}` : title.slice(0, 1);
}
