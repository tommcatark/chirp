package com.chirp.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false, length = 255) private String email;
    @Column(nullable = false) private String passwordHash;
    @Column(nullable = false) private Instant createdAt;
    protected User() {}
    public User(String name, String email, String passwordHash) { this.name = name; this.email = email; this.passwordHash = passwordHash; this.createdAt = Instant.now(); }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
}
