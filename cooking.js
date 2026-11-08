// Cooking mode: a recipe's steps one at a time in large text, readable from the
// stove, with a timer button for any step that says how long to cook ("simmer 10 minutes").

const cookingDialog = document.getElementById("cooking-dialog");
const cookingView = document.getElementById("cooking-view");
const timerBar = document.getElementById("cooking-timer");

// "10 minutes", "2-3 mins", "1 hour", "30 seconds". For a range the timer uses the
// shorter time, so the cook checks the dish before it can overcook.
const TIMER_PATTERN = /(\d+)(?:\s*(?:-|–|to)\s*\d+)?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

// The timers a step mentions, as { label, seconds }, without repeats.
function stepTimers(step) {
  const timers = new Map();
  for (const [, amount, unit] of step.matchAll(TIMER_PATTERN)) {
    const lowerUnit = unit.toLowerCase();
    const number = Number(amount);
    let seconds = number * 60;
    let label = `${number} min`;
    if (lowerUnit.startsWith("h")) {
      seconds = number * 3600;
      label = `${number} hr`;
    } else if (lowerUnit.startsWith("s")) {
      seconds = number;
      label = `${number} sec`;
    }
    if (seconds > 0) {
      timers.set(label, { label, seconds });
    }
  }
  return [...timers.values()];
}

// Real steps only; a heading ("For the sauce:") is shown above the steps under it.
function cookingSteps(steps) {
  const result = [];
  let heading = null;
  for (const step of steps) {
    if (isStepHeading(step)) {
      heading = step.replace(/:$/, "");
    } else {
      result.push({ heading, text: step });
    }
  }
  return result;
}

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

// One timer at a time, shown in a bar under the steps so it keeps counting while
// the cook moves on to the next step.
let timer = null;

function stopTimer() {
  if (timer) {
    clearInterval(timer.interval);
  }
  timer = null;
  timerBar.hidden = true;
  timerBar.classList.remove("timer-done");
}

function beep() {
  try {
    const audio = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const tone = audio.createOscillator();
      tone.frequency.value = 880;
      tone.connect(audio.destination);
      tone.start(audio.currentTime + i * 0.4);
      tone.stop(audio.currentTime + i * 0.4 + 0.2);
    }
  } catch {
    // No sound available; the "Time's up!" message still shows.
  }
}

function renderTimer() {
  timerBar.replaceChildren();
  if (!timer) {
    timerBar.hidden = true;
    return;
  }
  timerBar.hidden = false;
  const done = timer.remaining <= 0;
  timerBar.classList.toggle("timer-done", done);
  const text = done ? `⏰ Time's up! (${timer.label})` : `⏱ ${formatClock(timer.remaining)}`;
  timerBar.append(el("span", "timer-clock", text));
  if (!done) {
    const pause = el("button", "timer-button", timer.paused ? "Resume" : "Pause");
    pause.type = "button";
    pause.addEventListener("click", () => {
      timer.paused = !timer.paused;
      renderTimer();
    });
    // For when the food is ready early: ends the timer and, if the cook is still on
    // the step that started it, moves on to the next step.
    const skip = el("button", "timer-button", "Skip ⏭");
    skip.type = "button";
    skip.addEventListener("click", () => {
      const onTimerStep = cooking.index === timer.stepIndex;
      stopTimer();
      if (onTimerStep) {
        moveStep(1);
      }
    });
    timerBar.append(pause, skip);
  }
  const cancel = el("button", "timer-button", done ? "OK" : "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", stopTimer);
  timerBar.append(cancel);
}

function startTimer({ label, seconds }) {
  stopTimer();
  timer = { label, remaining: seconds, paused: false, stepIndex: cooking.index };
  timer.interval = setInterval(() => {
    if (timer.paused) {
      return;
    }
    timer.remaining -= 1;
    if (timer.remaining <= 0) {
      clearInterval(timer.interval);
      beep();
    }
    renderTimer();
  }, 1000);
  renderTimer();
}

// Keeps the phone screen from turning off while cooking, where the browser allows it.
let wakeLock = null;

async function keepScreenOn() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

let cooking = null;

function renderCookingStep() {
  const { name, steps, index } = cooking;
  const step = steps[index];
  cookingView.replaceChildren();

  const closeButton = el("button", "close-button", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Leave cooking mode");
  closeButton.addEventListener("click", leaveCooking);

  const title = el("h2", "cooking-title", name);
  title.id = "cooking-title";
  const progress = el("p", "cooking-progress", `Step ${index + 1} of ${steps.length}`);
  const bar = el("div", "cooking-progress-bar");
  const fill = el("div");
  fill.style.width = `${((index + 1) / steps.length) * 100}%`;
  bar.append(fill);
  cookingView.append(closeButton, title, progress, bar);

  if (step.heading) {
    cookingView.append(el("p", "cooking-heading", step.heading));
  }
  const text = el("p", "cooking-step", step.text);
  text.setAttribute("aria-live", "polite");
  cookingView.append(text);

  const timers = stepTimers(step.text);
  if (timers.length > 0) {
    const timerButtons = el("div", "cooking-timers");
    for (const found of timers) {
      const button = el("button", "cooking-timer-button", `⏱ Start ${found.label} timer`);
      button.type = "button";
      button.addEventListener("click", () => startTimer(found));
      timerButtons.append(button);
    }
    cookingView.append(timerButtons);
  }

  const nav = el("div", "cooking-nav");
  const previous = el("button", "cooking-nav-button", "← Previous");
  previous.type = "button";
  previous.disabled = index === 0;
  previous.addEventListener("click", () => moveStep(-1));
  const isLast = index === steps.length - 1;
  const next = el("button", "cooking-nav-button cooking-next", isLast ? "Done ✓" : "Next →");
  next.type = "button";
  next.addEventListener("click", () => (isLast ? finishCooking() : moveStep(1)));
  nav.append(previous, next);
  cookingView.append(nav);
  next.focus();
}

function moveStep(change) {
  const index = cooking.index + change;
  if (index >= 0 && index < cooking.steps.length) {
    cooking.index = index;
    renderCookingStep();
  }
}

// steps are the recipe's steps with amounts for the chosen servings.
function startCooking(result, steps) {
  const cookingStepList = cookingSteps(steps);
  if (cookingStepList.length === 0) {
    return;
  }
  cooking = { result, name: result.name, steps: cookingStepList, index: 0 };
  renderCookingStep();
  cookingDialog.showModal();
  keepScreenOn();
}

cookingDialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    moveStep(1);
  } else if (event.key === "ArrowLeft") {
    moveStep(-1);
  }
});

// Stops the timer and lets the screen turn off again. Also runs when Escape closes the window.
function endCooking() {
  stopTimer();
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

function leaveCooking() {
  endCooking();
  cookingDialog.close();
}

// "Done ✓" on the last step: the dish counts as made, so it goes into History.
function finishCooking() {
  recordCooked(cooking.result);
  leaveCooking();
}

cookingDialog.addEventListener("close", endCooking);

if (typeof module !== "undefined") {
  module.exports = { stepTimers, cookingSteps, formatClock };
}
