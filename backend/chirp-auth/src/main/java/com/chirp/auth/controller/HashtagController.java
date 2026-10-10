package com.chirp.auth.controller;

import com.chirp.auth.repository.PostRepository;
import com.chirp.common.model.Post;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 话题控制器 — 从近期帖子内容中提取 #话题# 并统计热度。
 * <p>
 * GET /api/hashtags/trending：返回近期帖子中出现次数最多的话题。
 * 轻量实现：扫描最近 200 条帖子按出现次数排序，无独立话题表。
 * </p>
 */
@RestController
@RequestMapping("/api/hashtags")
public class HashtagController {
    /** 支持 #话题#（闭合）与 #话题（至空白/结尾）两种写法，话题名 1-30 字符 */
    private static final Pattern TAG_PATTERN = Pattern.compile("#([^#\\s]{1,30})#|#([^#\\s]{1,30})(?=\\s|$)", Pattern.MULTILINE);
    private static final int SCAN_LIMIT = 200;

    private final PostRepository posts;

    public HashtagController(PostRepository posts) {
        this.posts = posts;
    }

    public record TrendingTag(String tag, long postCount) {}

    @GetMapping("/trending")
    public ResponseEntity<?> trending(@RequestParam(defaultValue = "5") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        List<Post> recent = posts.findAllByOrderByCreatedAtDesc(PageRequest.of(0, SCAN_LIMIT)).getContent();

        Map<String, Long> counts = new LinkedHashMap<>();
        for (Post post : recent) {
            // 同一帖子内同一话题只计一次
            Set<String> seen = new HashSet<>();
            Matcher m = TAG_PATTERN.matcher(post.getContent() == null ? "" : post.getContent());
            while (m.find()) {
                String tag = m.group(1) != null ? m.group(1) : m.group(2);
                if (tag != null && seen.add(tag)) {
                    counts.merge(tag, 1L, Long::sum);
                }
            }
        }

        List<TrendingTag> items = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(safeLimit)
                .map(e -> new TrendingTag(e.getKey(), e.getValue()))
                .toList();
        return ResponseEntity.ok(items);
    }
}
