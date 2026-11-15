/*
 * 传输层密码加密：从后端获取 RSA 公钥，使用 WebCrypto 加密密码后提交 Base64 密文。
 */
import { API_BASE } from "./api.js";

let cachedPublicKey = null;

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchPublicKey() {
  const response = await fetch(`${API_BASE}/api/auth/public-key`, { cache: "no-store" });
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

export async function encryptPassword(plainText) {
  if (!cachedPublicKey) cachedPublicKey = await fetchPublicKey();
  const encoded = new TextEncoder().encode(plainText);
  const cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cachedPublicKey, encoded);
  return bytesToBase64(new Uint8Array(cipher));
}

export function dropCachedPublicKey() {
  cachedPublicKey = null;
}
