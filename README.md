# Quizionix Clean Restart

platform scaffold.

## Stack
- HTML
- CSS
- JavaScript (browser-only)

## Pages
- `index.html` Landing/Home
- `login.html` Sign in
- `register.html` Sign up
- `dashboard.html` Player hub
- `game.html` Gameplay
- `result.html` Post-game feedback
- `progress.html` Progress + mastery

## Architecture
- `assets/js/state.js` global state
- `assets/js/auth.js` auth handlers
- `assets/js/gameEngine.js` adaptive + KH/XP/mastery
- `assets/js/uiEngine.js` UI feedback helpers
- `assets/js/dataLogger.js` placeholder (disabled phase 1)
- `assets/js/app.js` bootstrap + page controllers

## Phase 1 Scope
- Adaptive difficulty
- Correct/wrong streaks
- KH + XP
- Topic mastery
- Visual feedback

Research logging intentionally disabled for this phase.
