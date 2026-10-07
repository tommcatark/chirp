/*
 * 传输层密码加密（纵深防御，不能替代 HTTPS）：
 * 1. 从后端获取 RSA-2048 公钥（SPKI，Base64），仅在内存中缓存；
 * 2. 使用浏览器原生 WebCrypto 以 RSA-OAEP + SHA-256 加密密码；
 * 3. 输出 Base64 密文随请求提交，明文密码不会进入网络请求。
 */
const API_ORIGIN = "http://localhost:8080";
let cachedPublicKey = null;

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchPublicKey() {
  const response = await fetch(`${API_ORIGIN}/api/auth/public-key`, { cache: "no-store" });
  if (!response.ok) throw new Error("无法获取加密公钥");
  const data = await response.json();
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(data.publicKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function encryptPassword(plainText) {
  if (!cachedPublicKey) cachedPublicKey = await fetchPublicKey();
  const encoded = new TextEncoder().encode(plainText);
  const cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cachedPublicKey, encoded);
  return bytesToBase64(new Uint8Array(cipher));
}

/* 后端重启后内存中的密钥会轮换：解密失败时调用此方法丢弃缓存，下次提交重新拉取公钥。 */
function dropCachedPublicKey() {
  cachedPublicKey = null;
}
