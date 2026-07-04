const DROPBOX_APP_KEY = "86fbjrljz7vkqqa";
const DROPBOX_DATA_PATH = "/watch-backlog-scheduler/data.json";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";
const TMDB_API_BASE = "https://api.themoviedb.org/3";

const STORAGE_KEYS = {
  state: "watchBacklogScheduler.state.v1",
  tmdbToken: "watchBacklogScheduler.tmdbToken.v1",
  dropboxAuth: "watchBacklogScheduler.dropboxAuth.v1",
  dropboxVerifier: "watchBacklogScheduler.dropboxVerifier.v1",
  dropboxState: "watchBacklogScheduler.dropboxState.v1",
  theme: "watchBacklogScheduler.theme.v1"
};

const WEEKDAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" }
];

const DATE_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DEFAULT_STATE = {
  version: 1,
  schedule: {
    startDate: todayString(),
    rules: [],
    blackouts: []
  },
  backlog: []
};

let state = loadState();
let searchType = "multi";
let searchResults = [];
let searchBusy = false;
let editingRuleId = "";
let quickSaveMessageTimer = 0;

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  bindDom();
  applyTheme(loadTheme());
  bindEvents();
  hydrateInputs();
  renderWeekdayInputs();
  render();
  handleDropboxRedirect();
});

function bindDom() {
  dom.tokenPill = document.getElementById("tokenPill");
  dom.searchQuery = document.getElementById("searchQuery");
  dom.searchButton = document.getElementById("searchButton");
  dom.searchMessage = document.getElementById("searchMessage");
  dom.searchResults = document.getElementById("searchResults");
  dom.backlogList = document.getElementById("backlogList");
  dom.queueMeta = document.getElementById("queueMeta");
  dom.planMeta = document.getElementById("planMeta");
  dom.metricRemaining = document.getElementById("metricRemaining");
  dom.metricFinish = document.getElementById("metricFinish");
  dom.metricDays = document.getElementById("metricDays");
  dom.monthlyList = document.getElementById("monthlyList");
  dom.tmdbTokenInput = document.getElementById("tmdbTokenInput");
  dom.saveTokenButton = document.getElementById("saveTokenButton");
  dom.clearTokenButton = document.getElementById("clearTokenButton");
  dom.startDateInput = document.getElementById("startDateInput");
  dom.ruleStartInput = document.getElementById("ruleStartInput");
  dom.ruleEndInput = document.getElementById("ruleEndInput");
  dom.weekdayInputs = document.getElementById("weekdayInputs");
  dom.saveRuleButton = document.getElementById("saveRuleButton");
  dom.cancelRuleEditButton = document.getElementById("cancelRuleEditButton");
  dom.ruleList = document.getElementById("ruleList");
  dom.settingsMessage = document.getElementById("settingsMessage");
  dom.blackoutStartInput = document.getElementById("blackoutStartInput");
  dom.blackoutEndInput = document.getElementById("blackoutEndInput");
  dom.addBlackoutButton = document.getElementById("addBlackoutButton");
  dom.blackoutList = document.getElementById("blackoutList");
  dom.dropboxConnectButton = document.getElementById("dropboxConnectButton");
  dom.dropboxReconnectButton = document.getElementById("dropboxReconnectButton");
  dom.dropboxLoadButton = document.getElementById("dropboxLoadButton");
  dom.dropboxSaveButton = document.getElementById("dropboxSaveButton");
  dom.quickDropboxSaveButton = document.getElementById("quickDropboxSaveButton");
  dom.quickSaveStatus = document.getElementById("quickSaveStatus");
  dom.dropboxDisconnectButton = document.getElementById("dropboxDisconnectButton");
  dom.dropboxStatus = document.getElementById("dropboxStatus");
  dom.exportJsonButton = document.getElementById("exportJsonButton");
  dom.importJsonInput = document.getElementById("importJsonInput");
  dom.clearQueueButton = document.getElementById("clearQueueButton");
  dom.themeButtons = Array.from(document.querySelectorAll("[data-theme-option]"));
}

