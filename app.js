const STORAGE_KEY = "playnite-reviewer:v1";
const DATA_FILE_NAME = "playnite-review-session.json";
const HLTB_FILE_NAMES = ["htlb.tsv", "HTLB.tsv", "hltb.csv", "HTLB.csv"];
const HLTB_FETCH_TIMEOUT = 6000;
const DROPBOX_APP_KEY = "86fbjrljz7vkqqa";
const DROPBOX_TOKEN_KEY = "playnite-reviewer:dropbox-token";
const DROPBOX_REMOTE_KEY = "playnite-reviewer:dropbox-remote";
const DROPBOX_OAUTH_VERIFIER_KEY = "playnite-reviewer:dropbox-oauth-verifier";
const DROPBOX_OAUTH_STATE_KEY = "playnite-reviewer:dropbox-oauth-state";
const DROPBOX_DATA_PATH = `/${DATA_FILE_NAME}`;
const DROPBOX_OAUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";
const DROPBOX_METADATA_URL = "https://api.dropboxapi.com/2/files/get_metadata";
const DROPBOX_SCOPES = "files.content.read files.content.write files.metadata.read";
const DROPBOX_AUTO_SAVE_DELAY = 900;
const STATUS_OPTIONS = [
  { value: "우선할것", icon: "🔥" },
  { value: "할것", icon: "📚" },
  { value: "깸", icon: "🏆" },
  { value: "또할것", icon: "🔄" },
  { value: "하차", icon: "✋" },
  { value: "Unplayed", icon: "📦" },
  { value: "Never", icon: "🚫" }
];
const HLTB_TIME_TYPES = [
  { key: "main", label: "M", title: "Main Story" },
  { key: "mainExtra", label: "ME", title: "Main + Sides" },
  { key: "completionist", label: "C", title: "Completionist" }
];

const PLAYNITE_POWERSHELL_SCRIPT = String.raw`$PlayniteApi = [Playnite.SDK.API]::Instance

$path = "$env:USERPROFILE\Documents\allgames-reviewed.csv"

if (-not (Test-Path $path)) {
    throw "CSV 파일을 찾을 수 없습니다: $path"
}

$rows = Import-Csv -Path $path -Encoding UTF8

# Playnite 게임 Id 매핑
$gamesById = @{}
foreach ($g in $PlayniteApi.Database.Games) {
    $gamesById[$g.Id.ToString()] = $g
}

# Playnite 완료 상태 이름 매핑
$completionByName = @{}
foreach ($s in $PlayniteApi.Database.CompletionStatuses) {
    $completionByName[$s.Name] = $s
}

Write-Host "Playnite 게임 수: $($gamesById.Count)"
Write-Host "CSV 행 수: $($rows.Count)"
Write-Host "Playnite 완료 상태 목록:"
foreach ($name in $completionByName.Keys) {
    Write-Host " - $name"
}
Write-Host ""

$updatedNotes = 0
$updatedStatus = 0
$skippedBlankMemo = 0
$skippedBlankStatus = 0
$notFoundGame = 0
$notFoundStatus = 0

$PlayniteApi.Database.BeginBufferUpdate()

try {
    foreach ($row in $rows) {
        $id = $row.Id

        if ([string]::IsNullOrWhiteSpace($id)) {
            continue
        }

        if (-not $gamesById.ContainsKey($id)) {
            Write-Host "게임 못 찾음: $($row.'게임 이름') / $id"
            $notFoundGame++
            continue
        }

        $game = $gamesById[$id]

        # 1) 메모 반영
        $memo = $row.'메모'

        if ([string]::IsNullOrWhiteSpace($memo)) {
            $skippedBlankMemo++
        } else {
            $game.Notes = $memo
            $updatedNotes++
        }

        # 2) 완료 상태 반영
        $statusName = $row.'완료 상태'

        if ([string]::IsNullOrWhiteSpace($statusName)) {
            $skippedBlankStatus++
        } else {
            if ($completionByName.ContainsKey($statusName)) {
                $game.CompletionStatusId = $completionByName[$statusName].Id
                $updatedStatus++
            } else {
                Write-Host "완료 상태 못 찾음: $($row.'게임 이름') => $statusName"
                $notFoundStatus++
            }
        }

        # 메모나 완료 상태 중 하나라도 처리 대상이면 업데이트
        $PlayniteApi.Database.Games.Update($game)
    }
}
finally {
    $PlayniteApi.Database.EndBufferUpdate()
}

Write-Host ""
Write-Host "완료"
Write-Host "메모 반영: $updatedNotes"
Write-Host "완료 상태 반영: $updatedStatus"
Write-Host "빈 메모라 건너뜀: $skippedBlankMemo"
Write-Host "빈 완료 상태라 건너뜀: $skippedBlankStatus"
Write-Host "게임 못 찾음: $notFoundGame"
Write-Host "완료 상태 못 찾음: $notFoundStatus"`;

