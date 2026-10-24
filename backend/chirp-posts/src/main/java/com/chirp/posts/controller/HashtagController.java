package com.chirp.posts.controller;

import com.chirp.posts.repository.PostRepository;
import com.chirp.common.model.Post;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/hashtags")
public class HashtagController {
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