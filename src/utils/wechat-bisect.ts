export interface BisectGroup<T> {
    start: number;
    end: number;
    items: T[];
}

export function clipPreviewText(text: string, maxLength: number = 48): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength)}...`;
}

export function splitIntoGroups<T>(items: readonly T[], groupCount: number): Array<BisectGroup<T>> {
    if (items.length === 0) {
        return [];
    }

    const normalizedGroupCount = Math.max(1, Math.min(groupCount, items.length));
    const groups: Array<BisectGroup<T>> = [];
    let start = 0;

    for (let i = 0; i < normalizedGroupCount; i++) {
        const remainingItems = items.length - start;
        const remainingGroups = normalizedGroupCount - i;
        const size = Math.ceil(remainingItems / remainingGroups);
        const end = start + size;
        groups.push({
            start,
            end,
            items: items.slice(start, end),
        });
        start = end;
    }

    return groups.filter((group) => group.items.length > 0);
}

export async function deltaDebug<T>(
    items: readonly T[],
    test: (subset: readonly T[]) => Promise<boolean>
): Promise<T[]> {
    let current = [...items];
    if (current.length === 0) {
        return [];
    }

    const fullSetFails = await test(current);
    if (!fullSetFails) {
        return current;
    }

    let granularity = 2;

    while (current.length >= 2) {
        const groups = splitIntoGroups(current, granularity);
        let reduced = false;

        for (const group of groups) {
            if (await test(group.items)) {
                current = [...group.items];
                granularity = Math.max(2, granularity - 1);
                reduced = true;
                break;
            }
        }

        if (reduced) {
            continue;
        }

        for (const group of groups) {
            const complement = current.slice(0, group.start).concat(current.slice(group.end));
            if (complement.length === 0) {
                continue;
            }
            if (await test(complement)) {
                current = complement;
                granularity = Math.max(2, granularity - 1);
                reduced = true;
                break;
            }
        }

        if (reduced) {
            continue;
        }

        if (granularity >= current.length) {
            break;
        }

        granularity = Math.min(current.length, granularity * 2);
    }

    return current;
}
