const form = document.querySelector("#auth-form");
const tabs = document.querySelectorAll(".tab");
const registerFields = document.querySelectorAll(".register-only");
const loginOnly = document.querySelector(".login-only");
const title = document.querySelector("#form-title");
const eyebrow = document.querySelector("#form-eyebrow");
const subtitle = document.querySelector("#form-subtitle");
const submitText = document.querySelector("#submit-text");
const status = document.querySelector("#status");
const strengthBox = document.querySelector("#strength");
const strengthText = document.querySelector("#strength-text");
let mode = "login";

function setMode(nextMode) {
  mode = nextMode;
  const register = mode === "register";
  tabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });
  registerFields.forEach((field) => field.classList.toggle("hidden", !register));
  loginOnly.classList.toggle("hidden", register);
  eyebrow.textContent = register ? "JOIN CHIRP" : "WELCOME BACK";
  title.textContent = register ? "创建你的账户" : "欢迎回来";
  subtitle.textContent = register ? "注册鸣 Chirp，发出你的第一声。" : "登录鸣 Chirp，继续发声与共鸣。";
  submitText.textContent = register ? "创建账户" : "登录账户";
  document.querySelector("#password").autocomplete = register ? "new-password" : "current-password";
  status.textContent = "";
  clearErrors();
  updateStrength();
}

function clearErrors() {
  document.querySelectorAll(".error").forEach((item) => item.textContent = "");
}

function error(id, message) {
  document.querySelector(`[data-error="${id}"]`).textContent = message;
  return false;
}

function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value) || (/[a-zA-Z]/.test(value) && /\d/.test(value))) score += 1;
  if (value.length >= 12 || /[^a-zA-Z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
}

function updateStrength() {
  const value = document.querySelector("#password").value;
  const score = passwordScore(value);
  strengthBox.className = mode === "register" ? "strength register-only" : "strength register-only hidden";
  strengthText.textContent = "";
  if (mode !== "register" || !value) return;
  strengthBox.classList.add(`level-${score}`);
  strengthText.textContent = ["太短", "弱", "一般", "强"][score];
}

tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.querySelector(".toggle-password").addEventListener("click", (event) => {
  const input = document.querySelector("#password");
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  event.currentTarget.textContent = visible ? "显示" : "隐藏";
  event.currentTarget.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
});
document.querySelector("#password").addEventListener("input", updateStrength);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  status.textContent = "";
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const name = document.querySelector("#name").value.trim();
  let valid = true;
  if (mode === "register" && name.length < 2) valid = error("name", "请输入至少 2 个字符的昵称") && valid;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid = error("email", "请输入有效的邮箱地址") && valid;
  if (password.length < 8) valid = error("password", "密码至少需要 8 位字符") && valid;
  if (mode === "register" && document.querySelector("#confirm-password").value !== password) valid = error("confirm-password", "两次输入的密码不一致") && valid;
  if (!valid) return;
  status.textContent = "正在提交…";
  try {
    const response = await fetch("http://localhost:8080/api/auth/" + mode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      status.textContent = data.message || "操作失败，请稍后重试。";
      return;
    }
    localStorage.setItem("chirpUser", JSON.stringify(data));
    status.textContent = `${data.message}，欢迎来到鸣 Chirp，${data.name}！你的第一声想说什么？`;
  } catch {
    status.textContent = "暂时无法连接服务器，请确认后端已启动。";
  }
});

document.querySelector("#forgot-link").addEventListener("click", (event) => {
  const email = document.querySelector("#email").value.trim();
  event.currentTarget.href = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? `/forgot-password.html?email=${encodeURIComponent(email)}`
    : "/forgot-password.html";
});
