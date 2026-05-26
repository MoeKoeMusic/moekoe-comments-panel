const DEFAULT_SETTINGS = {
  enabled: true,
  pageSize: 10,
  showAlbumComments: true
};

const enabledCheckbox = document.getElementById("enabledCheckbox");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const showAlbumCommentsCheckbox = document.getElementById("showAlbumCommentsCheckbox");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const statusText = document.getElementById("statusText");

let currentSettings = { ...DEFAULT_SETTINGS };

init().catch((error) => {
  setStatus(`初始化失败: ${error.message || String(error)}`, "error");
});

async function init() {
  bindEvents();
  await refreshState();
}

function bindEvents() {
  saveButton.addEventListener("click", saveSettings);
  resetButton.addEventListener("click", resetSettings);
}

async function refreshState() {
  const response = await sendMessage({ type: "comments-panel:get-state" });
  if (!response?.ok) {
    setStatus(response?.message || "读取状态失败", "error");
    return;
  }

  currentSettings = normalizeSettings(response.data?.settings);
  renderSettings();
  setStatus("状态已同步", "success");
}

function renderSettings() {
  enabledCheckbox.checked = currentSettings.enabled;
  pageSizeSelect.value = String(currentSettings.pageSize);
  showAlbumCommentsCheckbox.checked = currentSettings.showAlbumComments;
}

async function saveSettings() {
  const next = normalizeSettings({
    enabled: enabledCheckbox.checked,
    pageSize: Number(pageSizeSelect.value),
    showAlbumComments: showAlbumCommentsCheckbox.checked
  });

  const response = await sendMessage({
    type: "comments-panel:save-settings",
    payload: next
  });

  if (!response?.ok) {
    setStatus(response?.message || "保存失败", "error");
    return;
  }

  currentSettings = normalizeSettings(response.data);
  renderSettings();
  setStatus("保存成功", "success");
}

async function resetSettings() {
  const response = await sendMessage({ type: "comments-panel:reset-settings" });
  if (!response?.ok) {
    setStatus(response?.message || "恢复默认失败", "error");
    return;
  }

  currentSettings = normalizeSettings(response.data);
  renderSettings();
  setStatus("已恢复默认配置", "success");
}

function normalizeSettings(raw) {
  const next = raw && typeof raw === "object" ? raw : {};
  const pageSize = Number(next.pageSize);

  return {
    enabled: typeof next.enabled === "boolean" ? next.enabled : DEFAULT_SETTINGS.enabled,
    pageSize: [10, 20, 30].includes(pageSize) ? pageSize : DEFAULT_SETTINGS.pageSize,
    showAlbumComments: typeof next.showAlbumComments === "boolean"
      ? next.showAlbumComments
      : DEFAULT_SETTINGS.showAlbumComments
  };
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, message: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, message: "No response" });
    });
  });
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = `status ${type}`.trim();
}
