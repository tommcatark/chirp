package com.chirp.common.model;

import java.util.List;

/**
 * 统一分页响应包装 — 所有列表接口必须使用此格式，不得直接返回裸数组。
 * <p>
 * 规范 §1.5：{items, total, offset, limit, hasMore}
 * - total：符合条件的总条数（不受 limit 限制）
 * - hasMore：等价于 offset + items.length < total
 * - limit 上限 50，超出 50 按 50 处理（不报错）
 * </p>
 */
public record PageResponse<T>(
        List<T> items,
        long total,
        int offset,
        int limit,
        boolean hasMore
) {
    public static <T> PageResponse<T> of(List<T> items, long total, int offset, int limit) {
        return new PageResponse<>(items, total, offset, limit, offset + items.size() < total);
    }
}