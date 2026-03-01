const STORAGE_KEY = "quizionix_state_v1";

const defaultState = {
  auth: {
    isAuthenticated: false
  },
  player: {
    name: "Guest",
    email: "",
    guest: true,
    avatar: "QX"
  },
  game: {
    mode: "quiz",
    zone: "Zone 1",
    branch: "Branch 1",
    difficulty: "Beginner",
    knowledgeHealth: 100,
    xp: 0,
    mastery: 0,
    correctStreak: 0,
    wrongStreak: 0,
    points: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    badges: [],
    branchClears: 0,
    bossCleared: false,
    khHistory: [100]
  },
  progress: {
    zones: [
      { name: "Zone 1", branches: [{ name: "Branch 1", mastery: 0 }, { name: "Branch 2", mastery: 0 }], unlocked: true },
      { name: "Zone 2", branches: [{ name: "Branch 1", mastery: 0 }, { name: "Branch 2", mastery: 0 }], unlocked: false }
    ]
  },
  lastResult: null,
  users: []
};

function safeClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clamp(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeUsers(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter((user) => user && typeof user === "object")
    .map((user) => ({
      name: String(user.name || "").trim(),
      email: String(user.email || "").trim().toLowerCase(),
      password: String(user.password || "")
    }))
    .filter((user) => user.email);
}

function sanitizeGame(game, defaults) {
  const safeGame = { ...defaults, ...(game || {}) };
  const kh = clamp(safeGame.knowledgeHealth, 0, 100, defaults.knowledgeHealth);

  safeGame.mode = String(safeGame.mode || defaults.mode);
  safeGame.zone = String(safeGame.zone || defaults.zone);
  safeGame.branch = String(safeGame.branch || defaults.branch);
  safeGame.difficulty = String(safeGame.difficulty || defaults.difficulty);
  safeGame.knowledgeHealth = kh;
  safeGame.xp = clamp(safeGame.xp, 0, Number.MAX_SAFE_INTEGER, defaults.xp);
  safeGame.mastery = clamp(safeGame.mastery, 0, 100, defaults.mastery);
  safeGame.correctStreak = clamp(safeGame.correctStreak, 0, Number.MAX_SAFE_INTEGER, defaults.correctStreak);
  safeGame.wrongStreak = clamp(safeGame.wrongStreak, 0, Number.MAX_SAFE_INTEGER, defaults.wrongStreak);
  safeGame.points = clamp(safeGame.points, 0, Number.MAX_SAFE_INTEGER, defaults.points);
  safeGame.totalQuestions = clamp(safeGame.totalQuestions, 0, Number.MAX_SAFE_INTEGER, defaults.totalQuestions);
  safeGame.correctAnswers = clamp(safeGame.correctAnswers, 0, Number.MAX_SAFE_INTEGER, defaults.correctAnswers);
  safeGame.wrongAnswers = clamp(safeGame.wrongAnswers, 0, Number.MAX_SAFE_INTEGER, defaults.wrongAnswers);
  safeGame.branchClears = clamp(safeGame.branchClears, 0, Number.MAX_SAFE_INTEGER, defaults.branchClears);
  safeGame.bossCleared = Boolean(safeGame.bossCleared);
  safeGame.badges = Array.isArray(safeGame.badges)
    ? safeGame.badges.map((badge) => String(badge)).filter(Boolean)
    : [];

  const history = Array.isArray(safeGame.khHistory) ? safeGame.khHistory : [kh];
  safeGame.khHistory = history
    .map((value) => clamp(value, 0, 100, kh))
    .slice(-24);

  if (!safeGame.khHistory.length) safeGame.khHistory = [kh];
  return safeGame;
}

function sanitizeProgress(progress, defaults) {
  const rawZones = Array.isArray(progress?.zones) ? progress.zones : defaults.zones;
  const fallbackZones = defaults.zones;

  const zones = rawZones.map((zone, zoneIndex) => {
    const fallbackZone = fallbackZones[zoneIndex] || fallbackZones[fallbackZones.length - 1];
    const rawBranches = Array.isArray(zone?.branches) ? zone.branches : fallbackZone.branches;

    return {
      name: String(zone?.name || fallbackZone.name),
      unlocked: Boolean(zone?.unlocked ?? fallbackZone.unlocked),
      branches: rawBranches.map((branch, branchIndex) => {
        const fallbackBranch = fallbackZone.branches[branchIndex] || fallbackZone.branches[fallbackZone.branches.length - 1];
        return {
          name: String(branch?.name || fallbackBranch.name),
          mastery: clamp(branch?.mastery, 0, 100, fallbackBranch.mastery)
        };
      })
    };
  });

  return { zones: zones.length ? zones : safeClone(defaults).zones };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaults = safeClone(defaultState);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;

    return {
      ...defaults,
      ...parsed,
      auth: {
        ...defaults.auth,
        ...(parsed.auth || {}),
        isAuthenticated: Boolean(parsed?.auth?.isAuthenticated)
      },
      player: {
        ...defaults.player,
        ...(parsed.player || {}),
        name: String(parsed?.player?.name || defaults.player.name),
        email: String(parsed?.player?.email || defaults.player.email),
        guest: Boolean(parsed?.player?.guest ?? defaults.player.guest),
        avatar: String(parsed?.player?.avatar || defaults.player.avatar)
      },
      game: sanitizeGame(parsed.game, defaults.game),
      progress: sanitizeProgress(parsed.progress, defaults.progress),
      lastResult: parsed.lastResult && typeof parsed.lastResult === "object" ? parsed.lastResult : null,
      users: sanitizeUsers(parsed.users)
    };
  } catch {
    return safeClone(defaultState);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failures (storage limits/private mode) to keep runtime stable.
  }
}

export function resetGameRuntime(state) {
  state.game.correctStreak = 0;
  state.game.wrongStreak = 0;
  state.game.points = 0;
  state.game.totalQuestions = 0;
  state.game.correctAnswers = 0;
  state.game.wrongAnswers = 0;
  state.game.branchClears = 0;
  state.game.bossCleared = false;
  state.game.khHistory = [state.game.knowledgeHealth];
  return state;
}

export function setPlayer(state, player) {
  state.player = { ...state.player, ...player };
  return state;
}

export function setAuth(state, isAuthenticated) {
  state.auth.isAuthenticated = Boolean(isAuthenticated);
  return state;
}

export function setMode(state, mode) {
  state.game.mode = mode;
  return state;
}