function bindEvents() {
  dom.searchButton.addEventListener("click", searchTmdb);
  dom.searchQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchTmdb();
    }
  });

  document.querySelectorAll("[data-search-type]").forEach((button) => {
    button.addEventListener("click", () => {
      searchType = button.dataset.searchType;
      document.querySelectorAll("[data-search-type]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
  });

  dom.searchResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-result]");
    if (!button) return;
    addSearchResult(button.dataset.addResult);
  });

  dom.backlogList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    handleBacklogAction(button.dataset.action, button.dataset.id);
  });

  dom.backlogList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-progress]");
    if (!control) return;
    updateProgress(control);
  });

  dom.saveTokenButton.addEventListener("click", () => {
    const token = normalizeToken(dom.tmdbTokenInput.value);
    if (!token) {
      setMessage(dom.searchMessage, "TMDb API 토큰을 입력하세요", "error");
      return;
    }
    localStorage.setItem(STORAGE_KEYS.tmdbToken, token);
    dom.tmdbTokenInput.value = "";
    setStatus("TMDb 토큰을 저장했습니다.");
    render();
  });

  dom.clearTokenButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.tmdbToken);
    dom.tmdbTokenInput.value = "";
    setStatus("TMDb 토큰을 삭제했습니다.");
    render();
  });

  dom.startDateInput.addEventListener("change", () => {
    state.schedule.startDate = dom.startDateInput.value || todayString();
    persistAndRender();
  });

  dom.saveRuleButton.addEventListener("click", saveRuleFromForm);
  dom.cancelRuleEditButton.addEventListener("click", clearRuleForm);

  dom.ruleList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-rule]");
    if (editButton) {
      editRule(editButton.dataset.editRule);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-rule]");
    if (!deleteButton) return;
    state.schedule.rules = state.schedule.rules.filter((rule) => rule.id !== deleteButton.dataset.deleteRule);
    if (editingRuleId === deleteButton.dataset.deleteRule) {
      clearRuleForm();
    }
    persistAndRender();
  });

  dom.addBlackoutButton.addEventListener("click", addBlackout);

  dom.blackoutList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-blackout]");
    if (!button) return;
    state.schedule.blackouts.splice(Number(button.dataset.removeBlackout), 1);
    persistAndRender();
  });

  dom.dropboxConnectButton.addEventListener("click", () => startDropboxAuth());
  dom.dropboxReconnectButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.dropboxAuth);
    startDropboxAuth();
  });
  dom.dropboxLoadButton.addEventListener("click", loadFromDropbox);
  dom.dropboxSaveButton.addEventListener("click", saveToDropbox);
  dom.quickDropboxSaveButton.addEventListener("click", () => saveToDropbox("quick"));
  dom.dropboxDisconnectButton.addEventListener("click", disconnectDropbox);

  dom.exportJsonButton.addEventListener("click", exportJson);
  dom.importJsonInput.addEventListener("change", importJson);

  dom.clearQueueButton.addEventListener("click", () => {
    if (!state.backlog.length) return;
    if (!window.confirm("목록을 전부 비울까요?")) return;
    state.backlog = [];
    persistAndRender();
  });

  dom.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeOption);
    });
  });
}

function loadTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  if (!dom.themeButtons) return;
  dom.themeButtons.forEach((button) => {
    const active = button.dataset.themeOption === nextTheme;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function hydrateInputs() {
  dom.startDateInput.value = state.schedule.startDate || todayString();
  if (!editingRuleId && !dom.ruleStartInput.value) {
    dom.ruleStartInput.value = state.schedule.startDate || todayString();
  }
}

function render() {
  renderTokenState();
  renderBacklog();
  renderRules();
  renderBlackouts();
  renderDropboxState();
  renderPlan();
}

function renderTokenState() {
  const hasToken = Boolean(getTmdbToken());
  dom.tokenPill.textContent = hasToken ? "TMDb 준비됨" : "TMDb 토큰 필요";
  dom.tokenPill.className = `status-pill ${hasToken ? "ok" : "warn"}`;
  dom.searchButton.disabled = searchBusy;
}

function renderWeekdayInputs() {
  const minutesByDay = editingRuleId
    ? (state.schedule.rules.find((rule) => rule.id === editingRuleId)?.weekdayMinutes || emptyWeekdayMinutes())
    : emptyWeekdayMinutes();

  dom.weekdayInputs.innerHTML = WEEKDAYS.map((day) => {
    const minutes = minutesByDay[day.key] || 0;
    return `
      <label class="weekday-cell">
        <span>${day.label}</span>
        <input data-weekday="${day.key}" type="number" min="0" step="5" value="${minutes}" aria-label="${day.label}요일 시청 가능 분">
      </label>
    `;
  }).join("");
}

function renderSearchResults() {
  if (!searchResults.length) {
    dom.searchResults.innerHTML = "";
    return;
  }

  dom.searchResults.innerHTML = searchResults.map((result) => {
    const poster = posterMarkup(result.posterPath, result.title);
    const typeLabel = result.type === "tv" ? "시리즈" : "영화";
    const year = result.date ? result.date.slice(0, 4) : "연도 없음";
    return `
      <article class="media-row">
        ${poster}
        <div class="media-body">
          <div class="media-title">
            <strong title="${escapeHtml(result.title)}">${escapeHtml(result.title)}</strong>
          </div>
          <div class="media-meta">${typeLabel} · ${year}</div>
          <button class="result-add-button" type="button" data-add-result="${result.key}">추가</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderBacklog() {
  const totalRemaining = state.backlog.reduce((sum, item) => sum + getRemainingMinutes(item), 0);
  dom.queueMeta.textContent = `${state.backlog.length}개 · ${formatMinutes(totalRemaining)}`;

  if (!state.backlog.length) {
    dom.backlogList.innerHTML = `<div class="empty-state">검색해서 시리즈나 영화를 추가하세요.</div>`;
    return;
  }

  dom.backlogList.innerHTML = state.backlog.map((item, index) => {
    const total = item.totalMinutes || 0;
    const watched = getWatchedMinutes(item);
    const remaining = getRemainingMinutes(item);
    const typeLabel = item.type === "tv" ? "시리즈" : "영화";
    const episodeMeta = item.type === "tv"
      ? `<span>${getWatchedEpisodeCount(item)} / ${getTotalEpisodeCount(item)}화</span>`
      : "";
    return `
      <article class="backlog-card">
        ${posterMarkup(item.posterPath, item.title)}
        <div>
          <div class="backlog-title">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="badge">${typeLabel}</span>
          </div>
          <div class="time-line">
            <span>전체 ${formatMinutes(total)}</span>
            <span>봤음 ${formatMinutes(watched)}</span>
            ${episodeMeta}
            <span class="remaining-highlight">남음 ${formatMinutes(remaining)}</span>
          </div>
          ${progressMarkup(item)}
        </div>
        <div class="row-actions" aria-label="${escapeHtml(item.title)} 조작">
          <button class="icon-button" type="button" title="목록 맨 위로" data-action="top" data-id="${item.id}" ${index === 0 ? "disabled" : ""}>↑↑</button>
          <button class="icon-button" type="button" title="위로" data-action="up" data-id="${item.id}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-button" type="button" title="아래로" data-action="down" data-id="${item.id}" ${index === state.backlog.length - 1 ? "disabled" : ""}>↓</button>
          <button class="icon-button danger" type="button" title="삭제" data-action="remove" data-id="${item.id}">×</button>
        </div>
      </article>
    `;
  }).join("");
}

function progressMarkup(item) {
  if (item.type === "movie") {
    const watched = Math.round(item.watchedMinutes || 0);
    return `
      <div class="progress-controls movie-progress">
        <label class="compact-field">
          <span>본 시간(분)</span>
          <input data-progress="movie-minutes" data-id="${item.id}" type="number" min="0" max="${item.totalMinutes}" step="1" value="${watched}">
        </label>
      </div>
    `;
  }

  const totalEpisodes = getTotalEpisodeCount(item);
  const watchedEpisodes = getWatchedEpisodeCount(item);

  return `
    <div class="progress-controls tv-progress">
      <label class="compact-field">
        <span>총 몇 화 봄</span>
        <input data-progress="tv-episodes" data-id="${item.id}" type="number" min="0" max="${totalEpisodes}" step="1" value="${watchedEpisodes}">
      </label>
    </div>
  `;
}

function renderBlackouts() {
  if (!state.schedule.blackouts.length) {
    dom.blackoutList.innerHTML = `<div class="inline-message">등록된 기간 없음</div>`;
    return;
  }

  dom.blackoutList.innerHTML = state.schedule.blackouts.map((period, index) => `
    <div class="blackout-chip">
      <span>${period.start} - ${period.end}</span>
      <button class="icon-button danger" type="button" title="삭제" data-remove-blackout="${index}">×</button>
    </div>
  `).join("");
}

function renderRules() {
  if (!state.schedule.rules.length) {
    dom.ruleList.innerHTML = `<div class="inline-message">등록된 규칙 없음</div>`;
    return;
  }

  dom.ruleList.innerHTML = state.schedule.rules.map((rule, index) => `
    <div class="rule-card">
      <div class="rule-main">
        <span>${escapeHtml(rule.start)} - ${escapeHtml(rule.end || "계속")}</span>
        <strong>${index + 1}. ${escapeHtml(formatRuleMinutes(rule.weekdayMinutes))}</strong>
      </div>
      <div class="row-actions compact-actions">
        <button class="icon-button" type="button" title="수정" data-edit-rule="${rule.id}">✎</button>
        <button class="icon-button danger" type="button" title="삭제" data-delete-rule="${rule.id}">×</button>
      </div>
    </div>
  `).join("");
}

function renderDropboxState() {
  const connected = Boolean(getDropboxAuth());
  dom.dropboxConnectButton.disabled = connected;
  dom.dropboxReconnectButton.disabled = false;
  dom.dropboxLoadButton.disabled = !connected;
  dom.dropboxSaveButton.disabled = !connected;
  dom.quickDropboxSaveButton.disabled = !connected;
  if (!connected) {
    setQuickSaveMessage("");
  }
  dom.dropboxDisconnectButton.disabled = !connected;
  if (!dom.dropboxStatus.textContent) {
    setDropboxMessage(connected ? "Dropbox 연결됨" : "Dropbox 연결 안 됨", connected ? "ok" : "");
  }
}

function renderPlan() {
  const plan = calculatePlan();
  dom.metricRemaining.textContent = formatMinutes(plan.totalRemaining);
  dom.metricFinish.textContent = plan.finishDate || "-";
  dom.metricDays.textContent = plan.calendarDays ? `${plan.calendarDays}일` : "-";
  dom.planMeta.textContent = plan.message || "";

  if (!plan.months.length) {
    dom.monthlyList.innerHTML = `<div class="empty-state">월별 집계 없음</div>`;
  } else {
    dom.monthlyList.innerHTML = plan.months.map((month) => `
      <article class="month-card">
        <div class="month-label">
          <span>${formatMonthLabel(month.month).year}</span>
          <strong>${formatMonthLabel(month.month).month}</strong>
        </div>
        <div class="month-items">
          ${month.items.map((item) => `
            <div class="month-line">
              <span>${escapeHtml(item.title)}</span>
              <strong>${formatMinutes(item.minutes)}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    `).join("");
  }
}

async function searchTmdb() {
  const query = dom.searchQuery.value.trim();
  if (!getTmdbToken()) {
    setMessage(dom.searchMessage, "TMDb API 토큰을 입력하세요", "error");
    renderTokenState();
    return;
  }
  if (!query) {
    setMessage(dom.searchMessage, "검색어를 입력하세요", "error");
    return;
  }

  searchBusy = true;
  renderTokenState();
  setMessage(dom.searchMessage, "검색 중...");
  try {
    const results = await fetchSearchResults(query, searchType);
    searchResults = results.map((item, index) => ({ ...item, key: `${item.type}:${item.tmdbId}:${index}` }));
    setMessage(dom.searchMessage, searchResults.length ? `${searchResults.length}개 찾음` : "검색 결과 없음", searchResults.length ? "ok" : "");
    renderSearchResults();
  } catch (error) {
    setMessage(dom.searchMessage, friendlyError(error), "error");
  } finally {
    searchBusy = false;
    renderTokenState();
  }
}

async function fetchSearchResults(query, type) {
  if (type === "multi") {
    const data = await tmdbFetch("/search/multi", { query, include_adult: "false" });
    return (data.results || [])
      .filter((item) => item.media_type === "tv" || item.media_type === "movie")
      .slice(0, 12)
      .map(normalizeSearchResult);
  }

  const data = await tmdbFetch(`/search/${type}`, { query, include_adult: "false" });
  return (data.results || []).slice(0, 12).map((item) => normalizeSearchResult({ ...item, media_type: type }));
}

function normalizeSearchResult(item) {
  const type = item.media_type === "movie" ? "movie" : "tv";
  return {
    type,
    tmdbId: item.id,
    title: type === "movie" ? item.title : item.name,
    originalTitle: type === "movie" ? item.original_title : item.original_name,
    date: type === "movie" ? item.release_date : item.first_air_date,
    posterPath: item.poster_path || "",
    popularity: item.popularity || 0
  };
}

async function addSearchResult(key) {
  const result = searchResults.find((item) => item.key === key);
  if (!result) return;

  const duplicate = state.backlog.some((item) => item.type === result.type && item.tmdbId === result.tmdbId);
  if (duplicate) {
    setMessage(dom.searchMessage, "이미 목록에 있습니다.", "error");
    return;
  }

  setMessage(dom.searchMessage, "러닝타임을 가져오는 중...");
  try {
    const item = result.type === "tv"
      ? await buildTvItem(result.tmdbId)
      : await buildMovieItem(result.tmdbId);
    state.backlog.push(item);
    persistAndRender();
    setMessage(dom.searchMessage, `${item.title} 추가됨`, "ok");
  } catch (error) {
    setMessage(dom.searchMessage, friendlyError(error), "error");
  }
}

async function buildMovieItem(tmdbId) {
  const details = await tmdbFetch(`/movie/${tmdbId}`, {});
  const runtime = Number(details.runtime) || 0;
  if (!runtime) {
    throw new Error("이 영화의 러닝타임을 찾지 못했습니다.");
  }

  return {
    id: createId("movie"),
    type: "movie",
    tmdbId,
    title: details.title || details.original_title || "제목 없음",
    originalTitle: details.original_title || "",
    year: details.release_date ? details.release_date.slice(0, 4) : "",
    posterPath: details.poster_path || "",
    totalMinutes: runtime,
    watchedMinutes: 0,
    source: {
      runtimeMode: "movie-runtime",
      fetchedAt: new Date().toISOString()
    }
  };
}

async function buildTvItem(tmdbId) {
  const details = await tmdbFetch(`/tv/${tmdbId}`, {});
  const averageRuntime = averageRuntimeFromDetails(details);
  const seasons = (details.seasons || [])
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const seasonDetails = [];
  for (const season of seasons) {
    seasonDetails.push(await tmdbFetch(`/tv/${tmdbId}/season/${season.season_number}`, {}));
  }

  const today = todayString();
  const episodes = [];
  for (const season of seasonDetails) {
    for (const episode of season.episodes || []) {
      const runtime = Number(episode.runtime) || 0;
      const aired = episode.air_date && episode.air_date <= today;
      const effectiveRuntime = runtime || (averageRuntime && aired ? averageRuntime : 0);
      if (!effectiveRuntime) continue;
      episodes.push({
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        name: episode.name || "",
        airDate: episode.air_date || "",
        runtimeMinutes: effectiveRuntime,
        runtimeSource: runtime ? "episode" : "series-average"
      });
    }
  }

  episodes.sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
    return a.episodeNumber - b.episodeNumber;
  });

  const totalMinutes = episodes.reduce((sum, episode) => sum + episode.runtimeMinutes, 0);
  if (!totalMinutes) {
    throw new Error("계산 가능한 에피소드 러닝타임을 찾지 못했습니다.");
  }

  return {
    id: createId("tv"),
    type: "tv",
    tmdbId,
    title: details.name || details.original_name || "제목 없음",
    originalTitle: details.original_name || "",
    year: details.first_air_date ? details.first_air_date.slice(0, 4) : "",
    posterPath: details.poster_path || "",
    totalMinutes,
    averageRuntime,
    episodes,
    watchedThrough: {
      seasonNumber: 0,
      episodeNumber: 0
    },
    watchedEpisodeCount: 0,
    source: {
      runtimeMode: "episode-runtime-with-series-average",
      fetchedAt: new Date().toISOString()
    }
  };
}

async function tmdbFetch(path, params) {
  const token = getTmdbToken();
  if (!token) {
    throw new Error("TMDb API 토큰을 입력하세요");
  }

  const url = new URL(`${TMDB_API_BASE}${path}`);
  url.searchParams.set("language", "ko-KR");
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("TMDb 토큰을 확인하세요.");
    }
    throw new Error(`TMDb 요청 실패: ${response.status}`);
  }
  return response.json();
}

