const CARD_DEFS = [
  { kind: "loading" },
  {
    kind: "text",
    title: "Happy Birthday, Shruti",
    body: "May your day be as lovely, soft, and bright as your smile. You deserve all the peace, joy, and tiny magical moments today.",
    footer: "April 23 - your special day.",
  },
  {
    kind: "text",
    title: "A little from my heart",
    body: "Distance changed many things, but it never changed how deeply I respect you. Thank you for every memory, every laugh, and every calm you gave me.",
    footer: "You will always stay special to me, Pookie.",
  },
  { kind: "chat" },
  { kind: "photo" },
  { kind: "chat" },
  { kind: "photo" },
  { kind: "chat" },
  { kind: "photo" },
  { kind: "chat" },
  {
    kind: "text",
    title: "From Junaid",
    body: "I wish you endless growth, beautiful friendships, and the courage to chase everything your heart wants. I love you, and I am cheering for you always.",
    footer: "Take care, Noah. Bye for now.",
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
  "Screenshot_2024-06-08-20-10-37-69_08626e35eb99698b0717ca70323a2481.jpg",
];

const PHOTO_CAPTIONS = [
  "How do you make every random frame look this pretty?",
  "This smile is illegal level cute.",
  "One photo and suddenly my day is fixed.",
  "Still my favorite face in the whole universe.",
  "If sunshine had a human version, this would be it.",
  "You are art. No arguments accepted.",
];

const YOU_NAMES = ["sickboy", "junaid", "nick", "ashraf", "noah"];

const state = {
  cards: [],
  chats: [],
  chatSegments: [],
  photoPool: [],
  cardIndex: 0,
  transitioning: false,
  loadingLocked: true,
  audioUnlocked: false,
};

const refs = {
  card: document.getElementById("card"),
  content: document.getElementById("card-content"),
  loaderBar: document.getElementById("loader-bar"),
  loaderPercent: document.getElementById("loader-percent"),
  audio: document.getElementById("bg-music"),
  unlockButton: document.getElementById("audio-unlock"),
  canvas: document.getElementById("space-canvas"),
};

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
  if (!msg || msg === "<UNKNOWN>" || msg === "<IMAGE>" || msg === "<VIDEO>" || msg === "<STICKER>") {
    return "";
  }
  return String(msg).trim();
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

function setLoading(progress, label) {
  const pct = clamp(Math.round(progress * 100), 0, 100);
  refs.loaderBar.style.width = `${pct}%`;
  refs.loaderPercent.textContent = `${pct}%`;
  if (label) {
    refs.content.querySelector(".card-body").textContent = label;
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
  const loadSteps = [
    async () => {
      const resp = await fetch("./assets/chats.json");
      if (!resp.ok) throw new Error("Cannot load chats");
      state.chats = await resp.json();
      setLoading(0.18, "Chats loaded.");
    },
    async () => {
      const audio = refs.audio;
      await new Promise((resolve) => {
        const done = () => resolve();
        audio.addEventListener("canplaythrough", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        audio.load();
      });
      setLoading(0.36, "Music ready.");
    },
    async () => {
      const photos = shuffle(PHOTO_FILES).slice(0, Math.min(PHOTO_FILES.length, 14));
      let loaded = 0;
      for (const file of photos) {
        await preloadImage(`./assets/photos/${file}`);
        loaded += 1;
        setLoading(0.36 + (loaded / photos.length) * 0.64, "Polishing your memories...");
      }
    },
  ];

  setLoading(0.04, "Waking up stars...");
  for (const step of loadSteps) {
    await step();
  }
  setLoading(1, "Ready!");
}

function chooseChatSegment() {
  const filtered = state.chats
    .map((item) => ({
      sender: item.sender,
      message: cleanMessage(item.message),
      ...parseTime(item.time),
    }))
    .filter((item) => item.message && item.dateLabel && item.timeLabel);

  if (filtered.length < 12) {
    return filtered.slice(0, 12);
  }

  const length = 10 + Math.floor(Math.random() * 11);
  const start = Math.floor(Math.random() * (filtered.length - length));
  return filtered.slice(start, start + length);
}

function ensureContentPools() {
  state.chatSegments = [chooseChatSegment(), chooseChatSegment(), chooseChatSegment(), chooseChatSegment()];
  state.photoPool = shuffle(PHOTO_FILES).slice(0, 3);
  state.cards = CARD_DEFS.map((card) => ({ ...card }));

  let chatIdx = 0;
  let photoIdx = 0;
  state.cards = state.cards.map((card) => {
    if (card.kind === "chat") {
      const segment = state.chatSegments[chatIdx] || chooseChatSegment();
      chatIdx += 1;
      return { ...card, segment };
    }
    if (card.kind === "photo") {
      const file = state.photoPool[photoIdx] || PHOTO_FILES[Math.floor(Math.random() * PHOTO_FILES.length)];
      const caption = PHOTO_CAPTIONS[Math.floor(Math.random() * PHOTO_CAPTIONS.length)];
      photoIdx += 1;
      return { ...card, file, caption };
    }
    return card;
  });
}

function renderTextCard(card) {
  return `
    <h2 class="card-title">${escapeHtml(card.title)}</h2>
    <p class="card-body">${escapeHtml(card.body)}</p>
    <p class="heartline">${escapeHtml(card.footer)}</p>
  `;
}

function renderPhotoCard(file, caption) {
  return `
    <div class="photo-wrap">
      <img src="./assets/photos/${escapeHtml(file)}" alt="Shruti photo" loading="eager" />
      <p>${escapeHtml(caption)}</p>
    </div>
  `;
}

function renderChatCard(segment) {
  let lastDate = "";
  const chunks = ['<div class="chat-shell">'];
  for (const msg of segment) {
    if (msg.dateLabel !== lastDate) {
      lastDate = msg.dateLabel;
      chunks.push(`<div class="chat-date">${escapeHtml(lastDate)}</div>`);
    }
    const side = isYou(msg.sender) ? "right" : "left";
    chunks.push(`
      <div class="message ${side}">
        <p>${escapeHtml(msg.message)}</p>
        <span class="meta">${escapeHtml(msg.timeLabel)}</span>
      </div>
    `);
  }
  chunks.push("</div>");
  return chunks.join("");
}

function renderEndCard() {
  return `
    <div class="end-card">
      <div>
        <h2>The End</h2>
        <p>Thank you for reading this, Shruti.</p>
      </div>
    </div>
  `;
}

function renderCard(index) {
  const card = state.cards[index];
  refs.card.classList.remove("loading");
  if (!card) return;

  if (card.kind === "loading") {
    refs.card.classList.add("loading");
    return;
  }
  if (card.kind === "text") {
    refs.content.innerHTML = renderTextCard(card);
    return;
  }
  if (card.kind === "chat") {
    refs.content.innerHTML = renderChatCard(card.segment || chooseChatSegment());
    return;
  }
  if (card.kind === "photo") {
    const file = card.file || PHOTO_FILES[Math.floor(Math.random() * PHOTO_FILES.length)];
    const caption = card.caption || PHOTO_CAPTIONS[Math.floor(Math.random() * PHOTO_CAPTIONS.length)];
    refs.content.innerHTML = renderPhotoCard(file, caption);
    return;
  }
  refs.content.innerHTML = renderEndCard();
}

function shakeCard() {
  refs.card.classList.remove("shake");
  requestAnimationFrame(() => refs.card.classList.add("shake"));
  setTimeout(() => refs.card.classList.remove("shake"), 350);
}

function animateTransition(direction) {
  state.transitioning = true;
  const cls = direction === "next" ? "transition-next" : "transition-prev";
  refs.card.classList.add(cls);
  setTimeout(() => {
    refs.card.classList.remove(cls);
    state.transitioning = false;
  }, 320);
}

function goToNext() {
  if (state.transitioning) return;
  if (state.cardIndex >= state.cards.length - 1) {
    shakeCard();
    return;
  }
  state.cardIndex += 1;
  animateTransition("next");
  renderCard(state.cardIndex);
}

function goToPrev() {
  if (state.transitioning) return;
  const min = state.loadingLocked ? 1 : 0;
  if (state.cardIndex <= min) {
    shakeCard();
    return;
  }
  state.cardIndex -= 1;
  animateTransition("prev");
  renderCard(state.cardIndex);
}

function tryStartAudio() {
  if (state.audioUnlocked) return;
  refs.audio.currentTime = 25;
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

function bindNavigation() {
  refs.card.addEventListener("click", (event) => {
    const rect = refs.card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    tryStartAudio();
    if (isLeft) goToPrev();
    else goToNext();
  });

  refs.card.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") goToNext();
    if (event.key === "ArrowLeft") goToPrev();
  });

  refs.unlockButton.addEventListener("click", () => {
    tryStartAudio();
  });

  refs.audio.addEventListener("ended", () => {
    refs.audio.currentTime = 25;
    refs.audio.play().catch(() => {});
  });
}

function startSpaceCanvas() {
  const canvas = refs.canvas;
  const ctx = canvas.getContext("2d");
  const objects = [];

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function seed() {
    objects.length = 0;
    const count = Math.max(40, Math.floor(window.innerWidth / 10));
    for (let i = 0; i < count; i += 1) {
      objects.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2.6 + 0.6,
        vy: Math.random() * 0.28 + 0.04,
        vx: Math.random() * 0.14 - 0.07,
        hue: [210, 255, 320][Math.floor(Math.random() * 3)],
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const o of objects) {
      o.x += o.vx;
      o.y += o.vy;
      if (o.y > window.innerHeight + 6) o.y = -8;
      if (o.x > window.innerWidth + 6) o.x = -6;
      if (o.x < -8) o.x = window.innerWidth + 8;

      ctx.beginPath();
      ctx.fillStyle = `hsla(${o.hue}, 90%, 80%, 0.75)`;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
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

async function init() {
  startSpaceCanvas();
  bindNavigation();
  renderCard(0);
  try {
    await preloadResources();
    ensureContentPools();
    setTimeout(() => {
      state.loadingLocked = true;
      state.cardIndex = 1;
      renderCard(state.cardIndex);
      animateTransition("next");
    }, 380);
  } catch (error) {
    refs.content.innerHTML = `
      <h2 class="card-title">Oops, something failed</h2>
      <p class="card-body">Please refresh once and try again.</p>
      <p class="heartline">Error: ${String(error.message || error)}</p>
    `;
  }
}

init();
