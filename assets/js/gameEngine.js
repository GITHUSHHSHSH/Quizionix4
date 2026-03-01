const questionBank = Object.freeze([
  {
    prompt: "What is the SI unit of force?",
    options: ["Newton", "Joule", "Pascal", "Watt"],
    answer: "Newton"
  },
  {
    prompt: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: "Mars"
  },
  {
    prompt: "In computing, CPU stands for?",
    options: ["Central Processing Unit", "Core Program Utility", "Central Program Unit", "Control Process Utility"],
    answer: "Central Processing Unit"
  },
  {
    prompt: "Which shape has exactly three sides?",
    options: ["Rectangle", "Triangle", "Pentagon", "Circle"],
    answer: "Triangle"
  }
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateDifficulty(game) {
  if (game.correctStreak >= 5) {
    game.difficulty = "Master";
    return;
  }
  if (game.correctStreak >= 3) {
    game.difficulty = "Advanced";
    return;
  }
  if (game.wrongStreak >= 3) {
    game.difficulty = "Beginner";
    return;
  }
  if (game.wrongStreak >= 2 && game.difficulty === "Master") {
    game.difficulty = "Advanced";
  }
}

function awardBadge(game, badgeName) {
  if (!game.badges.includes(badgeName)) game.badges.push(badgeName);
}

export function getQuestion(index) {
  return questionBank[index % questionBank.length];
}

export function getQuestionCount() {
  return questionBank.length;
}

export function evaluateAnswer(state, question, selected) {
  const game = state.game;
  const isCorrect = selected === question.answer;

  game.totalQuestions += 1;
  if (isCorrect) {
    game.correctAnswers += 1;
    game.correctStreak += 1;
    game.wrongStreak = 0;
    game.xp += 12;
    game.points += 100;
    game.knowledgeHealth = clamp(game.knowledgeHealth + 4, 0, 100);
    game.branchClears += 1;
  } else {
    game.correctStreak = 0;
    game.wrongStreak += 1;
    game.wrongAnswers += 1;
    game.points = clamp(game.points - 20, 0, Number.MAX_SAFE_INTEGER);
    game.knowledgeHealth = clamp(game.knowledgeHealth - 9, 0, 100);
  }

  game.mastery = clamp(
    Math.round((game.correctAnswers / Math.max(game.totalQuestions, 1)) * 100),
    0,
    100
  );

  updateDifficulty(game);
  game.khHistory.push(game.knowledgeHealth);
  if (game.khHistory.length > 24) game.khHistory.shift();

  if (game.correctAnswers >= 3) awardBadge(game, "Quick Learner");
  if (game.mastery >= 80) awardBadge(game, "Mastery Rising");
  if (game.branchClears >= 5) game.bossCleared = true;

  return {
    isCorrect,
    points: game.points,
    knowledgeHealth: game.knowledgeHealth,
    mastery: game.mastery,
    difficulty: game.difficulty,
    branchClears: game.branchClears,
    bossCleared: game.bossCleared,
    badges: [...game.badges]
  };
}