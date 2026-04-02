/**
 * 微信公众号 API 封装
 * 
 * 图片上传的 multipart 构建方式直接复用 note-to-mp 的实现
 * 参考：https://github.com/sunbooshi/note-to-mp/blob/main/src/weixin-api.ts (MIT License)
 * 
 * 已认证订阅号可用接口：
 * - 获取 access_token
 * - 上传图文消息内图片 (uploadimg)
 * - 新增永久素材 (add_material)
 * - 新增草稿 (draft/add)
 * - 获取素材列表 (batchget_material)
 */

import { requestUrl, RequestUrlParam, getBlobArrayBuffer, Notice } from 'obsidian';

const WECHAT_API_BASE = 'https://api.weixin.qq.com';

// ============================================================
// 接口类型定义（复用 note-to-mp 的 DraftArticle 结构）
// ============================================================

export interface DraftArticle {
    title: string;
    author?: string;
    digest?: string;
    content: string;
    content_source_url?: string;
    thumb_media_id: string;
    need_open_comment?: number;
    only_fans_can_comment?: number;
    pic_crop_235_1?: string;
    pic_crop_1_1?: string;
}

export interface UploadResult {
    url: string;
    media_id: string;
    errcode: number;
    errmsg: string;
}

// ============================================================
// 常见错误码中文映射
// ============================================================

const ERROR_MESSAGES: Record<number, string> = {
    40001: 'AppSecret 错误，请检查设置',
    40002: '请求类型不合法',
    40013: 'AppID 不合法，请检查设置',
    40014: 'access_token 无效，请重试',
    40030: '不合法的图片格式',
    40164: '你的 IP 不在白名单中，请到公众号后台「设置与开发 → 基本配置 → IP白名单」中添加',
    41001: '缺少 access_token',
    42001: 'access_token 已过期，正在自动刷新...',
    45009: 'API 调用频率超出限制，请稍后再试',
    45064: '账号已被封禁',
    48001: '接口未被授权，请检查公众号权限',
};

function getErrorMessage(errcode: number): string {
    return ERROR_MESSAGES[errcode] || `未知错误 (${errcode})`;
}

// ============================================================
// Token 管理
// ============================================================

let cachedToken = '';
let tokenExpiresAt = 0;

/**
 * 获取 access_token（含缓存，2小时有效）
 */
export async function wxGetToken(appId: string, appSecret: string): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const url = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await requestUrl({ url, method: 'GET', throw: false });
    const data = res.json;

    console.log('微信 API 返回:', JSON.stringify(data));

    if (data.errcode) {
        let errMsg = getErrorMessage(data.errcode);

        // 如果是 IP 白名单错误，尝试获取当前 IP 告知用户
        if (data.errcode === 40164) {
            // 微信返回的 errmsg 中包含 IP 地址，格式如 "ip not in whitelist hint: [xxx.xxx.xxx.xxx]"
            const ipMatch = data.errmsg?.match(/\[([^\]]+)\]/);
            const detectedIp = ipMatch ? ipMatch[1] : '未知';
            errMsg = `IP ${detectedIp} 不在白名单中！请到公众号后台「设置与开发 → 基本配置 → IP白名单」添加此 IP`;
        }

        throw new Error(errMsg);
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken;
}

/**
 * 清除 token 缓存
 */
export function wxClearToken() {
    cachedToken = '';
    tokenExpiresAt = 0;
}

// ============================================================
// 图片上传（复用 note-to-mp 的 multipart 构建方式）
// ============================================================

/**
 * 上传图片到微信
 * 
 * @param data - 图片 Blob
 * @param filename - 文件名
 * @param token - access_token
 * @param type - 可选，传 'image' 使用永久素材接口（用于封面）
 */
export async function wxUploadImage(
    data: Blob,
    filename: string,
    token: string,
    type?: string
): Promise<UploadResult> {
    let url = '';
    if (type == null || type === '') {
        url = `${WECHAT_API_BASE}/cgi-bin/media/uploadimg?access_token=${token}`;
    } else {
        url = `${WECHAT_API_BASE}/cgi-bin/material/add_material?access_token=${token}&type=${type}`;
    }

    // note-to-mp 的 multipart 构建方案（实战验证）
    const N = 16;
    const randomBoundaryString =
        'djmangoBoundry' +
        Array(N + 1)
            .join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
            .slice(0, N);

    const pre_string = `------${randomBoundaryString}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: "application/octet-stream"\r\n\r\n`;
    const post_string = `\r\n------${randomBoundaryString}--`;

    const pre_string_encoded = new TextEncoder().encode(pre_string);
    const post_string_encoded = new TextEncoder().encode(post_string);
    const concatenated = await new Blob([
        pre_string_encoded,
        await getBlobArrayBuffer(data),
        post_string_encoded,
    ]).arrayBuffer();

    const options: RequestUrlParam = {
        method: 'POST',
        url: url,
        contentType: `multipart/form-data; boundary=----${randomBoundaryString}`,
        body: concatenated,
    };

    const res = await requestUrl(options);
    const resData = res.json;

    return {
        url: resData.url || '',
        media_id: resData.media_id || '',
        errcode: resData.errcode || 0,
        errmsg: resData.errmsg || '',
    };
}

// ============================================================
// 草稿管理
// ============================================================

function convertArticle(data: DraftArticle) {
    return {
        title: data.title,
        content: data.content,
        digest: data.digest,
        thumb_media_id: data.thumb_media_id,
        ...(data.pic_crop_235_1 && { pic_crop_235_1: data.pic_crop_235_1 }),
        ...(data.pic_crop_1_1 && { pic_crop_1_1: data.pic_crop_1_1 }),
        ...(data.content_source_url && { content_source_url: data.content_source_url }),
        ...(data.need_open_comment !== undefined && { need_open_comment: data.need_open_comment }),
        ...(data.only_fans_can_comment !== undefined && {
            only_fans_can_comment: data.only_fans_can_comment,
        }),
        ...(data.author && { author: data.author }),
    };
}

/**
 * 新建草稿
 */
export async function wxAddDraft(token: string, data: DraftArticle) {
    const url = `${WECHAT_API_BASE}/cgi-bin/draft/add?access_token=${token}`;
    const body = { articles: [convertArticle(data)] };

    const res = await requestUrl({
        method: 'POST',
        url: url,
        throw: false,
        body: JSON.stringify(body),
    });

    return res;
}

/**
 * 获取素材列表（用于获取默认封面）
 */
export async function wxBatchGetMaterial(
    token: string,
    type: string,
    offset: number = 0,
    count: number = 10
) {
    const url = `${WECHAT_API_BASE}/cgi-bin/material/batchget_material?access_token=${token}`;
    const body = { type, offset, count };

    const res = await requestUrl({
        method: 'POST',
        url: url,
        throw: false,
        body: JSON.stringify(body),
    });

    return res.json;
}

/**
 * 测试连接
 */
export async function wxTestConnection(appId: string, appSecret: string): Promise<boolean> {
    try {
        wxClearToken();
        await wxGetToken(appId, appSecret);
        new Notice('✅ 连接成功！公众号配置正确');
        return true;
    } catch (error) {
        new Notice('❌ ' + (error as Error).message);
        return false;
    }
}