function handleBacklogAction(action, id) {
  const index = state.backlog.findIndex((item) => item.id === id);
  if (index < 0) return;

  if (action === "top" && index > 0) {
    const [item] = state.backlog.splice(index, 1);
    state.backlog.unshift(item);
  } else if (action === "up" && index > 0) {
    [state.backlog[index - 1], state.backlog[index]] = [state.backlog[index], state.backlog[index - 1]];
  } else if (action === "down" && index < state.backlog.length - 1) {
    [state.backlog[index + 1], state.backlog[index]] = [state.backlog[index], state.backlog[index + 1]];
  } else if (action === "remove") {
    state.backlog.splice(index, 1);
  }
  persistAndRender();
}

function updateProgress(control) {
  const item = state.backlog.find((entry) => entry.id === control.dataset.id);
  if (!item) return;

  if (control.dataset.progress === "movie-minutes") {
    item.watchedMinutes = clamp(Number(control.value) || 0, 0, item.totalMinutes || 0);
  }

  if (control.dataset.progress === "tv-episodes") {
    item.watchedEpisodeCount = clamp(Number(control.value) || 0, 0, getTotalEpisodeCount(item));
  }

  persistAndRender();
}

function calculatePlan() {
  const totalRemaining = state.backlog.reduce((sum, item) => sum + getRemainingMinutes(item), 0);
  const empty = {
    totalRemaining,
    finishDate: "",
    calendarDays: 0,
    items: [],
    months: [],
    message: "",
    scheduleEmptyText: "계산할 항목 없음"
  };

  if (!state.backlog.length || totalRemaining <= 0) {
    return empty;
  }

  const hasTime = state.schedule.rules.some((rule) => {
    return Object.values(rule.weekdayMinutes || {}).some((minutes) => minutes > 0);
  });
  if (!hasTime) {
    return {
      ...empty,
      message: "시청 규칙이 없습니다.",
      scheduleEmptyText: "시청 규칙을 추가하면 일정이 계산됩니다."
    };
  }

  const workItems = state.backlog
    .map((item) => ({
      id: item.id,
      title: item.title,
      remaining: getRemainingMinutes(item)
    }))
    .filter((item) => item.remaining > 0);

  const itemPlans = new Map();
  const allocations = [];
  let cursor = 0;
  let date = parseDate(state.schedule.startDate || todayString());
  let guard = 0;

  while (cursor < workItems.length && guard < 20000) {
    const dateKey = formatDate(date);
    let available = isBlackout(dateKey) ? 0 : getAvailableMinutes(date);

    while (available > 0 && cursor < workItems.length) {
      const current = workItems[cursor];
      const minutes = Math.min(available, current.remaining);
      const existing = itemPlans.get(current.id) || {
        id: current.id,
        title: current.title,
        startDate: dateKey,
        endDate: dateKey,
        minutes: 0
      };
      existing.startDate = existing.startDate || dateKey;
      existing.endDate = dateKey;
      existing.minutes += minutes;
      itemPlans.set(current.id, existing);

      allocations.push({
        date: dateKey,
        itemId: current.id,
        title: current.title,
        minutes
      });

      current.remaining -= minutes;
      available -= minutes;
      if (current.remaining <= 0.0001) {
        cursor += 1;
      }
    }

    date = addDays(date, 1);
    guard += 1;
  }

  if (cursor < workItems.length) {
    return {
      ...empty,
      message: "계산 범위를 초과했습니다.",
      scheduleEmptyText: "시청 가능 시간이나 불가 기간을 확인하세요."
    };
  }

  const plans = state.backlog
    .map((item) => itemPlans.get(item.id))
    .filter(Boolean);
  const finishDate = plans.length ? plans[plans.length - 1].endDate : "";
  const calendarDays = finishDate ? daysInclusive(state.schedule.startDate, finishDate) : 0;

  return {
    totalRemaining,
    finishDate,
    calendarDays,
    items: plans,
    months: aggregateMonths(allocations),
    message: "",
    scheduleEmptyText: "계산할 항목 없음"
  };
}

