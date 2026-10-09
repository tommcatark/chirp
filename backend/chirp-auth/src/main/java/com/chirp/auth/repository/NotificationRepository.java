package com.chirp.auth.repository;

import com.chirp.common.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 通知数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.3.5 / §3.3.6：
 * - 按 createdAt 倒序
 * - unreadCount：当前用户全部未读通知数（不受分页影响）
 * - 标记已读：支持按 ids 标记或全部标记
 * </p>
 */
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    long countByUserIdAndIsReadFalse(Long userId);
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    long countByUserId(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId AND n.isRead = false")
    void markAllReadByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id IN :ids AND n.userId = :userId")
    void markReadByIds(@Param("ids") List<Long> ids, @Param("userId") Long userId);
}