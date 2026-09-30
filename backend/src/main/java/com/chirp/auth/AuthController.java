package com.chirp.auth;

import com.chirp.user.User;
import com.chirp.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    public AuthController(UserRepository users) { this.users = users; }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("该邮箱已经注册"));
        User user = users.save(new User(request.name().trim(), email, encoder.encode(request.password())));
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(user.getId(), user.getName(), user.getEmail(), "注册成功"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        return users.findByEmailIgnoreCase(request.email().trim())
                .filter(user -> encoder.matches(request.password(), user.getPasswordHash()))
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(new AuthResponse(user.getId(), user.getName(), user.getEmail(), "登录成功")))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("邮箱或密码不正确")));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(new MessageResponse("如果该邮箱已注册，重置密码的链接将发送到你的邮箱。"));
    }

    public record RegisterRequest(@NotBlank @Size(min = 2, max = 120) String name, @NotBlank @Email String email, @NotBlank @Size(min = 8, max = 100) String password) {}
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record ForgotPasswordRequest(@NotBlank @Email String email) {}
    public record AuthResponse(Long id, String name, String email, String message) {}
    public record ErrorResponse(String message) {}
    public record MessageResponse(String message) {}
}
