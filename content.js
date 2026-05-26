(function () {
  "use strict";

  const STORAGE_KEY = "moekoeCommentsPanelSettings";
  const PANEL_ID = "moekoe-comments-panel-root";
  const BUTTON_ID = "moekoe-comments-panel-jump";
  const DEFAULT_API_BASE_URL = "http://127.0.0.1:6521";
  const DEFAULT_SETTINGS = {
    enabled: true,
    pageSize: 10,
    showAlbumComments: true
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    routeKey: "",
    routeKind: "",
    entityId: "",
    panel: null,
    comments: [],
    totalCount: 0,
    currentPage: 0,
    maxPage: 1,
    emptyTip: "还没有人评论，快来抢沙发吧！",
    isLoading: false,
    isLoadingMore: false,
    errorMessage: "",
    requestSerial: 0,
    abortController: null
  };

  let syncTimer = 0;
  let mountWatchTimer = 0;
  let pendingSyncRetries = 0;

  async function init() {
    if (isExcludedRoute()) return;

    state.settings = await readSettings();
    bindEvents();
    startMountWatch();
    scheduleSync(true, 0);
  }

  function bindEvents() {
    window.addEventListener("hashchange", () => scheduleSync(false, 0));
    window.addEventListener("popstate", () => scheduleSync(false, 0));

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) return;
      state.settings = normalizeSettings(changes[STORAGE_KEY].newValue);
      scheduleSync(true, 0);
    });
  }

  function startMountWatch() {
    if (mountWatchTimer) return;

    mountWatchTimer = window.setInterval(() => {
      if (isExcludedRoute()) return;

      const context = getRouteContext();
      if (!context || !state.settings.enabled) {
        if (state.routeKey) clearPageArtifacts();
        return;
      }

      if (context.kind === "album" && !state.settings.showAlbumComments) {
        clearPageArtifacts();
        return;
      }

      const detailPage = document.querySelector(".detail-page");
      if (!detailPage) return;

      if (context.routeKey !== state.routeKey) {
        scheduleSync(false, 0);
        return;
      }

      ensureJumpButton(detailPage);
      ensurePanel(detailPage);

      if (!state.panel?.innerHTML.trim()) {
        render();
      }
    }, 500);
  }

  function isExcludedRoute() {
    return /^#\/?(lyrics|video)(?:[/?]|$)/i.test(window.location.hash || "");
  }

  function scheduleSync(forceReload, retries) {
    clearTimeout(syncTimer);
    pendingSyncRetries = retries;
    syncTimer = window.setTimeout(() => syncPage(forceReload), retries > 0 ? 120 : 0);
  }

  function syncPage(forceReload) {
    const context = getRouteContext();
    reportPageState(context);

    if (!context || !state.settings.enabled) {
      clearPageArtifacts();
      return;
    }

    if (context.kind === "album" && !state.settings.showAlbumComments) {
      clearPageArtifacts();
      return;
    }

    const detailPage = document.querySelector(".detail-page");
    if (!detailPage) {
      if (pendingSyncRetries < 60) {
        scheduleSync(forceReload, pendingSyncRetries + 1);
      }
      return;
    }

    pendingSyncRetries = 0;
    ensureJumpButton(detailPage);
    ensurePanel(detailPage);

    if (forceReload || context.routeKey !== state.routeKey) {
      state.routeKey = context.routeKey;
      state.routeKind = context.kind;
      state.entityId = context.id;
      resetData();
      render();
      loadComments(1, true);
      return;
    }

    render();
  }

  function getRouteContext() {
    const rawHash = window.location.hash || "";
    const hash = rawHash.replace(/^#/, "");
    const [pathPart, queryPart = ""] = hash.split("?");
    const path = (pathPart || "").toLowerCase();

    if (path !== "/playlistdetail") return null;

    const params = new URLSearchParams(queryPart);
    const singerId = (params.get("singerid") || "").trim();
    const albumId = (params.get("albumid") || "").trim();
    const collectionId = (params.get("global_collection_id") || "").trim();

    if (singerId) return null;

    if (albumId) {
      return {
        kind: "album",
        id: albumId,
        routeKey: `album:${albumId}`
      };
    }

    if (collectionId) {
      return {
        kind: "playlist",
        id: collectionId,
        routeKey: `playlist:${collectionId}`
      };
    }

    return null;
  }

  function ensureJumpButton(detailPage) {
    const actions = detailPage.querySelector(".actions");
    if (!actions) return;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.className = "mkc-comment-jump-btn";
      button.textContent = "看评论";
      button.addEventListener("click", handleJumpClick);
    }

    if (button.parentElement !== actions) {
      actions.appendChild(button);
    }
  }

  function handleJumpClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function ensurePanel(detailPage) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.addEventListener("click", handlePanelClick);
    }

    const noteContainer = detailPage.querySelector(".note-container");
    if (panel.parentElement !== detailPage) {
      if (noteContainer) {
        detailPage.insertBefore(panel, noteContainer);
      } else {
        detailPage.appendChild(panel);
      }
    }

    state.panel = panel;
  }

  function handlePanelClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;

    const action = actionTarget.getAttribute("data-action");
    if (action !== "load-more") return;

    event.preventDefault();
    event.stopPropagation();

    if (state.isLoading || state.isLoadingMore || state.currentPage >= state.maxPage) {
      return;
    }

    loadComments(state.currentPage + 1, false);
    render();
  }

  function clearPageArtifacts() {
    cancelPendingRequest();
    state.routeKey = "";
    state.routeKind = "";
    state.entityId = "";
    resetData();

    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();

    const button = document.getElementById(BUTTON_ID);
    if (button) button.remove();

    state.panel = null;
  }

  function resetData() {
    state.comments = [];
    state.totalCount = 0;
    state.currentPage = 0;
    state.maxPage = 1;
    state.emptyTip = "还没有人评论，快来抢沙发吧！";
    state.errorMessage = "";
    state.isLoading = false;
    state.isLoadingMore = false;
  }

  async function loadComments(page, replace) {
    cancelPendingRequest();

    const currentRequest = ++state.requestSerial;
    const controller = new AbortController();
    state.abortController = controller;
    state.isLoading = replace;
    state.isLoadingMore = !replace;
    state.errorMessage = "";

    try {
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams({
        id: state.entityId,
        page: String(page),
        pagesize: String(state.settings.pageSize),
        show_classify: "0",
        show_hotword_list: "0"
      });

      const endpoint = state.routeKind === "album" ? "/comment/album" : "/comment/playlist";
      const response = await fetch(`${joinUrl(baseUrl, endpoint)}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (currentRequest !== state.requestSerial || !isStillOnSameRoute()) return;

      const normalized = normalizeResponse(data, page);
      if (replace) {
        state.comments = normalized.comments;
      } else {
        const existingIds = new Set(state.comments.map((item) => item.id));
        state.comments = state.comments.concat(
          normalized.comments.filter((item) => !existingIds.has(item.id))
        );
      }

      state.totalCount = normalized.totalCount;
      state.currentPage = normalized.currentPage;
      state.maxPage = normalized.maxPage;
      state.emptyTip = normalized.emptyTip;
    } catch (error) {
      if (error?.name !== "AbortError") {
        state.errorMessage = `评论加载失败：${error.message || String(error)}`;
      }
    } finally {
      if (currentRequest === state.requestSerial) {
        state.isLoading = false;
        state.isLoadingMore = false;
        state.abortController = null;
        render();
      }
    }
  }

  function isStillOnSameRoute() {
    const context = getRouteContext();
    return Boolean(context) && context.routeKey === state.routeKey;
  }

  function normalizeResponse(data, fallbackPage) {
    const list = Array.isArray(data?.list) ? data.list : [];
    const totalCount = toNumber(data?.count);
    const currentPage = toNumber(data?.current_page) || fallbackPage || 1;
    const maxPage = Math.max(1, toNumber(data?.maxPage) || Math.ceil(totalCount / state.settings.pageSize) || 1);

    return {
      comments: list.map(mapComment),
      totalCount,
      currentPage,
      maxPage,
      emptyTip: data?.config?.emptyTip || "还没有人评论，快来抢沙发吧！"
    };
  }

  function mapComment(item, index) {
    return {
      id: String(item?.id || `${item?.user_id || "user"}-${index}`),
      userName: item?.user_name || "匿名用户",
      avatar: item?.user_pic || "",
      content: item?.content || "",
      time: item?.addtime || "",
      location: item?.location || parseCity(item?.extdata),
      likes: toNumber(item?.like?.count ?? item?.like?.likenum),
      replies: toNumber(item?.reply_num ?? item?.comments_num),
      badge: getBadgeLabel(item),
      initial: getInitial(item?.user_name),
      highlight: index === 0
    };
  }

  function getBadgeLabel(item) {
    const medals = Array.isArray(item?.udetails) ? item.udetails : [];
    const badgeFromList = medals.find((medal) => medal?.word_v3)?.word_v3;
    if (badgeFromList) return badgeFromList;

    const medalName = item?.udetail?.medal_2nd_classify_name;
    if (typeof medalName === "string" && medalName.trim()) {
      return `勋章 Lv.${medalName.trim()}`;
    }

    return "";
  }

  function parseCity(extdata) {
    if (!extdata || typeof extdata !== "string") return "";
    try {
      const parsed = JSON.parse(extdata);
      return parsed?.city || "";
    } catch {
      return "";
    }
  }

  function render() {
    if (!state.panel) return;

    const loadMoreDisabled = state.isLoading ||
      state.isLoadingMore ||
      Boolean(state.errorMessage) ||
      state.currentPage <= 0 ||
      state.currentPage >= state.maxPage;

    const pageText = state.currentPage > 0
      ? `第 ${state.currentPage} / ${state.maxPage} 页`
      : "等待加载";

    const loadMoreText = state.isLoadingMore
      ? "继续加载中..."
      : state.currentPage >= state.maxPage
        ? "没有更多评论了"
        : "加载更多评论";

    state.panel.innerHTML = `
      <div class="mkc-shell">
        <div class="mkc-ambient"></div>
        <div class="mkc-header">
          <h2 class="mkc-title">评论</h2>
          <div class="mkc-kicker">
            <span class="mkc-kicker-count">${formatCount(state.totalCount)} 条</span>
          </div>
        </div>

        ${renderBody()}

        <div class="mkc-footer">
          <div class="mkc-page-state">${pageText}</div>
          <button
            class="mkc-load-more${loadMoreDisabled ? " is-disabled" : ""}"
            data-action="load-more"
            type="button"
            ${loadMoreDisabled ? "disabled" : ""}
          >
            ${loadMoreText}
          </button>
        </div>
      </div>
    `;
  }

  function renderBody() {
    if (state.isLoading) {
      return `
        <div class="mkc-grid is-loading">
          ${Array.from({ length: 3 }, (_, index) => `
            <article class="mkc-card mkc-skeleton ${index === 0 ? " is-hero" : ""}">
              <div class="mkc-skeleton-line short"></div>
              <div class="mkc-skeleton-line"></div>
              <div class="mkc-skeleton-line"></div>
            </article>
          `).join("")}
        </div>
      `;
    }

    if (state.errorMessage) {
      return `
        <div class="mkc-state">
          <div class="mkc-state-title">评论区暂时没接上</div>
          <div class="mkc-state-copy">${escapeHtml(state.errorMessage)}</div>
        </div>
      `;
    }

    if (!state.comments.length) {
      return `
        <div class="mkc-state">
          <div class="mkc-state-title">这里还很安静</div>
          <div class="mkc-state-copy">${escapeHtml(state.emptyTip)}</div>
        </div>
      `;
    }

    return `
      <div class="mkc-grid">
        ${state.comments.map((comment) => `
          <article class="mkc-card${comment.highlight ? " is-hero" : ""}">
            <div class="mkc-card-top">
              <div class="mkc-avatar"${comment.avatar ? ` style="background-image:url('${escapeCssUrl(comment.avatar)}')"` : ""}>
                ${escapeHtml(comment.initial)}
              </div>
              <div class="mkc-meta">
                <div class="mkc-user-row">
                  <span class="mkc-user">${escapeHtml(comment.userName)}</span>
                  ${comment.badge ? `<span class="mkc-badge">${escapeHtml(comment.badge)}</span>` : ""}
                </div>
                <div class="mkc-submeta">
                  ${comment.time ? `<span>${escapeHtml(comment.time)}</span>` : ""}
                  ${comment.location ? `<span>${escapeHtml(comment.location)}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="mkc-content">${escapeHtml(comment.content)}</div>
            <div class="mkc-card-bottom">
              <span>赞 ${formatCount(comment.likes)}</span>
              <span>回复 ${formatCount(comment.replies)}</span>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function reportPageState(context) {
    chrome.runtime.sendMessage({
      type: "comments-panel:report-page",
      payload: {
        title: document.title || "",
        route: window.location.hash || "",
        kind: context?.kind || "",
        entityId: context?.id || ""
      }
    }, () => void chrome.runtime.lastError);
  }

  function getApiBaseUrl() {
    try {
      const settingsRaw = window.localStorage.getItem("settings");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const custom = normalizeApiBaseUrl(settings?.apiBaseUrl);
      return custom || DEFAULT_API_BASE_URL;
    } catch {
      return DEFAULT_API_BASE_URL;
    }
  }

  function normalizeApiBaseUrl(input) {
    const raw = (input ?? "").toString().trim();
    if (!raw) return "";

    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return raw.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function joinUrl(baseUrl, path) {
    const base = (baseUrl || "").replace(/\/+$/, "");
    const rel = (path || "").replace(/^\/+/, "");
    return rel ? `${base}/${rel}` : base;
  }

  function cancelPendingRequest() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
  }

  async function readSettings() {
    const data = await storageGet(STORAGE_KEY);
    return normalizeSettings(data[STORAGE_KEY]);
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

  function storageGet(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => resolve(result || {}));
    });
  }

  function toNumber(value) {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  function formatCount(value) {
    return toNumber(value).toLocaleString("zh-CN");
  }

  function getInitial(name) {
    const raw = (name || "").trim();
    return raw ? raw.slice(0, 1).toUpperCase() : "M";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeCssUrl(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\)/g, "\\)")
      .replace(/\r?\n/g, "");
  }

  init().catch((error) => {
    console.error("[comments-panel] init failed", error);
  });
})();
