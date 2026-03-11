import { loadState, saveState, setMode, resetGameRuntime, setAuth, setPlayer } from "./state.js";
import { registerUser, loginUser, playAsGuest, logoutUser } from "./auth.js";
import { getQuestion, getQuestionCount, evaluateAnswer } from "./gameEngine.js";
import { flashFeedback, selectAnswerButton, setMeterWidth } from "./uiEngine.js";

const state = loadState();
const ALLOWED_EMAIL_DOMAIN = "@student.fatima.edu.ph";
const PROTECTED_PAGES = ["dashboard", "game", "progress", "result"];
const TRANSITION_PAGES = ["index.html", "frontpage.html", "login.html", "register.html"];
const THEME_KEY = "quizionix-theme";
const THEME_SCHEME_KEY = "quizionix-theme-scheme";
const REDUCE_MOTION_KEY = "quizionix-reduce-motion";
const AUDIO_PREFS_KEY = "quizionix-audio-prefs-v1";
const THEME_OPTIONS = [
  { value: "teal", label: "Teal", description: "Default primary palette" },
  { value: "pink", label: "Pink", description: "Playful accent palette" },
  { value: "milktea", label: "Milktea", description: "Soft warm palette" }
];
const TAP_SFX_SRC = "assets/sfx/sfx/universal%20sfx/tap%20sfx.mp3";
const THEME_SFX_SRC = "assets/sfx/sfx/settings%20button%20sfx/theme%20button.mp3";
const INVALID_INPUT_SFX_SRC = "assets/sfx/sfx/sign%20in%20and%20sign%20up%20sfx/incorrect%20input.mp3";
const BGM_SRC = "assets/sfx/background/landing%20page%20background.mp3";
const BGM_STATE_KEY = "quizionix-bgm-state-v1";
const BGM_UNLOCK_KEY = "quizionix-bgm-unlocked-v1";
let currentIndex = 0;
let selectedAnswer = "";
let audioPrefs = { sfxEnabled: true, bgmEnabled: true, bgmVolume: 100 };
let playThemeSfx = () => {};
let playInvalidInputSfx = () => {};
let applyBgmPreference = () => {};
let applyBgmVolume = () => {};

function byId(id) {
  return document.getElementById(id);
}

function readInput(id, shouldTrim = true) {
  const element = byId(id);
  if (!(element instanceof HTMLInputElement)) return "";
  return shouldTrim ? element.value.trim() : element.value;
}

function isAllowedSchoolEmail(email) {
  return String(email || "").trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

function togglePasswordVisibility(toggle, input) {
  if (!toggle || !input) return;
  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

function createOneShotSfx(src, volume = 0.25, lowEndVolume = 0.2) {
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (saveData) return () => {};

  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = document.documentElement.classList.contains("low-end") ? lowEndVolume : volume;

  return () => {
    if (!audioPrefs.sfxEnabled) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Ignore blocked playback attempts.
    });
  };
}

function initAuxSfx() {
  playThemeSfx = createOneShotSfx(THEME_SFX_SRC, 0.25, 0.18);
  playInvalidInputSfx = createOneShotSfx(INVALID_INPUT_SFX_SRC, 0.34, 0.24);
}

function resolveTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "teal" || saved === "pink" || saved === "milktea") return saved;
    if (saved === "dark") return "teal";
    if (saved === "light") return "milktea";
  } catch {
    // Ignore storage read failures and fallback.
  }
  return "teal";
}

function resolveAudioPrefs() {
  try {
    const raw = window.localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return { sfxEnabled: true, bgmEnabled: true, bgmVolume: 100 };
    const parsed = JSON.parse(raw);
    const parsedVolume = Number(parsed?.bgmVolume);
    const safeVolume = Number.isFinite(parsedVolume) ? Math.max(0, Math.min(100, parsedVolume)) : 100;
    return {
      sfxEnabled: parsed?.sfxEnabled !== false,
      bgmEnabled: parsed?.bgmEnabled !== false,
      bgmVolume: safeVolume
    };
  } catch {
    return { sfxEnabled: true, bgmEnabled: true, bgmVolume: 100 };
  }
}

function persistAudioPrefs() {
  try {
    window.localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(audioPrefs));
  } catch {
    // Ignore storage write failures.
  }
}

function setSfxEnabled(isEnabled) {
  audioPrefs.sfxEnabled = Boolean(isEnabled);
  persistAudioPrefs();
}

function setBgmEnabled(isEnabled) {
  audioPrefs.bgmEnabled = Boolean(isEnabled);
  persistAudioPrefs();
  applyBgmPreference(audioPrefs.bgmEnabled);
}

function setBgmVolume(volume) {
  const numeric = Number(volume);
  audioPrefs.bgmVolume = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 100;
  if (audioPrefs.bgmVolume === 0 && audioPrefs.bgmEnabled) {
    audioPrefs.bgmEnabled = false;
    applyBgmPreference(false);
  }
  persistAudioPrefs();
  applyBgmVolume(audioPrefs.bgmVolume);
}

