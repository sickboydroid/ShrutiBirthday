const AUDIO_START = 23;

const CARD_DEFS = [
  { kind: "loading" },
  {
    kind: "text",
    emoji: "🎂",
    title: "Happy Birthday, Shruti!",
    body:
      "To the softest, kindest, most stubborn person I know. May today be wrapped in laughter, tiny magical moments, and every little thing that makes you smile.",
    footer: "23 April — your day to shine, Pookie.",
    palette: "pink-yellow",
  },
  { kind: "chat" },
  { kind: "photo" },
  { kind: "photo" },
  { kind: "photo" },
  { kind: "photo" },
  { kind: "photo" },
  { kind: "photo" },
  {
    kind: "text",
    emoji: "💌",
    title: "From Junaid",
    body:
      "We stopped being us, and it still hurts sometimes, but I am so proud of you. Keep chasing your weird little dreams. I'll be cheering from afar, always.",
    footer: "Love you forever, Noah.",
    palette: "lilac-cyan",
  },
  { kind: "end" },
];

const PHOTO_FILES = [
  "IMG-240602-093737-17.jpg",
  "IMG-240603-222147-74.jpg",
  "IMG-260320-200639-850.jpg",
  "IMG-260322-200038-1166.jpg",
  "IMG-260322-200038-1167.jpg",
  "IMG-260324-174623-1462.jpg",
  "IMG-260325-082422-1473.jpg",
  "IMG-260325-160650-1486.jpg",
  "IMG-260329-152928-1806.jpg",
  "IMG-260403-223730-369.jpg",
  "IMG-260403-223819-370.jpg",
  "IMG-260403-224036-372.jpg",
  "IMG-260403-224212-375.jpg",
  "IMG-260405-130220-567.jpg",
  "IMG-260405-141142-570.jpg",
  "IMG-260423-094342-802.jpg",
  "IMG-260423-143857-567.jpg",
  "IMG-260423-143909-375.jpg",
  "IMG-260423-143911-372.jpg",
  "IMG-260423-143913-370.jpg",
  "IMG-260423-143914-369.jpg",
  "IMG_20240413_141423_359.jpg",
  "IMG_20240413_141423_551.jpg",
  "IMG_20240413_141423_895.jpg",
  "IMG_20240413_141424_228.jpg",
  "IMG_20240413_141424_253.jpg",
  "IMG_20240606_223151_661.jpg",
];

const PHOTO_CAPTIONS = [
  "how are you this pretty, huh?",
  "my favorite face in the universe",
  "one smile and the day is fixed",
  "certified cutest panda ever",
  "sunshine in human form",
  "this frame deserves a museum",
  "illegal levels of cute, pookie",
  "you + this smile = my weakness",
];

const YOU_NAMES = ["sickboy", "junaid", "nick", "ashraf", "noah"];

const state = {
  cards: [],
  chats: [],
  cardIndex: 0,
  transitioning: false,
  loadingLocked: true,
  audioUnlocked: false,
  beginReady: false,
};

const refs = {
  stage: document.getElementById("card-stage"),
  card: document.getElementById("card"),
  content: document.getElementById("card-content"),
  caption: document.getElementById("card-caption"),
  loaderBar: document.getElementById("loader-bar"),
  loaderPercent: document.getElementById("loader-percent"),
  audio: document.getElementById("bg-music"),
  unlockButton: document.getElementById("audio-unlock"),
  canvas: document.getElementById("space-canvas"),
  tapHint: document.getElementById("tap-hint"),
};

/* ---------- utils ---------- */

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseTime(raw) {
  const [datePart, timePart] = String(raw).split(" ");
  if (!datePart || !timePart) return { dateLabel: "", timeLabel: "" };
  const [dd, mm, yyyy] = datePart.split(".");
  return {
    dateLabel: `${dd}/${mm}/${yyyy}`,
    timeLabel: timePart.slice(0, 5),
  };
}