const COLUMN_ALIASES = {
  title: ["게임 이름", "Name", "Title"],
  gameId: ["게임 Id", "Game Id", "GameId"],
  releaseDate: ["출시일", "Release Date", "ReleaseDate"],
  status: ["완료 상태", "완료상태", "Completion Status", "CompletionStatus", "Status"],
  note: ["메모", "Notes", "Note"],
  source: ["소스", "Source"],
  id: ["Id", "ID"]
};

const elements = {
  themeToggleButton: document.querySelector("#themeToggleButton"),
  csvFileInput: document.querySelector("#csvFileInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  copyPowerShellButton: document.querySelector("#copyPowerShellButton"),
  exportNotice: document.querySelector("#exportNotice"),
  totalMetric: document.querySelector("#totalMetric"),
  reviewedMetric: document.querySelector("#reviewedMetric"),
  fileMetric: document.querySelector("#fileMetric"),
  currentCounter: document.querySelector("#currentCounter"),
  progressPercent: document.querySelector("#progressPercent"),
  progressFill: document.querySelector("#progressFill"),
  jumpIndexInput: document.querySelector("#jumpIndexInput"),
  jumpButton: document.querySelector("#jumpButton"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  gameCard: document.querySelector("#gameCard"),
  gameCover: document.querySelector("#gameCover"),
  gamePosition: document.querySelector("#gamePosition"),
  gameTitle: document.querySelector("#gameTitle"),
  googleSearchLink: document.querySelector("#googleSearchLink"),
  releaseDateValue: document.querySelector("#releaseDateValue"),
  sourceValue: document.querySelector("#sourceValue"),
  hltbValue: document.querySelector("#hltbValue"),
  noteInput: document.querySelector("#noteInput"),
  memoCount: document.querySelector("#memoCount"),
  statusCurrent: document.querySelector("#statusCurrent"),
  statusButtons: document.querySelector("#statusButtons"),
  metacriticSearchLink: document.querySelector("#metacriticSearchLink"),
  previousButton: document.querySelector("#previousButton"),
  completeButton: document.querySelector("#completeButton"),
  nextButton: document.querySelector("#nextButton"),
  dropboxConnectButton: document.querySelector("#dropboxConnectButton"),
  dropboxReloadButton: document.querySelector("#dropboxReloadButton"),
  dropboxSaveButton: document.querySelector("#dropboxSaveButton"),
  dropboxDisconnectButton: document.querySelector("#dropboxDisconnectButton"),
  dropboxStatus: document.querySelector("#dropboxStatus"),
  connectionDot: document.querySelector(".connection-dot"),
  toast: document.querySelector("#toast")
};

let state = loadState();
let selectedStatus = "Unplayed";
let hltbByGameId = new Map();
let hltbLoadState = "loading";
let dropboxToken = loadDropboxToken();
let dropboxRemote = loadDropboxRemote();
let dropboxSaveTimer = null;
let dropboxSaveInFlight = false;
let dropboxSaveAgain = false;
let dropboxStatusMessage = "";

initialize();

async function initialize() {
  applyTheme();
  bindEvents();
  renderStatusButtons();
  loadHltbData();
  render();
  await completeDropboxOAuth();
  renderDropboxControls();
  if (isDropboxConnected()) {
    await openDropboxStorage({ silent: true });
  }
  render();
}

async function loadHltbData() {
  try {
    for (const fileName of HLTB_FILE_NAMES) {
      const response = await fetchHltbFile(fileName);
      if (!response.ok) {
        continue;
      }

      hltbByGameId = parseHltbText(await response.text(), fileName);
      hltbLoadState = "ready";
      renderCurrentGame();
      return;
    }

    throw new Error("HLTB 파일을 찾지 못했습니다.");
  } catch (error) {
    console.warn(error);
    hltbByGameId = new Map();
    hltbLoadState = "failed";
  }

  renderCurrentGame();
}

async function fetchHltbFile(fileName) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, HLTB_FETCH_TIMEOUT);

  try {
    return await fetch(fileName, {
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function createDefaultState() {
  return {
    settings: {
      theme: "light"
    },
    fileName: "",
    importedAt: "",
    headers: [],
    rows: [],
    currentIndex: 0,
    reviewedKeys: {}
  };
}

function loadState() {
  const fallback = createDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function normalizeState(value) {
  const fallback = createDefaultState();
  const headers = Array.isArray(value && value.headers) ? value.headers.map(String) : [];
  const rows = Array.isArray(value && value.rows)
    ? value.rows
        .filter((row) => Array.isArray(row))
        .map((row) => headers.map((_, index) => String(row[index] ?? "")))
    : [];
  const currentIndex = Number(value && value.currentIndex);

  return {
    settings: {
      theme: value && value.settings && value.settings.theme === "dark" ? "dark" : "light"
    },
    fileName: String((value && value.fileName) || ""),
    importedAt: String((value && value.importedAt) || ""),
    headers,
    rows,
    currentIndex: rows.length ? clampIndex(Number.isFinite(currentIndex) ? currentIndex : 0, rows.length) : 0,
    reviewedKeys: normalizeReviewedKeys(value && value.reviewedKeys)
  };
}

function normalizeReviewedKeys(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, isReviewed]) => Boolean(isReviewed))
      .map(([key]) => [key, true])
  );
}

function bindEvents() {
  elements.themeToggleButton.addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveState("테마 저장");
  });

  elements.csvFileInput.addEventListener("change", importCsvFile);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.copyPowerShellButton.addEventListener("click", copyPowerShellScript);
  elements.noteInput.addEventListener("input", updateMemoCount);
  elements.jumpButton.addEventListener("click", jumpToTypedIndex);
  elements.jumpIndexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      jumpToTypedIndex();
    }
  });
  elements.searchInput.addEventListener("input", renderSearchResults);
  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToFirstSearchResult();
    }
  });
  elements.previousButton.addEventListener("click", () => moveCurrent(-1));
  elements.nextButton.addEventListener("click", () => moveCurrent(1));
  elements.completeButton.addEventListener("click", commitCurrentAndMove);
  elements.dropboxConnectButton.addEventListener("click", connectDropbox);
  elements.dropboxReloadButton.addEventListener("click", reloadFromDropbox);
  elements.dropboxSaveButton.addEventListener("click", saveDropboxNow);
  elements.dropboxDisconnectButton.addEventListener("click", disconnectDropbox);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) {
      return;
    }

    selectedStatus = normalizeStatus(button.dataset.status);
    syncCurrentFormToState();
    saveState("상태 저장");
    renderMetrics();
    renderStatusButtons();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-index]");
    if (!button) {
      return;
    }

    goToIndex(Number(button.dataset.searchIndex));
  });
}

