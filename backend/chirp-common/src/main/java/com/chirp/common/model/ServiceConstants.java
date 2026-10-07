package com.chirp.common.model;

/**
 * 微服务常量定义 — 集中管理服务名、路由前缀等常量。
 * <p>
 * 新增微服务时，在此处添加对应的 SERVICE_ID 和 ROUTE_PREFIX，
 * 网关路由配置和 Feign Client 均可引用，避免硬编码散落各处。
 * </p>
 */
public final class ServiceConstants {

    /** Nacos 服务发现 ID — 认证服务 */
    public static final String AUTH_SERVICE_ID = "chirp-auth";

    /** Nacos 服务发现 ID — 网关服务（网关自身不注册，仅作常量备用） */
    public static final String GATEWAY_SERVICE_ID = "chirp-gateway";

    /** 认证服务路由前缀（网关以此前缀转发到 chirp-auth） */
    public static final String AUTH_ROUTE_PREFIX = "/api/auth";

    private ServiceConstants() {}
}