function aggregateMonths(allocations) {
  const monthMap = new Map();
  for (const allocation of allocations) {
    const monthKey = allocation.date.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        itemMap: new Map()
      });
    }
    const month = monthMap.get(monthKey);
    const current = month.itemMap.get(allocation.itemId) || {
      title: allocation.title,
      minutes: 0
    };
    current.minutes += allocation.minutes;
    month.itemMap.set(allocation.itemId, current);
  }

  return Array.from(monthMap.values()).map((month) => ({
    month: month.month,
    items: Array.from(month.itemMap.values())
  }));
}

function getRemainingMinutes(item) {
  return Math.max(0, Math.round((item.totalMinutes || 0) - getWatchedMinutes(item)));
}

function getWatchedMinutes(item) {
  if (item.type === "movie") {
    return clamp(Math.round(item.watchedMinutes || 0), 0, item.totalMinutes || 0);
  }

  const watchedCount = getWatchedEpisodeCount(item);
  return (item.episodes || [])
    .slice(0, watchedCount)
    .reduce((sum, episode) => sum + episode.runtimeMinutes, 0);
}

function getWatchedEpisodeCount(item) {
  if (item.type !== "tv") return 0;
  const total = getTotalEpisodeCount(item);
  if (item.watchedEpisodeCount !== undefined
    && item.watchedEpisodeCount !== null
    && Number.isFinite(Number(item.watchedEpisodeCount))) {
    return clamp(Math.round(Number(item.watchedEpisodeCount)), 0, total);
  }

  const watched = item.watchedThrough || { seasonNumber: 0, episodeNumber: 0 };
  return clamp((item.episodes || []).filter((episode) => {
    return episode.seasonNumber < watched.seasonNumber
      || (episode.seasonNumber === watched.seasonNumber && episode.episodeNumber <= watched.episodeNumber);
  }).length, 0, total);
}