function applyTheme() {
  const isDark = state.settings.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggleButton.textContent = isDark ? "☀ 라이트모드" : "◐ 다크모드";
  elements.themeToggleButton.setAttribute("aria-pressed", String(isDark));
}

async function importCsvFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    importCsvText(await file.text(), file.name || "allgames.csv");
    showToast("CSV를 불러왔습니다.");
  } catch (error) {
    window.alert(error.message || "CSV 파일을 읽을 수 없습니다.");
  } finally {
    event.target.value = "";
  }
}

function importCsvText(text, fileName) {
  const parsedRows = parseCsvRows(text).filter((row) => row.some((cell) => String(cell).trim()));

  if (parsedRows.length < 2) {
    throw new Error("CSV에 헤더와 게임 행이 필요합니다.");
  }

  const headers = parsedRows[0].map((cell) => stripBom(String(cell).trim()));
  const rows = parsedRows.slice(1).map((row) => normalizeRowLength(row, headers.length));
  const indexes = getColumnIndexes(headers);

  if (indexes.title < 0 || indexes.note < 0 || indexes.status < 0) {
    throw new Error("CSV에서 게임 이름, 메모, 완료 상태 열을 찾지 못했습니다.");
  }

  state = {
    ...createDefaultState(),
    settings: state.settings,
    fileName,
    importedAt: new Date().toISOString(),
    headers,
    rows,
    currentIndex: 0,
    reviewedKeys: {}
  };
  selectedStatus = getCurrentStatus();
  saveState("CSV 불러옴");
  render();
}

