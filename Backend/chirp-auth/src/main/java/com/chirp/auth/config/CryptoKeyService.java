package com.chirp.auth.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

/**
 * 传输层密码加密服务 — RSA-2048 密钥对管理。
 * <p>
 * 关键技术：
 * - 服务启动时在内存中生成 RSA-2048 密钥对（@PostConstruct）
 * - 公钥通过 /api/auth/public-key 接口下发给前端
 * - 前端用 RSA-OAEP(SHA-256) 加密密码，后端用私钥解密后再走 BCrypt 校验/入库
 * - 私钥仅存在于服务端内存，每次重启重新生成（前端需重新拉取公钥）
 * </p>
 *
 * 安全说明：
 * - 这是 HTTP 下的纵深防御措施，不能替代 HTTPS
 * - 即使中间人截获密文，没有私钥也无法还原明文密码
 * - 密钥轮换策略：重启即轮换（适合单实例部署；多实例需引入分布式密钥协商）
 */
@Service
public class CryptoKeyService {
    private static final Logger log = LoggerFactory.getLogger(CryptoKeyService.class);

    /** RSA-2048 密钥对，仅在内存中持有，重启后重新生成 */
    private KeyPair keyPair;

    /**
     * 初始化密钥对 — 容器启动后自动调用。
     * 使用 RSA-2048（2048 位模长），兼顾安全性与性能。
     */
    @PostConstruct
    void init() throws GeneralSecurityException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        this.keyPair = generator.generateKeyPair();
        log.info("RSA-2048 传输密钥对已生成（仅存于内存，重启后轮换）");
    }

    /**
     * 获取公钥的 Base64 编码（SPKI DER 格式）。
     * 前端使用 WebCrypto API 的 importKey("spki", base64Decode(publicKey)) 导入。
     */
    public String getPublicKeyBase64() {
        return Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
    }

    /**
     * 解密前端 RSA 密文 — RSA-OAEP(SHA-256) 解密。
     * <p>
     * 关键技术点：
     * - 算法：RSA/ECB/OAEPWithSHA-256AndMGF1Padding
     * - 显式指定 MGF1 也使用 SHA-256，与浏览器 WebCrypto 的 RSA-OAEP(SHA-256) 对齐
     * - 如果 MGF1 默认使用 SHA-1，会导致浏览器密文在 Java 端解密失败
     * </p>
     *
     * @param cipherTextBase64 前端 RSA-OAEP 加密后的 Base64 密文
     * @return 解密后的明文密码
     */
    public String decryptPassword(String cipherTextBase64) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        // 显式指定 MGF1 也使用 SHA-256，与浏览器 WebCrypto 的 RSA-OAEP(SHA-256) 对齐
        OAEPParameterSpec spec = new OAEPParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT);
        cipher.init(Cipher.DECRYPT_MODE, keyPair.getPrivate(), spec);
        byte[] plain = cipher.doFinal(Base64.getDecoder().decode(cipherTextBase64));
        return new String(plain, StandardCharsets.UTF_8);
    }
}