const STORAGE_KEY = "quiet-watch-room-v1";
const PROGRESS_KEY = "quiet-watch-progress-v1";
const XP_REWARD = 25;

const form = document.querySelector("#add-form");
const urlInput = document.querySelector("#video-url");
const titleInput = document.querySelector("#video-title");
const message = document.querySelector("#form-message");
const playerHost = document.querySelector("#player-host");
const emptyState = document.querySelector("#empty-state");
const nowTitle = document.querySelector("#now-title");
const queue = document.querySelector("#queue");
const queueEmpty = document.querySelector("#queue-empty");
const queueCount = document.querySelector("#queue-count");
const clearButton = document.querySelector("#clear-button");
const focusButton = document.querySelector("#focus-button");
const template = document.querySelector("#queue-item-template");
const userLevel = document.querySelector("#user-level");
const levelLabel = document.querySelector("#level-label");
const xpLevel = document.querySelector("#xp-level");
const xpCurrent = document.querySelector("#xp-current");
const xpNeeded = document.querySelector("#xp-needed");
const xpBar = document.querySelector("#xp-bar");
const watchedCount = document.querySelector("#watched-count");
const rewardToast = document.querySelector("#reward-toast");

let items = loadItems();
let activeId = items[0]?.uid ?? null;
let progress = loadProgress();
let ytPlayer = null;
let youtubeApiReady = false;
let pendingItem = null;
let awardedForCycle = false;
let lastPlayingVideoId = null;
let toastTimer = null;

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (saved && Number.isFinite(saved.level) && Number.isFinite(saved.xp)) return saved;
  } catch {}
  return { level: 1, xp: 0, completed: 0 };
}

function experienceNeeded(level) {
  return 100 + (level - 1) * 50;
}

function rankName(level) {
  if (level >= 20) return "傳奇影迷";
  if (level >= 12) return "銀幕收藏家";
  if (level >= 7) return "資深觀影者";
  if (level >= 3) return "放映常客";
  return "放映新手";
}

function renderProgress() {
  const needed = experienceNeeded(progress.level);
  userLevel.textContent = progress.level;
  xpLevel.textContent = progress.level;
  xpCurrent.textContent = progress.xp;
  xpNeeded.textContent = needed;
  watchedCount.textContent = progress.completed || 0;
  levelLabel.textContent = rankName(progress.level);
  xpBar.style.width = `${Math.min(100, progress.xp / needed * 100)}%`;
}

function awardCompletion() {
  progress.xp += XP_REWARD;
  progress.completed = (progress.completed || 0) + 1;
  let leveledUp = false;
  while (progress.xp >= experienceNeeded(progress.level)) {
    progress.xp -= experienceNeeded(progress.level);
    progress.level += 1;
    leveledUp = true;
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  renderProgress();
  rewardToast.textContent = leveledUp ? `升到 LEVEL ${progress.level}！・+${XP_REWARD} XP` : `+${XP_REWARD} XP・影片完成`;
  rewardToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => rewardToast.classList.remove("show"), 2800);
}

function parseYouTubeUrl(value) {
  const raw = value.trim();
  const plainId = /^[\w-]{11}$/.test(raw) ? raw : null;
  if (plainId) return { type: "video", id: plainId };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const allowed = ["youtube.com", "youtube-nocookie.com", "youtu.be"];
  if (!allowed.includes(host)) return null;

  const playlistId = url.searchParams.get("list");
  let videoId = null;

  if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0];
  if (host.includes("youtube")) {
    if (url.pathname === "/watch") videoId = url.searchParams.get("v");
    if (/^\/(shorts|embed|live)\//.test(url.pathname)) videoId = url.pathname.split("/")[2];
  }

  if (playlistId && !videoId) return { type: "playlist", id: playlistId };
  if (videoId && /^[\w-]{11}$/.test(videoId)) return { type: "video", id: videoId, playlistId };
  if (playlistId) return { type: "playlist", id: playlistId };
  return null;
}

function makeItem(parsed, customTitle) {
  const isPlaylist = parsed.type === "playlist";
  return {
    uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: parsed.type,
    id: parsed.id,
    playlistId: parsed.playlistId || null,
    title: customTitle.trim() || (isPlaylist ? "我的 YouTube 播放清單" : `影片 ${parsed.id}`),
    addedAt: Date.now()
  };
}

function loadPendingItem() {
  if (!ytPlayer || !pendingItem || typeof ytPlayer.loadVideoById !== "function") return;
  awardedForCycle = false;
  lastPlayingVideoId = null;
  if (pendingItem.type === "playlist") {
    ytPlayer.loadPlaylist({ list: pendingItem.id, listType: "playlist", index: 0 });
  } else {
    ytPlayer.loadVideoById(pendingItem.id);
  }
}

function onPlayerStateChange(event) {
  if (!window.YT) return;
  if (event.data === YT.PlayerState.PLAYING) {
    const videoId = ytPlayer.getVideoData()?.video_id || pendingItem?.id;
    if (videoId !== lastPlayingVideoId || ytPlayer.getCurrentTime() < 2) awardedForCycle = false;
    lastPlayingVideoId = videoId;
  }
  if (event.data === YT.PlayerState.ENDED && !awardedForCycle) {
    awardedForCycle = true;
    awardCompletion();
  }
}

