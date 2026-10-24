package com.chirp.social.repository;

import com.chirp.common.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("SELECT m FROM Message m WHERE (m.senderId = :a AND m.recipientId = :b) OR (m.senderId = :b AND m.recipientId = :a) ORDER BY m.createdAt DESC")
    Page<Message> findConversation(@Param("a") Long a, @Param("b") Long b, Pageable pageable);

    @Query(value = """
            SELECT m.* FROM messages m
            INNER JOIN (
                SELECT MAX(id) AS max_id FROM messages
                WHERE sender_id = :me OR recipient_id = :me
                GROUP BY CASE WHEN sender_id = :me THEN recipient_id ELSE sender_id END
            ) t ON m.id = t.max_id
            ORDER BY m.created_at DESC
            """, nativeQuery = true)
    List<Message> findLatestPerConversation(@Param("me") Long me);

    @Query(value = "SELECT sender_id, COUNT(*) FROM messages WHERE recipient_id = :me AND is_read = false GROUP BY sender_id", nativeQuery = true)
    List<Object[]> countUnreadPerSender(@Param("me") Long me);

    long countByRecipientIdAndIsReadFalse(Long recipientId);

    @Modifying
    @Transactional
    @Query("UPDATE Message m SET m.isRead = true WHERE m.recipientId = :me AND m.senderId = :other AND m.isRead = false")
    void markConversationRead(@Param("me") Long me, @Param("other") Long other);
}