function getTotalEpisodeCount(item) {
  return item.type === "tv" ? (item.episodes || []).length : 0;
}

function averageRuntimeFromDetails(details) {
  const runtimes = (details.episode_run_time || [])
    .map(Number)
    .filter((runtime) => runtime > 0);
  if (!runtimes.length) return 0;
  return Math.round(runtimes.reduce((sum, runtime) => sum + runtime, 0) / runtimes.length);
}

function saveRuleFromForm() {
  const start = dom.ruleStartInput.value || state.schedule.startDate || todayString();
  const end = dom.ruleEndInput.value || "";
  if (end && end < start) {
    setStatus("시청 규칙 종료일은 시작일보다 빠를 수 없습니다.");
    return;
  }

  const weekdayMinutes = readWeekdayInputs();
  if (!Object.values(weekdayMinutes).some((minutes) => minutes > 0)) {
    setStatus("시청 규칙에 1개 이상의 요일 시간을 입력하세요.");
    return;
  }

  if (editingRuleId) {
    const rule = state.schedule.rules.find((item) => item.id === editingRuleId);
    if (rule) {
      rule.start = start;
      rule.end = end;
      rule.weekdayMinutes = weekdayMinutes;
    }
  } else {
    state.schedule.rules.push({
      id: createId("rule"),
      start,
      end,
      weekdayMinutes
    });
  }

  state.schedule.rules.sort((left, right) => left.start.localeCompare(right.start));
  clearRuleForm();
  persistAndRender();
}

function editRule(id) {
  const rule = state.schedule.rules.find((item) => item.id === id);
  if (!rule) return;

  editingRuleId = id;
  dom.ruleStartInput.value = rule.start;
  dom.ruleEndInput.value = rule.end || "";
  renderWeekdayInputs();
  dom.saveRuleButton.textContent = "규칙 수정";
  dom.cancelRuleEditButton.hidden = false;
  dom.ruleStartInput.focus();
}

function clearRuleForm() {
  editingRuleId = "";
  dom.ruleStartInput.value = state.schedule.startDate || todayString();
  dom.ruleEndInput.value = "";
  renderWeekdayInputs();
  dom.saveRuleButton.textContent = "규칙 추가";
  dom.cancelRuleEditButton.hidden = true;
}

function readWeekdayInputs() {
  const minutes = emptyWeekdayMinutes();
  dom.weekdayInputs.querySelectorAll("[data-weekday]").forEach((input) => {
    minutes[input.dataset.weekday] = Math.max(0, Math.round(Number(input.value) || 0));
  });
  return minutes;
}

function addBlackout() {
  const start = dom.blackoutStartInput.value;
  const end = dom.blackoutEndInput.value;
  if (!start || !end) {
    setStatus("시청 불가 기간의 시작일과 종료일을 입력하세요.");
    return;
  }
  const period = start <= end ? { start, end } : { start: end, end: start };
  state.schedule.blackouts.push(period);
  state.schedule.blackouts.sort((a, b) => a.start.localeCompare(b.start));
  dom.blackoutStartInput.value = "";
  dom.blackoutEndInput.value = "";
  persistAndRender();
}

async function startDropboxAuth() {
  const verifier = createVerifier();
  const challenge = await createChallenge(verifier);
  const nonce = createId("dropbox");
  sessionStorage.setItem(STORAGE_KEYS.dropboxVerifier, verifier);
  sessionStorage.setItem(STORAGE_KEYS.dropboxState, nonce);

  const redirectUri = getRedirectUri();
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", DROPBOX_APP_KEY);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", nonce);
  window.location.href = url.toString();
}

