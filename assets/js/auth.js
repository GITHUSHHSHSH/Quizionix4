import { saveState, setAuth, setPlayer } from "./state.js";

const ALLOWED_EMAIL_DOMAIN = "@student.fatima.edu.ph";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAllowedEmail(email) {
  return normalizeEmail(email).endsWith(ALLOWED_EMAIL_DOMAIN);
}

function findUserByEmail(state, email) {
  const target = normalizeEmail(email);
  return state.users.find((user) => normalizeEmail(user.email) === target);
}

export function registerUser(state, payload) {
  const name = String(payload?.name || "").trim();
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");
  const confirmPassword = String(payload?.confirmPassword || "");

  if (!name || !email || !password || !confirmPassword) {
    return { ok: false, message: "Complete all required fields." };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, message: "Use your Fatima school email only." };
  }
  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  if (findUserByEmail(state, email)) {
    return { ok: false, message: "Account already exists. Please sign in." };
  }

  state.users.push({ name, email, password });
  setAuth(state, true);
  setPlayer(state, { name, email, guest: false, avatar: (name[0] || "Q").toUpperCase() });
  saveState(state);
  return { ok: true, message: "Account created. Redirecting..." };
}

export function loginUser(state, payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || "");

  if (!isAllowedEmail(email)) {
    return { ok: false, message: "Use your Fatima school email only." };
  }

  const user = findUserByEmail(state, email);
  if (!user) {
    return { ok: false, message: "No account found for this email. Register first." };
  }
  if (user.password !== password) {
    return { ok: false, message: "Invalid password." };
  }

  setAuth(state, true);
  const name = user.name || email.split("@")[0] || "Player";
  setPlayer(state, { name, email, guest: false, avatar: (name[0] || "Q").toUpperCase() });
  saveState(state);
  return { ok: true, message: "Signed in. Redirecting..." };
}

export function playAsGuest(state) {
  setAuth(state, true);
  setPlayer(state, { name: "Guest", email: "", guest: true, avatar: "G" });
  saveState(state);
}

export function logoutUser(state) {
  setAuth(state, false);
  setPlayer(state, { name: "Guest", email: "", guest: true, avatar: "G" });
  saveState(state);
}