function isYou(sender) {
  const lower = String(sender || "").toLowerCase();
  return YOU_NAMES.some((name) => lower.includes(name));
}

function cleanMessage(msg) {
  if (!msg) return "";
  const trimmed = String(msg).trim();
  if (["<UNKNOWN>", "<IMAGE>", "<VIDEO>", "<STICKER>", "<FILE>"].includes(trimmed)) return "";
  return trimmed;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- loading ---------- */

function setLoading(progress, label) {
  const pct = clamp(Math.round(progress * 100), 0, 100);
  refs.loaderBar.style.width = `${pct}%`;
  refs.loaderPercent.textContent = `${pct}%`;
  if (label) {
    const bodyEl = refs.content.querySelector(".cartoon-body");
    if (bodyEl) bodyEl.textContent = label;
  }
}

async function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function preloadResources() {
  setLoading(0.04, "Waking up stars...");

  const resp = await fetch("./assets/chats.json");
  if (!resp.ok) throw new Error("Could not load chats");
  state.chats = await resp.json();
  setLoading(0.2, "Loaded our chats");

  await new Promise((resolve) => {
    const audio = refs.audio;
    const done = () => resolve();
    audio.addEventListener("canplaythrough", done, { once: true });
    audio.addEventListener("error", done, { once: true });
    audio.load();
  });
  setLoading(0.38, "Music tuned up");

  const targets = shuffle(PHOTO_FILES).slice(0, Math.min(PHOTO_FILES.length, 12));
  let loaded = 0;
  for (const file of targets) {
    await preloadImage(`./assets/photos/${file}`);
    loaded += 1;
    setLoading(0.38 + (loaded / targets.length) * 0.62, "Polishing memories...");
  }

  setLoading(1, "Ready!");
}

/* ---------- content prep ---------- */

function chooseChatSegment() {
  const filtered = state.chats
    .map((item) => ({
      sender: item.sender,
      message: cleanMessage(item.message),
      ...parseTime(item.time),
    }))
    .filter((item) => item.message && item.dateLabel && item.timeLabel);

  if (filtered.length < 14) return filtered;

  const length = 14 + Math.floor(Math.random() * 6);
  const start = Math.floor(Math.random() * (filtered.length - length));
  return filtered.slice(start, start + length);
}

function ensureContentPools() {
  const photoCardCount = CARD_DEFS.filter((c) => c.kind === "photo").length;
  const photos = shuffle(PHOTO_FILES).slice(0, photoCardCount);
  const captions = shuffle(PHOTO_CAPTIONS);

  let photoIdx = 0;
  state.cards = CARD_DEFS.map((card) => {
    if (card.kind === "chat") {
      return { ...card, segment: chooseChatSegment() };
    }
    if (card.kind === "photo") {
      const file = photos[photoIdx] || pick(PHOTO_FILES);
      const caption = captions[photoIdx % captions.length] || pick(PHOTO_CAPTIONS);
      photoIdx += 1;
      return { ...card, file, caption };
    }
    return { ...card };
  });
}

/* ---------- rendering ---------- */

function renderLoadingView() {
  return `
    <div class="loading-view">
      <div class="sparkle-ring" aria-hidden="true"></div>
      <h1 class="cartoon-title">Loading your surprise</h1>
      <p class="cartoon-body">Warming up music, chats, and memories...</p>
      <div class="loader-wrap">
        <div class="loader-track">
          <span id="loader-bar" class="loader-bar" style="width:100%"></span>
        </div>
        <p class="loader-text"><span id="loader-percent">100%</span></p>
      </div>
    </div>
  `;
}

function renderBeginView() {
  return `
    <div class="begin-view">
      <div class="emoji-big">🎉</div>
      <h1 class="begin-title">Tap to begin</h1>
      <p class="begin-sub">a tiny surprise for my favorite panda</p>
      <div class="tap-pill">tap anywhere</div>
    </div>
  `;
}

function renderTextView(card) {
  return `
    <div class="text-view">
      <div class="text-stickers" aria-hidden="true">
        <span class="sticker s1">★</span>
        <span class="sticker s2">♥</span>
        <span class="sticker s3">✿</span>
        <span class="sticker s4">✦</span>
      </div>
      <div class="text-header">
        <div class="text-emoji">${escapeHtml(card.emoji || "✨")}</div>
        <h2 class="text-title">${escapeHtml(card.title)}</h2>
      </div>
      <p class="text-body">${escapeHtml(card.body)}</p>
      <p class="text-footer">${escapeHtml(card.footer)}</p>
    </div>
  `;
}

function renderPhotoView(file) {
  return `
    <div class="photo-view">
      <img src="./assets/photos/${escapeHtml(file)}" alt="Shruti" draggable="false" />
    </div>
  `;
}

function renderChatView(segment) {
  let lastDate = "";
  const chunks = [
    '<div class="chat-view">',
    '<div class="chat-header">',
    '<div class="chat-header-name"><span class="avatar">S</span>Shruti</div>',
    "<span>online</span>",
    "</div>",
    '<div class="chat-shell" id="chat-shell">',
  ];
  for (const msg of segment) {
    if (msg.dateLabel !== lastDate) {
      lastDate = msg.dateLabel;
      chunks.push(`<div class="chat-date">${escapeHtml(lastDate)}</div>`);
    }
    const side = isYou(msg.sender) ? "right" : "left";
    chunks.push(
      `<div class="message ${side}"><p>${escapeHtml(msg.message)}</p><span class="meta">${escapeHtml(
        msg.timeLabel,
      )}</span></div>`,
    );
  }
  chunks.push("</div></div>");
  return chunks.join("");
}

function renderEndView() {
  return `
    <div class="end-view">
      <div>
        <h2>The End 🎈</h2>
        <p>thank you for reading this, pookie.<br/>have the best year yet.</p>
      </div>
    </div>
  `;
}

function captionFor(card) {
  switch (card.kind) {
    case "loading":
      return "for you ♥";
    case "text":
      return card.footer ? "with love ♥" : "hello there ♥";
    case "chat":
      return "remember this? ✨";
    case "photo":
      return card.caption || "my favorite ♥";
    case "end":
      return "the end ♥";
    default:
      return "♥";
  }
}

function renderCard(index) {
  const card = state.cards[index] || CARD_DEFS[index];
  if (!card) return;

  let html = "";
  if (card.kind === "loading") {
    html = state.beginReady ? renderBeginView() : renderLoadingView();
  } else if (card.kind === "text") {
    html = renderTextView(card);
  } else if (card.kind === "chat") {
    html = renderChatView(card.segment || chooseChatSegment());
  } else if (card.kind === "photo") {
    html = renderPhotoView(card.file || pick(PHOTO_FILES));
  } else if (card.kind === "end") {
    html = renderEndView();
  }

  refs.content.innerHTML = html;
  refs.caption.textContent = captionFor(card);

  if (card.kind === "loading") {
    const barEl = document.getElementById("loader-bar");
    const pctEl = document.getElementById("loader-percent");
    if (barEl) refs.loaderBar = barEl;
    if (pctEl) refs.loaderPercent = pctEl;
  }
}

/* ---------- navigation ---------- */

function shakeCard() {
  refs.card.classList.remove("shake");
  void refs.card.offsetWidth;
  refs.card.classList.add("shake");
  setTimeout(() => refs.card.classList.remove("shake"), 400);
}

function playTransition(direction, after) {
  state.transitioning = true;
  const outCls = direction === "next" ? "transition-next" : "transition-prev";
  const inCls = direction === "next" ? "transition-in-next" : "transition-in-prev";

  refs.card.classList.add(outCls);
  setTimeout(() => {
    refs.card.classList.remove(outCls);
    after();
    refs.card.classList.add(inCls);
    setTimeout(() => {
      refs.card.classList.remove(inCls);
      state.transitioning = false;
    }, 340);
  }, 340);
}

function goToNext() {
  if (state.transitioning) return;
  const current = state.cards[state.cardIndex] || CARD_DEFS[state.cardIndex];
  if (current && current.kind === "loading" && !state.beginReady) {
    shakeCard();
    return;
  }
  if (state.cardIndex >= CARD_DEFS.length - 1) {
    shakeCard();
    return;
  }
  const nextIndex = state.cardIndex + 1;
  playTransition("next", () => {
    state.cardIndex = nextIndex;
    renderCard(state.cardIndex);
  });
}

function goToPrev() {
  if (state.transitioning) return;
  const min = state.loadingLocked ? 1 : 0;
  if (state.cardIndex <= min) {
    shakeCard();
    return;
  }
  const prevIndex = state.cardIndex - 1;
  playTransition("prev", () => {
    state.cardIndex = prevIndex;
    renderCard(state.cardIndex);
  });
}

function handleBeginTap() {
  state.cardIndex = 1;
  state.loadingLocked = true;
  playTransition("next", () => {
    renderCard(state.cardIndex);
  });
}

/* ---------- audio ---------- */

function tryStartAudio() {
  if (state.audioUnlocked) return;
  try {
    refs.audio.currentTime = AUDIO_START;
  } catch (_) {
    // ignore seek errors before metadata ready
  }
  refs.audio
    .play()
    .then(() => {
      state.audioUnlocked = true;
      refs.unlockButton.classList.add("hidden");
    })
    .catch(() => {
      refs.unlockButton.classList.remove("hidden");
    });
}

/* ---------- input handling (tap vs scroll) ---------- */

function bindInput() {
  let startX = 0;
  let startY = 0;
  let startedOnChat = false;
  let pointerDown = false;

  refs.card.addEventListener("pointerdown", (event) => {
    pointerDown = true;
    startX = event.clientX;
    startY = event.clientY;
    startedOnChat = !!event.target.closest?.(".chat-shell");
  });

  refs.card.addEventListener("pointerup", (event) => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const moved = Math.hypot(dx, dy);

    // ignore taps that are actually swipes/scrolls
    if (moved > 14) return;

    // if tap started inside chat scroll area and moved vertically, treat as scroll intent
    if (startedOnChat && Math.abs(dy) > 6) return;

    tryStartAudio();

    const currentCard = state.cards[state.cardIndex];
    if (currentCard && currentCard.kind === "loading" && state.beginReady) {
      handleBeginTap();
      return;
    }

    const rect = refs.card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < rect.width / 2) goToPrev();
    else goToNext();
  });

  refs.card.addEventListener("pointercancel", () => {
    pointerDown = false;
  });

  document.addEventListener("keydown", (event) => {
    const current = state.cards[state.cardIndex];
    if (current && current.kind === "loading" && state.beginReady && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      tryStartAudio();
      handleBeginTap();
      return;
    }
    if (event.key === "ArrowRight") goToNext();
    if (event.key === "ArrowLeft") goToPrev();
  });

  refs.unlockButton.addEventListener("click", (e) => {
    e.stopPropagation();
    tryStartAudio();
  });

  refs.audio.addEventListener("ended", () => {
    try {
      refs.audio.currentTime = AUDIO_START;
    } catch (_) {
      // ignore
    }
    refs.audio.play().catch(() => {});
  });

  refs.audio.addEventListener("loadedmetadata", () => {
    try {
      refs.audio.currentTime = AUDIO_START;
    } catch (_) {
      // ignore
    }
  });
}