function createYouTubePlayer() {
  if (ytPlayer || !youtubeApiReady) return;
  ytPlayer = new YT.Player("player", {
    width: "100%",
    height: "100%",
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      rel: 0,
      origin: location.protocol.startsWith("http") ? location.origin : undefined
    },
    events: {
      onReady: loadPendingItem,
      onStateChange: onPlayerStateChange,
      onError: event => {
        const messages = {
          100: "影片不存在或已設為私人。",
          101: "這支影片的擁有者不允許外部播放。",
          150: "這支影片的擁有者不允許外部播放。",
          153: "播放器無法確認網站來源，請從 GitHub Pages 網址開啟。"
        };
        message.textContent = messages[event.data] || `播放器發生錯誤（${event.data}）。`;
      }
    }
  });
}

window.onYouTubeIframeAPIReady = () => {
  youtubeApiReady = true;
  createYouTubePlayer();
};

const youtubeApiScript = document.createElement("script");
youtubeApiScript.src = "https://www.youtube.com/iframe_api";
document.head.append(youtubeApiScript);

function thumbnailUrl(item) {
  if (item.type === "video") return `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/mqdefault.jpg`;
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23252420'/%3E%3Cpath d='M132 65l60 25-60 25z' fill='%23ef5b3f'/%3E%3C/svg%3E";
}

function play(uid) {
  const item = items.find(entry => entry.uid === uid);
  if (!item) return;
  activeId = uid;
  pendingItem = item;
  playerHost.hidden = false;
  emptyState.hidden = true;
  nowTitle.textContent = item.title;
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") loadPendingItem();
  else createYouTubePlayer();
  renderQueue();
  document.querySelector("#screen").scrollIntoView({ behavior: "smooth", block: "center" });
}

function remove(uid) {
  const wasActive = uid === activeId;
  items = items.filter(item => item.uid !== uid);
  saveItems();
  if (wasActive) {
    activeId = items[0]?.uid ?? null;
    if (activeId) {
      const next = items[0];
      pendingItem = next;
      loadPendingItem();
      nowTitle.textContent = next.title;
    } else {
      resetPlayer();
    }
  }
  renderQueue();
}

function resetPlayer() {
  pendingItem = null;
  if (ytPlayer && typeof ytPlayer.stopVideo === "function") ytPlayer.stopVideo();
  playerHost.hidden = true;
  emptyState.hidden = false;
  nowTitle.textContent = "尚未選擇影片";
}

function renderQueue() {
  queue.replaceChildren();
  queueCount.textContent = items.length;
  queueEmpty.hidden = items.length > 0;
  clearButton.hidden = items.length === 0;

  items.forEach((item, index) => {
    const fragment = template.content.cloneNode(true);
    const article = fragment.querySelector(".queue-item");
    const image = fragment.querySelector(".thumbnail");
    const infoButton = fragment.querySelector(".item-info");
    const thumbButton = fragment.querySelector(".thumbnail-button");
    const removeButton = fragment.querySelector(".remove-button");

    article.dataset.uid = item.uid;
    article.classList.toggle("active", item.uid === activeId);
    article.classList.toggle("is-playlist", item.type === "playlist");
    image.src = thumbnailUrl(item);
    image.alt = `${item.title} 縮圖`;
    fragment.querySelector(".item-title").textContent = item.title;
    fragment.querySelector(".item-kind").textContent = item.type === "playlist" ? "YouTube playlist" : `Video · ${String(index + 1).padStart(2, "0")}`;

    thumbButton.addEventListener("click", () => play(item.uid));
    infoButton.addEventListener("click", () => play(item.uid));
    removeButton.addEventListener("click", () => remove(item.uid));
    queue.append(fragment);
  });
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const parsed = parseYouTubeUrl(urlInput.value);
  if (!parsed) {
    message.textContent = "找不到有效的 YouTube 影片或播放清單，請再檢查一次網址。";
    urlInput.focus();
    return;
  }

  const duplicate = items.find(item => item.type === parsed.type && item.id === parsed.id);
  if (duplicate) {
    message.textContent = "這個內容已經在片單裡了。";
    play(duplicate.uid);
    return;
  }

  const item = makeItem(parsed, titleInput.value);
  items.unshift(item);
  saveItems();
  urlInput.value = "";
  titleInput.value = "";
  message.textContent = "已加入你的待看片單。";
  play(item.uid);
  setTimeout(() => { if (message.textContent.startsWith("已加入")) message.textContent = ""; }, 2500);
});

clearButton.addEventListener("click", () => {
  if (!items.length || !confirm("要清空整個待看片單嗎？")) return;
  items = [];
  activeId = null;
  saveItems();
  resetPlayer();
  renderQueue();
});

focusButton.addEventListener("click", async () => {
  document.body.classList.add("focus-mode");
  try { await document.documentElement.requestFullscreen(); } catch {}
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) document.body.classList.remove("focus-mode");
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") document.body.classList.remove("focus-mode");
});

if (activeId) {
  const first = items[0];
  pendingItem = first;
  playerHost.hidden = false;
  emptyState.hidden = true;
  nowTitle.textContent = first.title;
}

renderProgress();
renderQueue();
