const STORAGE_KEY = "moekoeCommentsPanelSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  pageSize: 10,
  showAlbumComments: true
};

let latestPageState = {
  title: "",
  route: "",
  kind: "",
  entityId: "",
  updatedAt: 0
};

chrome.runtime.onInstalled.addListener(async () => {
  const saved = await getStorage(STORAGE_KEY);
  await setStorage({
    [STORAGE_KEY]: normalizeSettings(saved[STORAGE_KEY])
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    sendResponse({ ok: false, message: "Invalid message" });
    return;
  }

  switch (message.type) {
    case "comments-panel:get-state":
      handleGetState(sendResponse);
      return true;
    case "comments-panel:save-settings":
      handleSaveSettings(message.payload, sendResponse);
      return true;
    case "comments-panel:reset-settings":
      handleResetSettings(sendResponse);
      return true;
    case "comments-panel:report-page":
      handleReportPage(message.payload, sender, sendResponse);
      return true;
    default:
      sendResponse({ ok: false, message: "Unknown message type" });
  }
});

async function handleGetState(sendResponse) {
  try {
    const saved = await getStorage(STORAGE_KEY);
    sendResponse({
      ok: true,
      data: {
        settings: normalizeSettings(saved[STORAGE_KEY]),
        latestPageState
      }
    });
  } catch (error) {
    sendResponse({ ok: false, message: error.message || String(error) });
  }
}

async function handleSaveSettings(payload, sendResponse) {
  try {
    const settings = normalizeSettings(payload);
    await setStorage({ [STORAGE_KEY]: settings });
    sendResponse({ ok: true, data: settings });
  } catch (error) {
    sendResponse({ ok: false, message: error.message || String(error) });
  }
}

async function handleResetSettings(sendResponse) {
  try {
    await setStorage({ [STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
    sendResponse({ ok: true, data: { ...DEFAULT_SETTINGS } });
  } catch (error) {
    sendResponse({ ok: false, message: error.message || String(error) });
  }
}

function handleReportPage(payload, sender, sendResponse) {
  const pageState = payload && typeof payload === "object" ? payload : {};
  latestPageState = {
    title: typeof pageState.title === "string" ? pageState.title : "",
    route: typeof pageState.route === "string" ? pageState.route : "",
    kind: typeof pageState.kind === "string" ? pageState.kind : "",
    entityId: typeof pageState.entityId === "string" ? pageState.entityId : "",
    updatedAt: Date.now(),
    tabId: typeof sender?.tab?.id === "number" ? sender.tab.id : null
  };

  sendResponse({ ok: true });
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

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result || {}));
  });
}

function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}