/* ---------- space canvas ---------- */

function startSpaceCanvas() {
  const canvas = refs.canvas;
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let width = 0;
  let height = 0;
  let stars = [];
  let planets = [];
  let shooting = null;
  let shootingTimer = 0;

  const PLANET_PALETTE = [
    ["#ff6db7", "#ffd166"],
    ["#6dd3ff", "#c7a8ff"],
    ["#7fe4b7", "#ffd166"],
    ["#c7a8ff", "#ff6db7"],
    ["#ff9f6b", "#ffd166"],
  ];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    const starCount = Math.max(80, Math.floor((width * height) / 7000));
    stars = [];
    for (let i = 0; i < starCount; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.3,
        a: Math.random() * 0.6 + 0.3,
        tw: Math.random() * 0.03 + 0.005,
        vy: Math.random() * 0.08 + 0.02,
        hue: pick([280, 320, 200, 50, 180, 260]),
      });
    }

    planets = [];
    const planetCount = window.innerWidth < 700 ? 2 : 4;
    for (let i = 0; i < planetCount; i += 1) {
      const palette = pick(PLANET_PALETTE);
      planets.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 18 + Math.random() * 34,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        a: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.008,
        colorA: palette[0],
        colorB: palette[1],
        hasRing: Math.random() > 0.45,
      });
    }
  }

  function maybeShoot() {
    shootingTimer -= 1;
    if (shootingTimer > 0 || shooting) return;
    if (Math.random() > 0.012) return;
    const fromTop = Math.random() > 0.5;
    shooting = {
      x: Math.random() * width,
      y: fromTop ? -20 : Math.random() * height * 0.3,
      vx: 6 + Math.random() * 4,
      vy: 3 + Math.random() * 2,
      life: 1,
    };
    shootingTimer = 120;
  }

  function drawPlanet(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    const grad = ctx.createRadialGradient(-p.r * 0.35, -p.r * 0.35, p.r * 0.1, 0, 0, p.r);
    grad.addColorStop(0, p.colorA);
    grad.addColorStop(1, p.colorB);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(-p.r * 0.3, -p.r * 0.3, p.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (p.hasRing) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.55, p.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);

    for (const s of stars) {
      s.a += s.tw;
      const alpha = 0.35 + Math.abs(Math.sin(s.a)) * 0.65;
      s.y += s.vy;
      if (s.y > height + 4) {
        s.y = -4;
        s.x = Math.random() * width;
      }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue},95%,82%,${alpha.toFixed(2)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of planets) {
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      if (p.x < -80) p.x = width + 80;
      if (p.x > width + 80) p.x = -80;
      if (p.y < -80) p.y = height + 80;
      if (p.y > height + 80) p.y = -80;
      drawPlanet(p);
    }

    maybeShoot();
    if (shooting) {
      ctx.save();
      const tailLen = 80;
      const grad = ctx.createLinearGradient(
        shooting.x,
        shooting.y,
        shooting.x - shooting.vx * (tailLen / 6),
        shooting.y - shooting.vy * (tailLen / 6),
      );
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(shooting.x, shooting.y);
      ctx.lineTo(shooting.x - shooting.vx * (tailLen / 6), shooting.y - shooting.vy * (tailLen / 6));
      ctx.stroke();
      ctx.restore();

      shooting.x += shooting.vx;
      shooting.y += shooting.vy;
      if (shooting.x > width + 100 || shooting.y > height + 100) {
        shooting = null;
      }
    }

    requestAnimationFrame(frame);
  }

  resize();
  seed();
  window.addEventListener("resize", () => {
    resize();
    seed();
  });
  frame();
}

/* ---------- boot ---------- */

async function init() {
  startSpaceCanvas();
  bindInput();
  renderCard(0);

  try {
    await preloadResources();
    ensureContentPools();
    state.beginReady = true;
    refs.tapHint.textContent = "tap anywhere to begin";
    renderCard(0);
  } catch (error) {
    refs.content.innerHTML = `
      <div class="text-view">
        <div class="text-header">
          <div class="text-emoji">😵</div>
          <h2 class="text-title">Something broke</h2>
        </div>
        <p class="text-body">Please refresh and try again.</p>
        <p class="text-footer">${escapeHtml(error.message || String(error))}</p>
      </div>
    `;
  }
}

init();