async function handleDropboxRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return;

  const returnedState = params.get("state");
  const expectedState = sessionStorage.getItem(STORAGE_KEYS.dropboxState);
  const verifier = sessionStorage.getItem(STORAGE_KEYS.dropboxVerifier);
  if (!expectedState || returnedState !== expectedState || !verifier) {
    setDropboxMessage("Dropbox 연결 상태 확인 실패", "error");
    return;
  }

  setDropboxMessage("Dropbox 연결 처리 중...");
  try {
    const body = new URLSearchParams();
    body.set("code", code);
    body.set("grant_type", "authorization_code");
    body.set("client_id", DROPBOX_APP_KEY);
    body.set("code_verifier", verifier);
    body.set("redirect_uri", getRedirectUri());

    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      throw new Error(`Dropbox 토큰 요청 실패: ${response.status}`);
    }
    const token = await response.json();
    saveDropboxAuth(token);
    sessionStorage.removeItem(STORAGE_KEYS.dropboxVerifier);
    sessionStorage.removeItem(STORAGE_KEYS.dropboxState);
    window.history.replaceState({}, document.title, getRedirectUri());
    setDropboxMessage("Dropbox 연결됨", "ok");
    render();
  } catch (error) {
    setDropboxMessage(friendlyError(error), "error");
  }
}

async function saveToDropbox(source = "panel") {
  const fromQuickButton = source === "quick";
  if (fromQuickButton) {
    setQuickSaveMessage("저장 중...");
  }
  setDropboxMessage("Dropbox에 저장 중...");
  try {
    const token = await getDropboxAccessToken();
    const payload = JSON.stringify(createPortableData(), null, 2);
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: DROPBOX_DATA_PATH,
          mode: "overwrite",
          autorename: false,
          mute: true,
          strict_conflict: false
        })
      },
      body: payload
    });
    if (!response.ok) {
      throw new Error(`Dropbox 저장 실패: ${response.status}`);
    }
    setDropboxMessage("Dropbox에 저장했습니다.", "ok");
    if (fromQuickButton) {
      setQuickSaveMessage("저장됨", "ok", true);
    }
  } catch (error) {
    setDropboxMessage(friendlyError(error), "error");
    if (fromQuickButton) {
      setQuickSaveMessage("저장 실패", "error", true);
    }
  }
}

async function loadFromDropbox() {
  setDropboxMessage("Dropbox에서 불러오는 중...");
  try {
    const token = await getDropboxAccessToken();
    const response = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_DATA_PATH })
      }
    });
    if (response.status === 409) {
      throw new Error("Dropbox 저장 파일이 아직 없습니다.");
    }
    if (!response.ok) {
      throw new Error(`Dropbox 불러오기 실패: ${response.status}`);
    }
    const data = await response.json();
    applyPortableData(data);
    persistAndRender();
    setDropboxMessage("Dropbox에서 불러왔습니다.", "ok");
  } catch (error) {
    setDropboxMessage(friendlyError(error), "error");
  }
}

function disconnectDropbox() {
  localStorage.removeItem(STORAGE_KEYS.dropboxAuth);
  setDropboxMessage("Dropbox 연결을 해제했습니다.");
  render();
}

