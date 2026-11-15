const form = document.querySelector("#forgot-form");
const emailInput = document.querySelector("#email");
const submitButton = form.querySelector(".submit-button");
const submitText = document.querySelector("#submit-text");
const status = document.querySelector("#status");
const emailError = document.querySelector('[data-error="email"]');

const RESEND_COOLDOWN = 60;
let cooldownUntil = 0;
let cooldownTimer = null;

const presetEmail = new URLSearchParams(window.location.search).get("email");
if (presetEmail) emailInput.value = presetEmail;
emailInput.focus();

function startCooldown() {
  cooldownUntil = Date.now() + RESEND_COOLDOWN * 1000;
  submitButton.disabled = true;
  const render = () => {
    const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    if (left <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      submitButton.disabled = false;
      submitText.textContent = "重新发送重置链接";
      return;
    }
    submitText.textContent = `请 ${left} 秒后再试`;
  };
  render();
  cooldownTimer = setInterval(render, 1000);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  emailError.textContent = "";
  status.textContent = "";

  const email = emailInput.value.trim();
  if (!isValidEmail(email)) {
    emailError.textContent = "请输入有效的邮箱地址";
    return;
  }
  if (cooldownUntil > Date.now()) return;

  submitButton.disabled = true;
  submitText.textContent = "正在发送…";
  try {
    const response = await fetch("http://localhost:8080/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = data.message || "操作失败，请稍后重试。";
      submitButton.disabled = false;
      submitText.textContent = "重新发送重置链接";
      return;
    }
    status.textContent = data.message || "重置链接已发送，请查收邮箱。";
    startCooldown();
  } catch {
    status.textContent = "暂时无法连接服务器，请稍后重试。";
    submitButton.disabled = false;
    submitText.textContent = "重新发送重置链接";
  }
});