function resolveScheme() {
  try {
    const saved = window.localStorage.getItem(THEME_SCHEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Ignore storage read failures and fallback.
  }
  return "dark";
}

function setTheme(theme) {
  const normalized = THEME_OPTIONS.some((option) => option.value === theme) ? theme : "teal";
  document.body.dataset.theme = normalized;
  try {
    window.localStorage.setItem(THEME_KEY, normalized);
  } catch {
    // Ignore storage write failures.
  }
}

function setScheme(scheme) {
  const normalized = scheme === "dark" ? "dark" : "light";
  document.body.dataset.scheme = normalized;
  try {
    window.localStorage.setItem(THEME_SCHEME_KEY, normalized);
  } catch {
    // Ignore storage write failures.
  }
}

function resolveReduceMotion() {
  try {
    const saved = window.localStorage.getItem(REDUCE_MOTION_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    // Ignore storage read failures and fallback.
  }
  return false;
}

function setReduceMotion(enabled) {
  const isEnabled = Boolean(enabled);
  document.body.dataset.reduceMotion = isEnabled ? "true" : "false";
  try {
    window.localStorage.setItem(REDUCE_MOTION_KEY, isEnabled ? "1" : "0");
  } catch {
    // Ignore storage write failures.
  }
}

function initSettingsPanel() {
  audioPrefs = resolveAudioPrefs();
  setTheme(resolveTheme());
  setScheme(resolveScheme());
  setReduceMotion(resolveReduceMotion());

  const existing = byId("settings-shell");
  if (existing) return;

  const host = document.createElement("section");
  host.id = "settings-shell";
  host.className = "settings-shell";
  host.setAttribute("aria-label", "Settings");
  host.innerHTML = `
    <button id="settings-toggle" class="icon-toggle settings-trigger" type="button" aria-expanded="false" aria-controls="settings-panel" aria-label="Open settings">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19.14 12.94a7.93 7.93 0 0 0 .05-.94c0-.32-.02-.63-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.17 7.17 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42L8.21 4.32c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.67 7.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94 0 .32.02.63.05.94L1.79 13.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>
      </svg>
    </button>
    <div id="settings-panel" class="settings-panel" hidden>
      <p class="settings-heading">Game Settings</p>
      <div class="settings-row">
        <span class="settings-row-label">
          <span class="settings-row-title">Dark mode</span>
        </span>
        <label class="toggle-switch" for="scheme-toggle" data-no-tap-sfx="true">
          <input id="scheme-toggle" type="checkbox" role="switch" />
          <span class="toggle-slider" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">
          <span class="settings-row-title">Reduce motion</span>
        </span>
        <label class="toggle-switch" for="motion-toggle" data-no-tap-sfx="true">
          <input id="motion-toggle" type="checkbox" role="switch" />
          <span class="toggle-slider" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">
          <span class="settings-row-title">SFX</span>
        </span>
        <label class="toggle-switch" for="sfx-toggle">
          <input id="sfx-toggle" type="checkbox" role="switch" />
          <span class="toggle-slider" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-row">
        <span class="settings-row-label">
          <span class="settings-row-title">Music</span>
        </span>
        <label class="toggle-switch" for="bgm-toggle">
          <input id="bgm-toggle" type="checkbox" role="switch" />
          <span class="toggle-slider" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-row settings-row-volume">
        <span class="settings-row-label">
          <span class="settings-row-title">Music Volume</span>
        </span>
        <div class="settings-volume-control">
          <input id="bgm-volume" class="settings-volume-range" type="range" min="0" max="100" step="1" value="100" aria-label="Music volume" />
          <span id="bgm-volume-value" class="settings-volume-value" aria-live="polite">100%</span>
        </div>
      </div>
      <div class="settings-row palette-row">
        <button id="palette-toggle" class="settings-expand-btn palette-trigger" type="button" aria-expanded="false" aria-controls="palette-panel" aria-label="Toggle theme color options">
          <span class="settings-row-title">Theme color</span>
          <span class="settings-row-caret" aria-hidden="true"></span>
        </button>
        <div id="palette-panel" class="palette-panel" hidden>
          <div class="palette-list">
        ${THEME_OPTIONS.map(
          (option) => `
            <button class="palette-option" data-theme-choice="${option.value}" type="button" aria-label="Use ${option.label} theme">
              <span class="palette-name">${option.label}</span>
              <span class="toggle-mini" aria-hidden="true"><span class="toggle-mini-thumb"></span></span>
            </button>
          `
        ).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(host);

  const settingsToggle = byId("settings-toggle");
  const settingsPanel = byId("settings-panel");
  const paletteToggle = byId("palette-toggle");
  const palettePanel = byId("palette-panel");
  const schemeToggle = byId("scheme-toggle");
  const motionToggle = byId("motion-toggle");
  const sfxToggle = byId("sfx-toggle");
  const bgmToggle = byId("bgm-toggle");
  const bgmVolumeRange = byId("bgm-volume");
  const bgmVolumeValue = byId("bgm-volume-value");
  if (
    !(settingsToggle instanceof HTMLButtonElement) ||
    !settingsPanel ||
    !(paletteToggle instanceof HTMLButtonElement) ||
    !palettePanel ||
    !(schemeToggle instanceof HTMLInputElement) ||
    !(motionToggle instanceof HTMLInputElement) ||
    !(sfxToggle instanceof HTMLInputElement) ||
    !(bgmToggle instanceof HTMLInputElement) ||
    !(bgmVolumeRange instanceof HTMLInputElement) ||
    !bgmVolumeValue
  ) return;

  let settingsHideTimer = null;
  let paletteHideTimer = null;

  const closePalettePanel = () => {
    if (paletteHideTimer) window.clearTimeout(paletteHideTimer);
    palettePanel.classList.remove("is-open");
    paletteHideTimer = window.setTimeout(() => {
      palettePanel.hidden = true;
    }, 160);
    paletteToggle.setAttribute("aria-expanded", "false");
  };

  const closeSettingsPanel = () => {
    if (settingsHideTimer) window.clearTimeout(settingsHideTimer);
    settingsPanel.classList.remove("is-open");
    settingsHideTimer = window.setTimeout(() => {
      settingsPanel.hidden = true;
    }, 170);
    settingsToggle.setAttribute("aria-expanded", "false");
    closePalettePanel();
  };

  const openSettingsPanel = () => {
    if (settingsHideTimer) window.clearTimeout(settingsHideTimer);
    settingsPanel.hidden = false;
    requestAnimationFrame(() => {
      settingsPanel.classList.add("is-open");
    });
    settingsToggle.setAttribute("aria-expanded", "true");
  };

  const openPalettePanel = () => {
    if (paletteHideTimer) window.clearTimeout(paletteHideTimer);
    palettePanel.hidden = false;
    requestAnimationFrame(() => {
      palettePanel.classList.add("is-open");
    });
    paletteToggle.setAttribute("aria-expanded", "true");
  };

  const syncSettingsUi = () => {
    const currentTheme = document.body.dataset.theme || "teal";
    const currentScheme = document.body.dataset.scheme === "dark" ? "dark" : "light";
    const reduceMotionEnabled = document.body.dataset.reduceMotion === "true";
    schemeToggle.checked = currentScheme === "dark";
    motionToggle.checked = reduceMotionEnabled;
    sfxToggle.checked = audioPrefs.sfxEnabled;
    bgmToggle.checked = audioPrefs.bgmEnabled;
    const volume = Math.max(0, Math.min(100, Number(audioPrefs.bgmVolume) || 100));
    bgmVolumeRange.value = String(volume);
    bgmVolumeValue.textContent = `${Math.round(volume)}%`;
    bgmVolumeRange.disabled = !bgmToggle.checked;

    host.querySelectorAll("[data-theme-choice]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.classList.toggle("active", button.dataset.themeChoice === currentTheme);
    });
  };

  syncSettingsUi();

  settingsToggle.addEventListener("click", () => {
    if (settingsPanel.hidden) {
      openSettingsPanel();
      return;
    }
    closeSettingsPanel();
  });

  schemeToggle.addEventListener("change", () => {
    playThemeSfx();
    setScheme(schemeToggle.checked ? "dark" : "light");
    syncSettingsUi();
  });

  motionToggle.addEventListener("change", () => {
    setReduceMotion(motionToggle.checked);
    syncSettingsUi();
  });

  sfxToggle.addEventListener("change", () => {
    setSfxEnabled(sfxToggle.checked);
  });

  bgmToggle.addEventListener("change", () => {
    setBgmEnabled(bgmToggle.checked);
    bgmVolumeRange.disabled = !bgmToggle.checked;
  });

  bgmVolumeRange.addEventListener("input", () => {
    const next = Number(bgmVolumeRange.value);
    setBgmVolume(next);
    bgmVolumeValue.textContent = `${Math.round(next)}%`;
    syncSettingsUi();
  });

  paletteToggle.addEventListener("click", () => {
    if (palettePanel.hidden) {
      openPalettePanel();
      return;
    }
    closePalettePanel();
  });

  host.querySelectorAll("[data-theme-choice]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      const choice = button.dataset.themeChoice || "teal";
      setTheme(choice);
      syncSettingsUi();
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (host.contains(target)) return;
    closeSettingsPanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!palettePanel.hidden) {
      closePalettePanel();
      return;
    }
    closeSettingsPanel();
  });

}

function initTapSfx() {
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (saveData) return;

  const poolSize = 4;
  const audioPool = Array.from({ length: poolSize }, () => {
    const audio = new Audio(TAP_SFX_SRC);
    audio.preload = "auto";
    audio.volume = document.documentElement.classList.contains("low-end") ? 0.2 : 0.28;
    return audio;
  });

  let poolIndex = 0;
  let lastTapAt = 0;
  const minGapMs = 40;
  const interactiveSelector = [
    "button",
    "a[href]",
    "input[type='checkbox']",
    "input[type='radio']",
    "[role='button']",
    ".answer-btn",
    ".mode-card",
    ".dash-game-card"
  ].join(",");
  const authSubmitSelector = "#login-form button[type='submit'], #register-form button[type='submit']";

  const playTap = () => {
    if (!audioPrefs.sfxEnabled) return;
    const now = performance.now();
    if (now - lastTapAt < minGapMs) return;
    lastTapAt = now;

    const audio = audioPool[poolIndex];
    poolIndex = (poolIndex + 1) % poolSize;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Ignore blocked playback attempts.
    });
  };

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(interactiveSelector);
      if (!(trigger instanceof Element)) return;
      if (trigger.matches(":disabled")) return;
      if (trigger.matches(authSubmitSelector)) return;
      if (trigger.closest("[data-no-tap-sfx]")) return;
      playTap();
    },
    { passive: true }
  );
}

function initSharedBgm(page) {
  if (!["home", "login", "register"].includes(page)) return;

  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  if (saveData) return;

  const isLowEnd = document.documentElement.classList.contains("low-end");
  const maxVolume = isLowEnd ? 0.12 : 0.16;
  const resolveTargetVolume = () => {
    const pct = Math.max(0, Math.min(100, Number(audioPrefs.bgmVolume) || 100));
    return maxVolume * (pct / 100);
  };
  const audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;
  audio.playsInline = true;

  let hasStarted = false;
  let startPending = false;
  let persistTimer = null;
  let fadeTimer = null;

  const isUnlocked = () => {
    try {
      return window.sessionStorage.getItem(BGM_UNLOCK_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markUnlocked = () => {
    try {
      window.sessionStorage.setItem(BGM_UNLOCK_KEY, "1");
    } catch {
      // Ignore storage write failures.
    }
  };

  const persistState = () => {
    try {
      window.localStorage.setItem(
        BGM_STATE_KEY,
        JSON.stringify({
          src: BGM_SRC,
          time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          ts: Date.now()
        })
      );
    } catch {
      // Ignore storage write failures.
    }
  };

  const getSavedTime = () => {
    try {
      const raw = window.localStorage.getItem(BGM_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.src !== BGM_SRC) return null;
      if (!Number.isFinite(parsed.time) || parsed.time < 0) return null;
      return parsed.time;
    } catch {
      return null;
    }
  };

  const restoreState = () => {
    const savedTime = getSavedTime();
    if (!Number.isFinite(savedTime)) return;
    const seek = () => {
      try {
        audio.currentTime = savedTime;
      } catch {
        // Ignore seek failures.
      }
    };
    if (audio.readyState >= 1) {
      seek();
    } else {
      audio.addEventListener("loadedmetadata", seek, { once: true });
    }
  };

  const clearFadeTimer = () => {
    if (fadeTimer) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  };

  const fadeVolumeTo = (target, durationMs = 900) => {
    const clampedTarget = Math.max(0, Math.min(1, Number(target) || 0));
    const startVolume = Math.max(0, Math.min(1, Number(audio.volume) || 0));
    const stepMs = 50;
    const steps = Math.max(1, Math.ceil(durationMs / stepMs));
    let currentStep = 0;
    clearFadeTimer();
    fadeTimer = window.setInterval(() => {
      currentStep += 1;
      const t = Math.min(1, currentStep / steps);
      audio.volume = startVolume + (clampedTarget - startVolume) * t;
      if (t >= 1) {
        clearFadeTimer();
      }
    }, stepMs);
  };

  const start = () => {
    if (!audioPrefs.bgmEnabled) return;
    if (startPending) return;
    if (!audio.paused) {
      hasStarted = true;
      return;
    }
    startPending = true;
    audio.volume = 0;
    audio.muted = true;
    const playPromise = audio.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      startPending = false;
      return;
    }
    playPromise
      .then(() => {
        hasStarted = true;
        startPending = false;
        markUnlocked();
        // Start muted (autoplay-safe), then reveal audio with a smooth fade.
        audio.muted = false;
        fadeVolumeTo(resolveTargetVolume(), 900);
      })
      .catch(() => {
        startPending = false;
        // Autoplay may be blocked until interaction.
      });
  };

  const onInteractionStart = () => {
    if (!audioPrefs.bgmEnabled) return;
    markUnlocked();
    start();
    if (hasStarted) {
      window.removeEventListener("pointerdown", onInteractionStart);
      window.removeEventListener("keydown", onInteractionStart);
      window.removeEventListener("touchstart", onInteractionStart);
    }
  };

  restoreState();
  audio.load();
  if (audioPrefs.bgmEnabled) {
    window.setTimeout(start, 250);
  }

  window.addEventListener("pointerdown", onInteractionStart, { passive: true });
  window.addEventListener("keydown", onInteractionStart);
  window.addEventListener("touchstart", onInteractionStart, { passive: true });

  persistTimer = window.setInterval(() => {
    if (!audio.paused) persistState();
  }, 300);

  document.addEventListener("visibilitychange", () => {
    if (!audioPrefs.bgmEnabled) return;
    if (document.hidden) {
      clearFadeTimer();
      persistState();
      if (!audio.paused) audio.pause();
      return;
    }
    if (hasStarted) {
      audio.play().catch(() => {});
    }
  });

  window.addEventListener("pagehide", () => {
    clearFadeTimer();
    persistState();
    if (!audio.paused) audio.pause();
    if (persistTimer) {
      window.clearInterval(persistTimer);
      persistTimer = null;
    }
  });

  window.addEventListener("pageshow", () => {
    restoreState();
    if (isUnlocked() && audioPrefs.bgmEnabled) {
      start();
    }
  });

  applyBgmPreference = (isEnabled) => {
    if (isEnabled) {
      markUnlocked();
      start();
      return;
    }
    clearFadeTimer();
    if (!audio.paused) {
      audio.pause();
    }
  };

  applyBgmVolume = (volume) => {
    const pct = Math.max(0, Math.min(100, Number(volume) || 100));
    const target = maxVolume * (pct / 100);
    if (audio.paused || audio.muted) {
      audio.volume = target;
      return;
    }
    fadeVolumeTo(target, 220);
  };
}

function initPageTransitions() {
  document.body.classList.add("page-enter");
  requestAnimationFrame(() => {
    document.body.classList.add("page-enter-active");
  });

  document.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const isTransitionTarget = TRANSITION_PAGES.some((name) => url.pathname.endsWith(name));
      if (!isTransitionTarget || url.href === window.location.href) return;

      event.preventDefault();
      document.body.classList.remove("page-enter-active");
      document.body.classList.add("page-leave");
      window.setTimeout(() => {
        window.location.href = url.href;
      }, 220);
    });
  });
}

function initLoadingPage(page) {
  if (page !== "loading") return;
  window.setTimeout(() => {
    window.location.href = "frontpage.html";
  }, 5000);
}

function guardProtectedPage(page) {
  if (!page) return;
  if (PROTECTED_PAGES.includes(page) && !state.auth.isAuthenticated) {
    window.location.href = "frontpage.html#signin";
  }
}

function hydrateResearchExports() {
  window.getQuizionixResearchLog = () => ({
    timestamp: new Date().toISOString(),
    player: state.player,
    game: state.game,
    lastResult: state.lastResult
  });

  window.getQuizionixResearchExport = () => JSON.stringify(window.getQuizionixResearchLog(), null, 2);
}

function renderBadgeList(containerId) {
  const host = byId(containerId);
  if (!host) return;

  host.innerHTML = "";
  const badges = Array.isArray(state.game.badges) ? state.game.badges : [];
  if (!badges.length) {
    const chip = document.createElement("span");
    chip.className = "badge-chip";
    chip.textContent = "No badges yet";
    host.appendChild(chip);
    return;
  }

  badges.forEach((badge) => {
    const chip = document.createElement("span");
    chip.className = "badge-chip";
    chip.textContent = badge;
    host.appendChild(chip);
  });
}

function initHomeAuthFlow() {
  const modal = byId("home-auth-modal");
  const signinPanel = byId("home-signin-panel");
  const signupPanel = byId("home-signup-panel");
  if (!modal || !signinPanel || !signupPanel) return;

  const animatePanel = (panel) => {
    panel.classList.remove("panel-animate");
    void panel.offsetWidth;
    panel.classList.add("panel-animate");
  };

  const showPanel = (mode) => {
    const activeMode = mode === "signup" ? "signup" : "signin";
    signinPanel.hidden = activeMode !== "signin";
    signupPanel.hidden = activeMode !== "signup";
    const activePanel = activeMode === "signup" ? signupPanel : signinPanel;
    animatePanel(activePanel);
    modal.hidden = false;
    modal.classList.add("is-open");
    document.body.classList.add("auth-modal-open");
  };

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("hidden", "");
    modal.classList.remove("is-open");
    document.body.classList.remove("auth-modal-open");
    // Reset to a known default state to avoid blank/corrupt modal content on reopen.
    signinPanel.hidden = false;
    signupPanel.hidden = true;
    if (window.location.hash === "#signin" || window.location.hash === "#signup") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  const openModal = (mode) => {
    const safeMode = mode === "signup" ? "signup" : "signin";
    showPanel(safeMode);
  };

  document.querySelectorAll("[data-open-auth]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const mode = node.getAttribute("data-open-auth") || "signin";
      openModal(mode);
    });
  });

  document.querySelectorAll("[data-switch-auth]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      const mode = node.getAttribute("data-switch-auth") || "signin";
      openModal(mode);
    });
  });

  document.querySelectorAll("[data-auth-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    });
  });

  // Delegated close safety-net for dynamic UI timing/animation edge cases.
  modal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-auth-close]")) return;
    event.preventDefault();
    event.stopPropagation();
    closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  // One-time hash support on initial load only.
  if (window.location.hash === "#signin") {
    openModal("signin");
  } else if (window.location.hash === "#signup") {
    openModal("signup");
  } else {
    closeModal();
  }
}

function initHome() {
  const guestBtn = byId("guest-btn");
  const banner = byId("guest-banner");
  const close = byId("guest-close");
  const testSignInBtn = byId("test-signin-btn");

  if (testSignInBtn) {
    testSignInBtn.addEventListener("click", () => {
      const input = window.prompt("Enter test password:");
      if (input !== "7522") {
        window.alert("Invalid test password.");
        return;
      }

      setAuth(state, true);
      setPlayer(state, {
        name: "Test User",
        email: "test@quizionix.local",
        guest: false,
        avatar: "T"
      });
      saveState(state);
      window.location.href = "dashboard.html";
    });
  }

  if (!guestBtn || !banner || !close) return;

  guestBtn.addEventListener("click", () => {
    playAsGuest(state);
    saveState(state);
    banner.hidden = false;
  });

  close.addEventListener("click", () => {
    banner.hidden = true;
    window.location.href = "dashboard.html";
  });
}

function initLogin() {
  const form = byId("login-form");
  const msg = byId("login-msg");
  const emailInput = byId("login-email");
  const password = byId("login-password");
  const toggle = byId("toggle-login-password");
  const forgot = byId("forgot-password");
  if (
    !(form instanceof HTMLFormElement) ||
    !msg ||
    !(emailInput instanceof HTMLInputElement) ||
    !(password instanceof HTMLInputElement) ||
    !toggle ||
    !forgot
  ) return;

  togglePasswordVisibility(toggle, password);
  const clearInvalidStyles = () => {
    emailInput.classList.remove("input-invalid");
    password.classList.remove("input-invalid");
  };

  emailInput.addEventListener("input", () => {
    emailInput.classList.remove("input-invalid");
    if (msg.textContent) msg.textContent = "";
  });
  password.addEventListener("input", () => {
    password.classList.remove("input-invalid");
    if (msg.textContent) msg.textContent = "";
  });

  forgot.addEventListener("click", (event) => {
    event.preventDefault();
    msg.textContent = "Reset is not active yet. Contact admin support.";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearInvalidStyles();
    msg.textContent = "";

    const email = readInput("login-email").toLowerCase();
    const payload = {
      email,
      password: password.value
    };

    if (!isAllowedSchoolEmail(email)) {
      emailInput.classList.add("input-invalid");
      playInvalidInputSfx();
      return;
    }

    const result = loginUser(state, payload);
    if (!result.ok) {
      password.classList.add("input-invalid");
      playInvalidInputSfx();
      return;
    }
    msg.textContent = result.message;
    window.setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
  });
}

function initRegister() {
  const form = byId("register-form");
  const msg = byId("register-msg");
  const password = byId("reg-password");
  const confirmPassword = byId("reg-confirm-password");
  const togglePassword = byId("toggle-reg-password");
  const toggleConfirm = byId("toggle-reg-confirm");
  if (!(form instanceof HTMLFormElement) || !msg) return;

  if (password instanceof HTMLInputElement && togglePassword) {
    togglePasswordVisibility(togglePassword, password);
  }
  if (confirmPassword instanceof HTMLInputElement && toggleConfirm) {
    togglePasswordVisibility(toggleConfirm, confirmPassword);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = {
      name: readInput("reg-name"),
      email: readInput("reg-email").toLowerCase(),
      password: readInput("reg-password", false),
      confirmPassword: readInput("reg-confirm-password", false)
    };

    const result = registerUser(state, payload);
    msg.textContent = result.message;
    if (!result.ok) {
      playInvalidInputSfx();
      return;
    }
    window.setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
  });
}

function initDashboard() {
  const welcome = byId("user-name");
  const avatar = byId("player-avatar");
  const email = byId("user-email");
  const level = byId("hud-level");
  const mastery = byId("hud-mastery");
  const badges = byId("hud-badges");
  const logout = byId("logout-btn");
  const search = byId("dashboard-search");
  const libraryCards = Array.from(document.querySelectorAll(".dash-game-card"));

  if (welcome) welcome.textContent = state.player.name || "Player";
  if (avatar && !avatar.querySelector("img")) avatar.textContent = state.player.avatar || "Q";
  if (email) email.textContent = state.player.email || "Guest Mode";
  if (level) level.textContent = String(Math.max(1, Math.floor(state.game.xp / 100) + 1));
  if (mastery) mastery.textContent = `${state.game.mastery}%`;
  if (badges) badges.textContent = String(Array.isArray(state.game.badges) ? state.game.badges.length : 0);
  renderBadgeList("dashboard-badges");

  if (logout) {
    logout.addEventListener("click", () => {
      logoutUser(state);
      window.location.href = "index.html";
    });
  }

  const modeButtons = Array.from(document.querySelectorAll(".mode-card"));
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      modeButtons.forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      setMode(state, button.dataset.mode || "quiz");
      saveState(state);
    });

    button.addEventListener("dblclick", () => {
      setMode(state, button.dataset.mode || "quiz");
      saveState(state);
      window.location.href = "game.html";
    });

    if (button.dataset.mode === state.game.mode) {
      button.classList.add("active");
    }
  });

  if (search instanceof HTMLInputElement && libraryCards.length) {
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      libraryCards.forEach((card) => {
        const text = card.textContent?.toLowerCase() || "";
        card.hidden = query ? !text.includes(query) : false;
      });
    });
  }

  libraryCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a, button")) return;
      const launch = card.querySelector("a[href]");
      if (launch instanceof HTMLAnchorElement) {
        window.location.href = launch.href;
      }
    });
  });
}

function renderQuestion() {
  const title = byId("q-title");
  const text = byId("q-text");
  const optionsWrap = byId("answer-options");
  const progress = byId("question-progress");
  const totalQuestions = getQuestionCount();

  if (!totalQuestions) {
    if (text) text.textContent = "No questions configured.";
    return;
  }

  const question = getQuestion(currentIndex);
  if (!question) {
    if (text) text.textContent = "Question unavailable.";
    return;
  }

  if (title) title.textContent = `Challenge ${currentIndex + 1}`;
  if (text) text.textContent = question.prompt;
  if (!optionsWrap || !progress) return;

  optionsWrap.innerHTML = "";
  selectedAnswer = "";

  question.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = option;
    btn.addEventListener("click", () => {
      selectedAnswer = option;
      selectAnswerButton(optionsWrap, btn);
    });
    optionsWrap.appendChild(btn);
  });

  setMeterWidth(progress, ((currentIndex + 1) / totalQuestions) * 100);
}

function syncGameHud() {
  const gZone = byId("g-zone");
  const gBranch = byId("g-branch");
  const gDiff = byId("g-difficulty");
  const gMastery = byId("g-mastery");
  const gKh = byId("g-kh");
  const points = byId("points");

  if (gZone) gZone.textContent = state.game.zone;
  if (gBranch) gBranch.textContent = state.game.branch;
  if (gDiff) gDiff.textContent = state.game.difficulty;
  if (gMastery) gMastery.textContent = `${state.game.mastery}%`;
  if (gKh) gKh.textContent = String(state.game.knowledgeHealth);
  if (points) points.textContent = `Points: ${state.game.points}`;
}

function initGame() {
  resetGameRuntime(state);
  saveState(state);

  const prev = byId("prev-btn");
  const next = byId("next-btn");
  const submit = byId("submit-btn");
  const feedback = byId("feedback");
  const hint = byId("hint");
  const branchBtn = byId("branch-btn");
  const bossBtn = byId("boss-btn");

  renderQuestion();
  syncGameHud();

  if (branchBtn) {
    branchBtn.addEventListener("click", () => {
      state.game.branch = state.game.branch === "Branch 1" ? "Branch 2" : "Branch 1";
      saveState(state);
      syncGameHud();
    });
  }

  if (bossBtn && feedback) {
    bossBtn.addEventListener("click", () => {
      if (!state.game.bossCleared && state.game.branchClears < 5) {
        flashFeedback(feedback, false, "Boss locked: clear 5 branch wins first.");
        playInvalidInputSfx();
        return;
      }
      flashFeedback(feedback, true, "Boss node active. Good luck.");
    });
  }

  if (prev) {
    prev.addEventListener("click", () => {
      currentIndex = Math.max(0, currentIndex - 1);
      renderQuestion();
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      currentIndex = Math.min(getQuestionCount() - 1, currentIndex + 1);
      renderQuestion();
    });
  }

  if (submit && feedback) {
    submit.addEventListener("click", () => {
      if (!selectedAnswer) {
        flashFeedback(feedback, false, "Select an answer first.");
        playInvalidInputSfx();
        return;
      }

      const question = getQuestion(currentIndex);
      if (!question) {
        flashFeedback(feedback, false, "Question unavailable.");
        playInvalidInputSfx();
        return;
      }

      const result = evaluateAnswer(state, question, selectedAnswer);
      flashFeedback(
        feedback,
        result.isCorrect,
        result.isCorrect ? "Correct! Great job." : "Incorrect. Review and retry."
      );
      if (!result.isCorrect) {
        playInvalidInputSfx();
      }

      if (hint) {
        hint.textContent = result.isCorrect
          ? "Hint: Keep your streak alive for harder tiers and more XP."
          : `Hint: The correct answer was "${question.answer}".`;
      }

      const zones = state.progress?.zones;
      if (Array.isArray(zones) && zones[0]?.branches?.[0]) {
        zones[0].branches[0].mastery = state.game.mastery;
      }
      if (Array.isArray(zones) && zones[1] && state.game.bossCleared) {
        zones[1].unlocked = true;
      }

      state.lastResult = {
        points: result.points,
        kh: result.knowledgeHealth,
        mastery: result.mastery,
        difficulty: result.difficulty,
        correct: state.game.correctAnswers,
        wrong: state.game.wrongAnswers,
        branchClears: result.branchClears,
        bossCleared: result.bossCleared,
        badges: result.badges
      };
      saveState(state);
      syncGameHud();
    });
  }
}

function initResult() {
  const result = state.lastResult;
  if (!result) return;

  const summary = byId("result-summary");
  const score = byId("result-score");
  const kh = byId("result-kh");
  const diff = byId("result-difficulty");
  const branch = byId("result-branch");
  const badges = byId("result-badges");

  if (summary) summary.textContent = `Mode: ${state.game.mode} | Points: ${result.points}`;
  if (score) score.textContent = `Correct/Wrong: ${result.correct}/${result.wrong}`;
  if (kh) kh.textContent = `KH: ${result.kh}`;
  if (diff) diff.textContent = `Difficulty Reached: ${result.difficulty}`;
  if (branch) {
    branch.textContent = `Branch Clears: ${result.branchClears} | Boss: ${result.bossCleared ? "Cleared" : "Pending"}`;
  }
  if (badges) {
    const earned = Array.isArray(result.badges) ? result.badges : [];
    badges.textContent = `Badges Earned: ${earned.length ? earned.join(", ") : "None yet"}`;
  }
}

function renderMasteryMap() {
  const host = byId("mastery-map");
  if (!host) return;
  host.innerHTML = "";

  state.progress.zones.forEach((zone) => {
    const box = document.createElement("div");
    box.className = "mastery-zone";

    const heading = document.createElement("h3");
    heading.textContent = `${zone.name}${zone.unlocked ? "" : " (Locked)"}`;
    box.appendChild(heading);

    zone.branches.forEach((branch) => {
      const node = document.createElement("p");
      node.className = "mastery-branch";
      node.textContent = `${branch.name}: ${branch.mastery}%`;
      if (!zone.unlocked) node.style.opacity = "0.55";
      box.appendChild(node);
    });

    host.appendChild(box);
  });
}

function renderKhChart() {
  const polyline = byId("kh-polyline");
  if (!polyline) return;

  const history = Array.isArray(state.game.khHistory) ? state.game.khHistory : [];
  const values = history.length ? history : [state.game.knowledgeHealth];
  const width = 320;
  const height = 120;
  const points = values.map((value, index) => {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    const x = (index / Math.max(values.length - 1, 1)) * (width - 8) + 4;
    const y = ((100 - safe) / 100) * (height - 10) + 5;
    return `${x},${y}`;
  });

  polyline.setAttribute("points", points.join(" "));
}

function initProgress() {
  const xp = byId("p-xp");
  const kh = byId("p-kh");
  const difficulty = byId("p-difficulty");
  const mastery = byId("p-mastery");
  const meter = byId("p-meter");
  const exportBtn = byId("export-json");
  const copyBtn = byId("copy-json");
  const exportMsg = byId("export-msg");

  if (xp) xp.textContent = String(state.game.xp);
  if (kh) kh.textContent = String(state.game.knowledgeHealth);
  if (difficulty) difficulty.textContent = state.game.difficulty;
  if (mastery) mastery.textContent = `${state.game.mastery}%`;
  if (meter) setMeterWidth(meter, state.game.mastery);

  renderMasteryMap();
  renderKhChart();
  renderBadgeList("progress-badges");

  if (exportBtn && exportMsg) {
    exportBtn.addEventListener("click", () => {
      exportMsg.textContent = window.getQuizionixResearchExport();
    });
  }

  if (copyBtn && exportMsg) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(window.getQuizionixResearchExport());
        exportMsg.textContent = "JSON copied to clipboard.";
      } catch {
        exportMsg.textContent = "Clipboard access blocked in this browser context.";
      }
    });
  }
}

const page = document.body?.dataset?.page || "";
initAuxSfx();
initSettingsPanel();
initTapSfx();
initSharedBgm(page);
initLoadingPage(page);
initPageTransitions();
guardProtectedPage(page);
hydrateResearchExports();

if (page === "home") {
  initHome();
  initHomeAuthFlow();
  initLogin();
  initRegister();
}
if (page === "login") initLogin();
if (page === "register") initRegister();
if (page === "dashboard") initDashboard();
if (page === "game") initGame();
if (page === "result") initResult();
if (page === "progress") initProgress();
