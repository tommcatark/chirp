package com.chirp.social.controller;

import com.chirp.social.repository.*;
import com.chirp.common.model.*;
import com.chirp.common.security.TokenStoreService;
import com.chirp.common.util.UserUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {
    private static final int MAX_LIMIT = 50;
    private static final int CONTENT_MAX = 500;

    private final MessageRepository messages;
    private final UserRepository users;
    private final TokenStoreService tokenStore;

    public MessageController(MessageRepository messages, UserRepository users, TokenStoreService tokenStore) {
        this.messages = messages;
        this.users = users;
        this.tokenStore = tokenStore;
    }

    @GetMapping("/conversations")
    public ResponseEntity<?> conversations(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long me = requireAuth(authorization);
        if (me == null) return unauthorized();

        Map<Long, Long> unreadBySender = messages.countUnreadPerSender(me).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).longValue()));

        List<MessageDTO.ConversationResponse> items = messages.findLatestPerConversation(me).stream()
                .map(m -> {
                    Long otherId = m.getSenderId().equals(me) ? m.getRecipientId() : m.getSenderId();
                    User other = users.findById(otherId).orElse(null);
                    var userResp = new MessageDTO.ConversationUser(
                            otherId,
                            other != null ? other.getName() : "未知用户",
                            other != null ? UserUtil.handleOf(other.getEmail()) : "unknown",
                            other != null ? other.getAvatarUrl() : null);
                    return new MessageDTO.ConversationResponse(
                            userResp, toResp(m), unreadBySender.getOrDefault(otherId, 0L));
                })
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("totalUnread", unreadBySender.values().stream().mapToLong(Long::longValue).sum());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam("with") Long otherId,
                                  @RequestParam(defaultValue = "0") int offset,
                                  @RequestParam(defaultValue = "30") int limit,
                                  @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long me = requireAuth(authorization);
        if (me == null) return unauthorized();
        if (!users.existsById(otherId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new AuthDTO.ErrorResponse("用户不存在"));
        }
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Page<Message> page = messages.findConversation(me, otherId, PageRequest.of(offset / safeLimit, safeLimit));
        List<MessageDTO.MessageResponse> items = page.getContent().stream().map(this::toResp).toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("total", page.getTotalElements());
        response.put("offset", offset);
        response.put("limit", safeLimit);
        response.put("hasMore", offset + items.size() < page.getTotalElements());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<?> send(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                  @RequestBody(required = false) MessageDTO.SendRequest request) {
        Long me = requireAuth(authorization);
        if (me == null) return unauthorized();
        if (request == null || request.recipientId() == null) {
            return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse("缺少接收者"));
        }
        String content = request.content() == null ? "" : request.content().trim();
        if (content.isEmpty() || content.length() > CONTENT_MAX) {
            return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse("消息内容需为 1-500 字符"));
        }
        if (request.recipientId().equals(me)) {
            return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse("不能给自己发消息"));
        }
        if (!users.existsById(request.recipientId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new AuthDTO.ErrorResponse("用户不存在"));
        }
        Message saved = messages.save(new Message(me, request.recipientId(), content));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResp(saved));
    }

    @PostMapping("/read")
    public ResponseEntity<?> markRead(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                      @RequestBody(required = false) MessageDTO.MarkReadRequest request) {
        Long me = requireAuth(authorization);
        if (me == null) return unauthorized();
        if (request == null || request.with() == null) {
            return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse("缺少会话对象"));
        }
        messages.markConversationRead(me, request.with());
        return ResponseEntity.ok(Map.of("unreadCount", messages.countByRecipientIdAndIsReadFalse(me)));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long me = requireAuth(authorization);
        if (me == null) return unauthorized();
        return ResponseEntity.ok(Map.of("unreadCount", messages.countByRecipientIdAndIsReadFalse(me)));
    }

    private MessageDTO.MessageResponse toResp(Message m) {
        return new MessageDTO.MessageResponse(
                m.getId(), m.getSenderId(), m.getRecipientId(), m.getContent(), m.isRead(), m.getCreatedAt());
    }

    private Long requireAuth(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
    }
}