async function getDropboxAccessToken() {
  const auth = getDropboxAuth();
  if (!auth) {
    throw new Error("Dropbox를 먼저 연결하세요.");
  }
  if (auth.access_token && auth.expires_at && Date.now() < auth.expires_at - 60000) {
    return auth.access_token;
  }
  if (!auth.refresh_token) {
    throw new Error("Dropbox 다시 연결이 필요합니다.");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", auth.refresh_token);
  body.set("client_id", DROPBOX_APP_KEY);
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Dropbox 토큰 갱신 실패: ${response.status}`);
  }
  const token = await response.json();
  const updated = {
    ...auth,
    access_token: token.access_token,
    expires_at: Date.now() + ((token.expires_in || 14400) * 1000)
  };
  localStorage.setItem(STORAGE_KEYS.dropboxAuth, JSON.stringify(updated));
  return updated.access_token;
}

function saveDropboxAuth(token) {
  const auth = {
    access_token: token.access_token,
    refresh_token: token.refresh_token || "",
    token_type: token.token_type || "bearer",
    expires_at: Date.now() + ((token.expires_in || 14400) * 1000)
  };
  localStorage.setItem(STORAGE_KEYS.dropboxAuth, JSON.stringify(auth));
}

function getDropboxAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.dropboxAuth) || "null");
  } catch {
    return null;
  }
}

function createPortableData() {
  return {
    app: "watch-backlog-scheduler",
    version: 1,
    savedAt: new Date().toISOString(),
    state
  };
}

function applyPortableData(data) {
  const incoming = data?.state || data;
  if (!incoming || !incoming.schedule || !Array.isArray(incoming.backlog)) {
    throw new Error("가져올 수 없는 데이터 형식입니다.");
  }
  state = normalizeState(incoming);
  renderWeekdayInputs();
  hydrateInputs();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(createPortableData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `watch-backlog-scheduler-${todayString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    applyPortableData(data);
    persistAndRender();
    setStatus("JSON을 가져왔습니다.");
  } catch (error) {
    setStatus(friendlyError(error));
  } finally {
    event.target.value = "";
  }
}

function getTmdbToken() {
  return localStorage.getItem(STORAGE_KEYS.tmdbToken) || "";
}

function normalizeToken(value) {
  return (value || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function persistAndRender() {
  persistState();
  renderWeekdayInputs();
  hydrateInputs();
  render();
}

function persistState() {
  localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEYS.state) || "null") || DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function normalizeState(input) {
  const base = structuredClone(DEFAULT_STATE);
  const incoming = input || {};
  const schedule = incoming.schedule || {};
  const startDate = schedule.startDate || todayString();
  const rules = normalizeRules(schedule, startDate);

  return {
    version: 1,
    schedule: {
      startDate,
      rules,
      blackouts: Array.isArray(schedule.blackouts) ? schedule.blackouts : []
    },
    backlog: Array.isArray(incoming.backlog) ? incoming.backlog : []
  };
}

function normalizeRules(schedule, fallbackStart) {
  const sourceRules = Array.isArray(schedule.rules) ? schedule.rules : [];
  const normalized = sourceRules
    .map((rule) => ({
      id: rule.id || createId("rule"),
      start: isDateString(rule.start) ? rule.start : fallbackStart,
      end: isDateString(rule.end) ? rule.end : "",
      weekdayMinutes: normalizeWeekdayMinutes(rule.weekdayMinutes)
    }))
    .filter((rule) => rule.start && (!rule.end || rule.end >= rule.start));

  if (normalized.length) {
    return normalized;
  }

  if (schedule.weekdayMinutes) {
    const weekdayMinutes = normalizeWeekdayMinutes(schedule.weekdayMinutes);
    if (Object.values(weekdayMinutes).some((minutes) => minutes > 0)) {
      return [{
        id: createId("rule"),
        start: fallbackStart,
        end: "",
        weekdayMinutes
      }];
    }
  }

  return [];
}

function normalizeWeekdayMinutes(source = {}) {
  const minutes = emptyWeekdayMinutes();
  for (const day of WEEKDAYS) {
    minutes[day.key] = Math.max(0, Math.round(Number(source[day.key]) || 0));
  }
  return minutes;
}

function emptyWeekdayMinutes() {
  return WEEKDAYS.reduce((minutes, day) => {
    minutes[day.key] = 0;
    return minutes;
  }, {});
}

function posterMarkup(path, title) {
  if (!path) {
    return `<div class="poster placeholder" aria-label="${escapeHtml(title)} 포스터 없음">NO</div>`;
  }
  return `<img class="poster" src="${TMDB_IMAGE_BASE}${path}" alt="${escapeHtml(title)} 포스터">`;
}

function setMessage(element, text, type = "") {
  element.textContent = text || "";
  element.className = `inline-message ${type}`.trim();
}

function setDropboxMessage(text, type = "") {
  setMessage(dom.dropboxStatus, text, type);
}

function setQuickSaveMessage(text, type = "", autoClear = false) {
  if (!dom.quickSaveStatus) return;
  window.clearTimeout(quickSaveMessageTimer);
  dom.quickSaveStatus.textContent = text;
  dom.quickSaveStatus.className = `quick-save-status ${type}`.trim();
  if (autoClear && text) {
    quickSaveMessageTimer = window.setTimeout(() => {
      dom.quickSaveStatus.textContent = "";
      dom.quickSaveStatus.className = "quick-save-status";
    }, 2400);
  }
}

function setStatus(text) {
  if (dom.settingsMessage) {
    setMessage(dom.settingsMessage, text);
  }
}

function friendlyError(error) {
  return error?.message || "처리 중 오류가 발생했습니다.";
}

function getAvailableMinutes(date) {
  const dateKey = formatDate(date);
  const key = DATE_DAY_KEYS[date.getDay()];
  const activeRule = [...state.schedule.rules]
    .filter((rule) => rule.start <= dateKey && (!rule.end || dateKey <= rule.end))
    .pop();

  return activeRule ? activeRule.weekdayMinutes[key] || 0 : 0;
}

function isBlackout(dateKey) {
  return state.schedule.blackouts.some((period) => period.start <= dateKey && dateKey <= period.end);
}

function todayString() {
  return formatDate(new Date());
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysInclusive(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  return Math.round((endDate - startDate) / 86400000) + 1;
}

function formatMinutes(value) {
  const minutes = Math.max(0, Math.round(value || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}분`;
  if (!rest) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
}

function formatRuleMinutes(weekdayMinutes = {}) {
  const parts = WEEKDAYS
    .map((day) => {
      const minutes = Math.max(0, Math.round(Number(weekdayMinutes[day.key]) || 0));
      return minutes > 0 ? `${day.label} ${minutes}분` : "";
    })
    .filter(Boolean);

  return parts.length ? parts.join(" ") : "시청 시간 없음";
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-");
  return {
    year: `${year}년`,
    month: `${Number(month)}월`
  };
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createVerifier() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function createChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}
