export function flashFeedback(el, isGood, text) {
  el.textContent = text;
  el.classList.remove("feedback-good", "feedback-bad");
  el.classList.add(isGood ? "feedback-good" : "feedback-bad");
}

export function selectAnswerButton(container, button) {
  container.querySelectorAll(".answer-btn").forEach((node) => node.classList.remove("active"));
  if (button) button.classList.add("active");
}

export function setMeterWidth(el, pct) {
  el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}
