const form = document.querySelector("#forgot-form");
const emailInput = document.querySelector("#email");
const submitButton = form.querySelector(".submit-button");
const submitText = document.querySelector("#submit-text");
const status = document.querySelector("#status");
const emailError = document.querySelector('[data-error="email"]');

const presetEmail = new URLSearchParams(window.location.search).get("email");
if (presetEmail) emailInput.value = presetEmail;
emailInput.focus();

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
      return;
    }
    status.textContent = data.message || "重置链接已发送，请查收邮箱。";
  } catch {
    status.textContent = "暂时无法连接服务器，请稍后重试。";
  } finally {
    submitButton.disabled = false;
    submitText.textContent = "重新发送重置链接";
  }
});
