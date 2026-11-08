package com.chirp.posts;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EntityScan("com.chirp.common.model")
@EnableJpaRepositories("com.chirp.posts.repository")
@ComponentScan({"com.chirp.posts", "com.chirp.common"})
public class PostsApplication {
    public static void main(String[] args) {
        SpringApplication.run(PostsApplication.class, args);
    }
}