function normalizeRowLength(row, length) {
  const next = Array.from({ length }, (_, index) => String(row[index] ?? ""));
  return next;
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function getColumnIndexes(headers = state.headers) {
  return {
    title: findColumnIndex(headers, COLUMN_ALIASES.title),
    gameId: findColumnIndex(headers, COLUMN_ALIASES.gameId),
    releaseDate: findColumnIndex(headers, COLUMN_ALIASES.releaseDate),
    status: findColumnIndex(headers, COLUMN_ALIASES.status),
    note: findColumnIndex(headers, COLUMN_ALIASES.note),
    source: findColumnIndex(headers, COLUMN_ALIASES.source),
    id: findColumnIndex(headers, COLUMN_ALIASES.id)
  };
}

function findColumnIndex(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function normalizeHeader(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function hasCsv() {
  return state.headers.length > 0 && state.rows.length > 0;
}

function getCurrentRow() {
  if (!hasCsv()) {
    return null;
  }

  return state.rows[state.currentIndex] || null;
}

function render() {
  applyTheme();
  renderMetrics();
  renderCurrentGame();
  renderSearchResults();
  renderDropboxControls();
}

function renderMetrics() {
  const total = state.rows.length;
  const current = total ? state.currentIndex + 1 : 0;
  const reviewedCount = getReviewedCount();
  const progress = total ? (reviewedCount / total) * 100 : 0;
  const progressText = total ? `${progress >= 99.95 ? 100 : progress.toFixed(1)}%` : "0%";
  elements.totalMetric.textContent = `${total.toLocaleString("ko-KR")}개`;
  elements.reviewedMetric.textContent = `${reviewedCount.toLocaleString("ko-KR")}개`;
  elements.fileMetric.textContent = state.fileName || "없음";
  elements.currentCounter.textContent = total ? `${reviewedCount} / ${total}` : "-";
  elements.progressPercent.textContent = progressText;
  elements.progressFill.style.width = `${progress}%`;
  elements.exportCsvButton.disabled = !hasCsv();
  elements.jumpIndexInput.disabled = !hasCsv();
  elements.jumpButton.disabled = !hasCsv();
  elements.searchInput.disabled = !hasCsv();
}

function renderCurrentGame() {
  const row = getCurrentRow();
  const indexes = getColumnIndexes();

  elements.gameCard.hidden = !row;

  if (!row) {
    return;
  }

  const title = readCell(row, indexes.title) || "(이름 없음)";
  selectedStatus = getCurrentStatus();

  elements.gamePosition.textContent = `${state.currentIndex + 1}번째 게임`;
  elements.gameTitle.textContent = title;
  elements.releaseDateValue.textContent = readCell(row, indexes.releaseDate) || "-";
  elements.sourceValue.textContent = readCell(row, indexes.source) || "-";
  renderHltbInfo(row, indexes);
  renderGameCover(row, indexes, title);
  elements.googleSearchLink.href = `https://www.google.com/search?q=${encodeURIComponent(title)}`;
  elements.googleSearchLink.setAttribute("aria-label", `${title} 구글 검색`);
  elements.metacriticSearchLink.href = `https://www.google.com/search?q=${encodeURIComponent(`${title} Metacritic reviews`)}&udm=50`;
  elements.metacriticSearchLink.setAttribute("aria-label", `${title} Metacritic reviews 구글 AI mode 검색`);
  elements.noteInput.value = readCell(row, indexes.note);
  updateMemoCount();
  renderStatusButtons();
}

function renderHltbInfo(row, indexes) {
  const gameId = readCell(row, indexes.gameId);
  const hltb = hltbByGameId.get(normalizeGameId(gameId));

  if (!gameId.trim()) {
    renderEmptyHltb("HLTB 없음");
    return;
  }

  if (hltb) {
    elements.hltbValue.classList.remove("is-empty");
    elements.hltbValue.title = hltb.title ? `HowLongToBeat: ${hltb.title}` : "HowLongToBeat";
    elements.hltbValue.innerHTML = HLTB_TIME_TYPES
      .map((type) => `
        <span class="htlb-chip">
          <abbr title="${escapeHtml(type.title)}">${escapeHtml(type.label)}</abbr>
          <strong>${escapeHtml(hltb[type.key] || "-")}</strong>
        </span>
      `)
      .join("");
    return;
  }

  renderEmptyHltb(getHltbEmptyMessage());
}

function renderEmptyHltb(message) {
  elements.hltbValue.classList.add("is-empty");
  elements.hltbValue.removeAttribute("title");
  elements.hltbValue.textContent = message;
}

function getHltbEmptyMessage() {
  if (hltbLoadState === "loading") {
    return "읽는 중";
  }

  if (hltbLoadState === "failed") {
    return "HLTB 파일 없음";
  }

  return "HLTB 없음";
}

function renderStatusButtons() {
  elements.statusCurrent.textContent = selectedStatus;
  elements.statusButtons.innerHTML = STATUS_OPTIONS
    .map((status) => {
      const active = selectedStatus === status.value ? " is-active" : "";
      const pressed = selectedStatus === status.value ? "true" : "false";
      return `
        <button class="status-option${active}" type="button" data-status="${escapeHtml(status.value)}" aria-label="${escapeHtml(status.value)}" aria-pressed="${pressed}" title="${escapeHtml(status.value)}">
          <span class="status-face">
            <span class="status-icon">${status.icon}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderGameCover(row, indexes, title) {
  const source = readCell(row, indexes.source).trim().toLowerCase();
  const gameId = readCell(row, indexes.gameId).trim();
  const steamAppId = source === "steam" && /^\d+$/.test(gameId) ? gameId : "";

  if (steamAppId) {
    elements.gameCover.style.setProperty("--game-image", `url("https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg")`);
    elements.gameCover.textContent = "";
    elements.gameCover.classList.add("has-image");
    elements.gameCover.classList.remove("source-label");
    return;
  }

  const sourceLabel = readCell(row, indexes.source).trim() || "No Source";
  elements.gameCover.style.removeProperty("--game-image");
  elements.gameCover.textContent = sourceLabel;
  elements.gameCover.classList.remove("has-image");
  elements.gameCover.classList.add("source-label");
}

function updateMemoCount() {
  elements.memoCount.textContent = `${elements.noteInput.value.length.toLocaleString("ko-KR")}자`;
}

function readCell(row, index) {
  return index >= 0 ? String(row[index] ?? "") : "";
}

function setCell(row, index, value) {
  if (index >= 0) {
    row[index] = String(value ?? "");
  }
}

function getCurrentStatus() {
  const row = getCurrentRow();
  const indexes = getColumnIndexes();
  return normalizeStatus(row ? readCell(row, indexes.status) : "Unplayed");
}

function normalizeStatus(value) {
  const text = String(value || "").trim();
  const compact = text.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const found = STATUS_OPTIONS.find((status) => {
    const target = status.value.toLowerCase();
    return target === text.toLowerCase() || target === compact.toLowerCase();
  });
  return found ? found.value : "Unplayed";
}

function commitCurrentAndMove() {
  if (!syncCurrentFormToState({ markReviewed: true })) {
    return;
  }

  const wasLast = state.currentIndex === state.rows.length - 1;
  state.currentIndex = nextIndex(state.currentIndex, 1);
  selectedStatus = getCurrentStatus();
  saveState("입력 완료");
  render();
  showToast(wasLast ? "마지막 게임을 저장하고 처음으로 돌아왔습니다." : "저장하고 다음 게임으로 넘어갔습니다.");
}

function syncCurrentFormToState(options = {}) {
  const row = getCurrentRow();
  if (!row) {
    return false;
  }

  const indexes = getColumnIndexes();
  setCell(row, indexes.note, elements.noteInput.value);
  setCell(row, indexes.status, normalizeStatus(selectedStatus));

  if (options.markReviewed) {
    state.reviewedKeys[getRowKey(state.currentIndex)] = true;
  }

  return true;
}

function moveCurrent(direction) {
  if (!hasCsv()) {
    return;
  }

  goToIndex(nextIndex(state.currentIndex, direction));
}

function jumpToTypedIndex() {
  if (!hasCsv()) {
    return;
  }

  const value = Number(elements.jumpIndexInput.value);
  if (!Number.isFinite(value) || value < 1 || value > state.rows.length) {
    window.alert(`1부터 ${state.rows.length} 사이의 번호를 입력해 주세요.`);
    return;
  }

  goToIndex(Math.floor(value) - 1);
}

function goToFirstSearchResult() {
  const results = findSearchResults(elements.searchInput.value);
  if (results.length) {
    goToIndex(results[0].index);
  }
}

function goToIndex(index) {
  if (!hasCsv()) {
    return;
  }

  const next = clampIndex(index, state.rows.length);
  state.currentIndex = next;
  selectedStatus = getCurrentStatus();
  saveState("위치 저장");
  render();
}

function renderSearchResults() {
  if (!hasCsv()) {
    elements.searchResults.textContent = "CSV 임포트 후 사용할 수 있습니다.";
    return;
  }

  const query = elements.searchInput.value.trim();
  if (!query) {
    elements.searchResults.textContent = "제목 일부를 입력하면 결과가 표시됩니다.";
    return;
  }

  const results = findSearchResults(query);
  if (!results.length) {
    elements.searchResults.textContent = "검색 결과가 없습니다.";
    return;
  }

  elements.searchResults.innerHTML = results
    .map((result) => `
      <button class="search-result" type="button" data-search-index="${result.index}">
        <span class="search-result-index">${result.index + 1}</span>
        <span class="search-result-title">${escapeHtml(result.title)}</span>
      </button>
    `)
    .join("");
}

function findSearchResults(query) {
  const text = normalizeSearchText(query);
  if (!text) {
    return [];
  }

  const indexes = getColumnIndexes();
  if (indexes.title < 0) {
    return [];
  }

  return state.rows
    .map((row, index) => ({
      index,
      title: readCell(row, indexes.title)
    }))
    .filter((item) => normalizeSearchText(item.title).includes(text))
    .slice(0, 8);
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function nextIndex(index, direction) {
  if (!state.rows.length) {
    return 0;
  }

  return (index + direction + state.rows.length) % state.rows.length;
}

function clampIndex(index, length) {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}

function getRowKey(index) {
  const indexes = getColumnIndexes();
  const row = state.rows[index];
  const stableId = row ? readCell(row, indexes.id) || readCell(row, indexes.gameId) : "";
  return stableId || String(index);
}

function getReviewedCount() {
  const indexes = getColumnIndexes();
  if (indexes.status < 0) {
    return 0;
  }

  return state.rows.reduce((count, row) => {
    return normalizeStatus(readCell(row, indexes.status)) === "Unplayed" ? count : count + 1;
  }, 0);
}

function saveState(message = "저장됨") {
  persistLocalState();
  queueDropboxSave();
  document.title = message === "저장됨" ? "Playnite 게임 점검" : `Playnite 게임 점검 - ${message}`;
  window.clearTimeout(saveState.timer);
  saveState.timer = window.setTimeout(() => {
    document.title = "Playnite 게임 점검";
  }, 1600);
}

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportCsv() {
  if (!hasCsv()) {
    return;
  }

  syncCurrentFormToState();
  persistLocalState();

  const content = [state.headers, ...state.rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
  downloadFile("allgames-reviewed.csv", content, "text/csv;charset=utf-8");
  showExportNotice("익스포트 완료. allgames-reviewed.csv를 내문서(Documents)폴더에 넣고, 우측 네모 버튼(▣)을 누르세요.");
  showToast("allgames-reviewed.csv를 내보냈습니다.");
}

async function copyPowerShellScript() {
  try {
    await writeClipboardText(PLAYNITE_POWERSHELL_SCRIPT);
    showExportNotice("클립보드에 파워셀용 명령어가 복사되었습니다. 플레이나이트의 내장 파워셀을 켜서 붙여넣으세요");
    showToast("PowerShell 내용이 클립보드에 복사됐습니다.");
  } catch (error) {
    window.alert(error.message || "클립보드에 복사하지 못했습니다.");
  }
}

async function writeClipboardText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("클립보드에 복사하지 못했습니다.");
  }
}

function showExportNotice(message) {
  elements.exportNotice.textContent = message;
  elements.exportNotice.hidden = false;
}

function parseHltbText(text, fileName = "") {
  const rows = parseDelimitedRows(text, detectHltbDelimiter(text, fileName))
    .filter((row) => row.some((cell) => String(cell).trim()));
  const entries = new Map();

  rows.slice(1).forEach((row) => {
    const normalized = normalizeRowLength(row, 6).map((cell) => stripBom(String(cell).trim()));
    const [title, gameId, source, main, mainExtra, completionist] = normalized;
    const hltb = {
      title,
      source,
      main: normalizeHltbTime(main),
      mainExtra: normalizeHltbTime(mainExtra),
      completionist: normalizeHltbTime(completionist)
    };

    if (gameId && hasHltbTime(hltb)) {
      entries.set(normalizeGameId(gameId), hltb);
    }
  });

  return entries;
}

function detectHltbDelimiter(text, fileName) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  if (/\.csv$/i.test(fileName) && commaCount > tabCount) {
    return ",";
  }

  return tabCount >= commaCount ? "\t" : ",";
}

function normalizeGameId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeHltbTime(value) {
  const text = String(value || "").trim();
  if (!text || /^데이터\s*없음$/i.test(text) || /^n\/?a$/i.test(text)) {
    return "";
  }

  return text
    .replace(/\s+시간/g, "시간")
    .replace(/\s+분/g, "분")
    .replace(/\s+/g, " ");
}

function hasHltbTime(value) {
  return Boolean(value.main || value.mainExtra || value.completionist);
}

function parseCsvRows(text) {
  return parseDelimitedRows(text, ",");
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function connectDropbox() {
  if (window.location.protocol === "file:") {
    window.alert("Dropbox 연결은 GitHub Pages나 로컬 서버 주소에서 사용할 수 있습니다.");
    return;
  }

  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const csrfState = createId();
  saveDropboxOAuthDraft(verifier, csrfState);

  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
    redirect_uri: getRedirectUri(),
    scope: DROPBOX_SCOPES,
    state: csrfState
  });

  window.location.href = `${DROPBOX_OAUTH_URL}?${params.toString()}`;
}

async function completeDropboxOAuth() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (!code && !oauthError) {
    return;
  }

  cleanDropboxOAuthUrl(url);

  if (oauthError) {
    setDropboxStatus(`Dropbox 연결 취소: ${oauthError}`);
    return;
  }

  const expectedState = readDropboxOAuthValue(DROPBOX_OAUTH_STATE_KEY, "dropbox_oauth_state");
  const verifier = readDropboxOAuthValue(DROPBOX_OAUTH_VERIFIER_KEY, "dropbox_code_verifier");

  if (!verifier || returnedState !== expectedState) {
    setDropboxStatus("Dropbox 연결 확인 실패. 다시 연결해 주세요.");
    clearDropboxOAuthDraft();
    return;
  }

  try {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: DROPBOX_APP_KEY,
      code_verifier: verifier,
      redirect_uri: getRedirectUri()
    });
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readDropboxJsonResponse(response, "Dropbox 연결에 실패했습니다.");
    if (!token.access_token) {
      throw new Error("Dropbox 연결에 실패했습니다.\n응답에 접근 토큰이 없습니다.");
    }

    dropboxToken = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || "",
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : 0
    };
    localStorage.setItem(DROPBOX_TOKEN_KEY, JSON.stringify(dropboxToken));
    setDropboxStatus("Dropbox 연결됨");
  } catch (error) {
    setDropboxStatus("Dropbox 연결 실패");
    window.alert(error.message);
  } finally {
    clearDropboxOAuthDraft();
  }
}

function saveDropboxOAuthDraft(verifier, stateValue) {
  sessionStorage.setItem("dropbox_code_verifier", verifier);
  sessionStorage.setItem("dropbox_oauth_state", stateValue);
  localStorage.setItem(DROPBOX_OAUTH_VERIFIER_KEY, verifier);
  localStorage.setItem(DROPBOX_OAUTH_STATE_KEY, stateValue);
}

function readDropboxOAuthValue(localKey, legacySessionKey) {
  return sessionStorage.getItem(legacySessionKey) || localStorage.getItem(localKey) || "";
}

function clearDropboxOAuthDraft() {
  sessionStorage.removeItem("dropbox_code_verifier");
  sessionStorage.removeItem("dropbox_oauth_state");
  localStorage.removeItem(DROPBOX_OAUTH_VERIFIER_KEY);
  localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY);
}

function cleanDropboxOAuthUrl(url) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("uid");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, url.toString());
}

async function openDropboxStorage(options = {}) {
  const token = await getDropboxAccessToken({ silent: true });
  if (!token) {
    return;
  }

  try {
    setDropboxStatus("Dropbox에서 불러오는 중...");
    const remote = await downloadDropboxState(token);
    state = normalizeState(remote.value);
    selectedStatus = getCurrentStatus();
    saveDropboxRemote(remote.metadata);
    persistLocalState();
    setDropboxStatus(`Dropbox 사용 중: ${DATA_FILE_NAME}`);
    if (!options.silent) {
      showToast("Dropbox에서 불러왔습니다.");
    }
  } catch (error) {
    if (isDropboxNotFound(error)) {
      await createDropboxStorageFile(token);
      return;
    }

    setDropboxStatus("Dropbox 불러오기 실패");
    if (!options.silent) {
      window.alert(error.message);
    }
  }
}

async function createDropboxStorageFile(token) {
  try {
    const metadata = await uploadDropboxState(token, state, "add");
    saveDropboxRemote(metadata);
    setDropboxStatus(`Dropbox에 새 작업 파일 생성: ${DATA_FILE_NAME}`);
  } catch (error) {
    setDropboxStatus("Dropbox 파일 생성 실패");
    window.alert(error.message);
  }
}

async function reloadFromDropbox() {
  if (!isDropboxConnected()) {
    window.alert("Dropbox를 먼저 연결해 주세요.");
    return;
  }

  if (!window.confirm("Dropbox의 작업 저장본으로 현재 화면을 다시 불러올까요?")) {
    return;
  }

  await openDropboxStorage();
  render();
}

function disconnectDropbox() {
  dropboxToken = null;
  dropboxRemote = null;
  window.clearTimeout(dropboxSaveTimer);
  localStorage.removeItem(DROPBOX_TOKEN_KEY);
  localStorage.removeItem(DROPBOX_REMOTE_KEY);
  setDropboxStatus("Dropbox 연결 해제됨");
  renderDropboxControls();
}

function queueDropboxSave() {
  if (!isDropboxReady()) {
    return;
  }

  window.clearTimeout(dropboxSaveTimer);
  setDropboxStatus("Dropbox 저장 대기 중...");
  dropboxSaveTimer = window.setTimeout(() => {
    saveDropboxNow();
  }, DROPBOX_AUTO_SAVE_DELAY);
}

async function saveDropboxNow() {
  if (!isDropboxConnected()) {
    window.alert("Dropbox를 먼저 연결해 주세요.");
    return;
  }

  if (hasCsv()) {
    syncCurrentFormToState();
    persistLocalState();
  }

  if (!isDropboxReady()) {
    await openDropboxStorage({ silent: true });
    if (!isDropboxReady()) {
      return;
    }
  }

  if (dropboxSaveInFlight) {
    dropboxSaveAgain = true;
    return;
  }

  const token = await getDropboxAccessToken();
  if (!token) {
    return;
  }

  window.clearTimeout(dropboxSaveTimer);
  dropboxSaveInFlight = true;
  dropboxSaveAgain = false;

  try {
    setDropboxStatus("Dropbox에 저장 중...");
    const mode = dropboxRemote && dropboxRemote.rev
      ? { ".tag": "update", update: dropboxRemote.rev }
      : "add";
    const metadata = await uploadDropboxState(token, state, mode);
    saveDropboxRemote(metadata);
    setDropboxStatus(`Dropbox 저장됨: ${DATA_FILE_NAME}`);
    showToast("Dropbox에 저장했습니다.");
  } catch (error) {
    if (isDropboxConflict(error)) {
      setDropboxStatus("Dropbox 파일이 다른 곳에서 바뀜");
      window.alert("Dropbox 작업 파일이 다른 곳에서 먼저 바뀌었습니다.\nDropbox에서 다시 불러온 뒤 수정해 주세요.");
    } else {
      setDropboxStatus("Dropbox 저장 실패");
      window.alert(error.message);
    }
  } finally {
    dropboxSaveInFlight = false;
    if (dropboxSaveAgain) {
      saveDropboxNow();
    }
  }
}

async function downloadDropboxState(token) {
  const response = await fetch(DROPBOX_DOWNLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_DATA_PATH })
    }
  });

  if (!response.ok) {
    throw await createDropboxError(response, "Dropbox에서 불러오지 못했습니다.");
  }

  const text = await response.text();
  const metadata = readDropboxMetadataHeader(response) || await getDropboxMetadata(token);
  return {
    value: JSON.parse(text),
    metadata
  };
}

async function uploadDropboxState(token, value, mode) {
  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: DROPBOX_DATA_PATH,
        mode,
        autorename: false,
        mute: true,
        strict_conflict: true
      })
    },
    body: JSON.stringify(value, null, 2)
  });

  return readDropboxJsonResponse(response, "Dropbox에 저장하지 못했습니다.");
}

async function getDropboxMetadata(token) {
  const response = await fetch(DROPBOX_METADATA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path: DROPBOX_DATA_PATH,
      include_deleted: false,
      include_has_explicit_shared_members: false
    })
  });

  if (!response.ok) {
    throw await createDropboxError(response, "Dropbox 파일 정보를 읽지 못했습니다.");
  }

  return response.json();
}

async function getDropboxAccessToken(options = {}) {
  if (!dropboxToken || (!dropboxToken.accessToken && !dropboxToken.refreshToken)) {
    if (!options.silent) {
      window.alert("Dropbox를 먼저 연결해 주세요.");
    }
    renderDropboxControls();
    return "";
  }

  if (dropboxToken.accessToken && (!dropboxToken.expiresAt || Date.now() < dropboxToken.expiresAt - 60000)) {
    return dropboxToken.accessToken;
  }

  if (!dropboxToken.refreshToken) {
    disconnectDropbox();
    if (!options.silent) {
      window.alert("Dropbox 연결이 만료되었습니다. 다시 연결해 주세요.");
    }
    return "";
  }

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: dropboxToken.refreshToken,
      client_id: DROPBOX_APP_KEY
    });
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readDropboxJsonResponse(response, "Dropbox 연결 갱신에 실패했습니다.");
    if (!token.access_token) {
      throw new Error("Dropbox 연결 갱신에 실패했습니다.\n응답에 접근 토큰이 없습니다.");
    }
    dropboxToken = {
      ...dropboxToken,
      accessToken: token.access_token,
      expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : 0
    };
    localStorage.setItem(DROPBOX_TOKEN_KEY, JSON.stringify(dropboxToken));
    return dropboxToken.accessToken;
  } catch (error) {
    disconnectDropbox();
    if (!options.silent) {
      window.alert(error.message);
    }
    return "";
  }
}

function loadDropboxToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(DROPBOX_TOKEN_KEY) || "{}");
    return saved.accessToken || saved.refreshToken ? saved : null;
  } catch {
    return null;
  }
}

function loadDropboxRemote() {
  try {
    const saved = JSON.parse(localStorage.getItem(DROPBOX_REMOTE_KEY) || "{}");
    return saved.rev ? { path: DROPBOX_DATA_PATH, rev: saved.rev, contentHash: saved.contentHash || "" } : null;
  } catch {
    return null;
  }
}

function saveDropboxRemote(metadata) {
  dropboxRemote = metadata && metadata.rev
    ? {
        path: DROPBOX_DATA_PATH,
        rev: metadata.rev,
        contentHash: metadata.content_hash || ""
      }
    : null;

  if (dropboxRemote) {
    localStorage.setItem(DROPBOX_REMOTE_KEY, JSON.stringify(dropboxRemote));
  } else {
    localStorage.removeItem(DROPBOX_REMOTE_KEY);
  }
}

function isDropboxConnected() {
  return Boolean(dropboxToken && (dropboxToken.accessToken || dropboxToken.refreshToken));
}

function isDropboxReady() {
  return Boolean(isDropboxConnected() && dropboxRemote && dropboxRemote.rev);
}

function renderDropboxControls() {
  const connected = isDropboxConnected();
  const ready = isDropboxReady();

  elements.dropboxConnectButton.textContent = connected ? "Dropbox 다시 연결" : "Dropbox 연결";
  elements.dropboxReloadButton.disabled = !connected;
  elements.dropboxSaveButton.disabled = !connected;
  elements.dropboxDisconnectButton.hidden = !connected;
  elements.connectionDot.classList.toggle("is-connected", connected);

  if (!dropboxStatusMessage) {
    setDropboxStatus(connected
      ? ready ? `Dropbox 연결됨: ${DATA_FILE_NAME}` : "Dropbox 연결됨"
      : "Dropbox 미연결");
  } else {
    elements.dropboxStatus.textContent = dropboxStatusMessage;
  }
}

function setDropboxStatus(message) {
  dropboxStatusMessage = message;
  elements.dropboxStatus.textContent = message;
}

async function readDropboxJsonResponse(response, message) {
  if (response.ok) {
    return response.json();
  }

  throw await createDropboxError(response, message);
}

async function createDropboxError(response, message) {
  let detail = "";
  let summary = "";

  try {
    detail = await response.text();
    const parsed = JSON.parse(detail);
    summary = parsed.error_summary || parsed.error_description || parsed.error || "";
  } catch {
    summary = detail || response.statusText;
  }

  const error = new Error(`${message}\n${summary || response.statusText}`);
  error.status = response.status;
  error.dropboxSummary = summary;
  return error;
}

function readDropboxMetadataHeader(response) {
  const raw = response.headers.get("Dropbox-API-Result");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isDropboxNotFound(error) {
  return error.status === 409 && /not_found/.test(error.dropboxSummary || "");
}

function isDropboxConflict(error) {
  return error.status === 409 && /conflict|malformed_path|path/.test(error.dropboxSummary || "");
}

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function createCodeVerifier() {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
