// Page behavior: managing the ingredient list and showing matching recipes from
// our own cookbook (data.js) and from TheMealDB (mealdb.js).

const aliasIndex = buildAliasIndex(INGREDIENTS);

// Each ingredient the user added: { label, localKey, phrases, mealDbNames }.
const userIngredients = [];

// Resolves to TheMealDB's ingredient names, or null if they couldn't be loaded (e.g. offline).
const mealDbNamesPromise = fetchIngredientNames().catch(() => null);

let searchCount = 0;

const MEAL_SECTIONS = [
  { id: "all", label: "All" },
  { id: "breakfast", label: "Breakfast", noun: "breakfast" },
  { id: "lunch", label: "Lunch", noun: "lunch" },
  { id: "dinner", label: "Dinner", noun: "dinner" },
  { id: "dessert", label: "Dessert", noun: "dessert" },
];
// "ingredients" finds dishes from what you have; "name" looks a dish up by its name.
let searchMode = "ingredients";
let nameQuery = "";
let selectedMeal = "all";
let beginnerOnly = false;
let quickOnly = false;
const QUICK_MINUTES = 20;
let latestResults = [];
let latestNote = "";
const SEARCHING_NOTE = "Searching online recipes…";

// The user's home cuisine, e.g. "Chinese". null means we haven't asked yet;
// "" means they chose to skip. Saved in this browser so we only ask once.
const HOME_AREA_KEY = "what-can-i-cook-home-area";
let homeArea = loadHomeArea();
const EXOTIC_PICKS = 3;
const FRIDGE_PICKS = 3;
// True once ingredients have been added from "What's in My Fridge?"; shows the
// "Quickest with what you have" row until ingredients are added another way.
let showFridgePicks = false;
// The nationality clicked in the welcome window but not yet confirmed.
let pickedArea = null;

function loadHomeArea() {
  try {
    return localStorage.getItem(HOME_AREA_KEY);
  } catch {
    return null;
  }
}

function saveHomeArea(area) {
  homeArea = area;
  try {
    localStorage.setItem(HOME_AREA_KEY, area);
  } catch {
    // Storage can be blocked (private windows); we'll just ask again next visit.
  }
}

function isHomeDish(result) {
  return Boolean(homeArea) && result.area === homeArea;
}

// Favorite dishes, saved in this browser as full copies so they open even offline.
const FAVORITES_KEY = "what-can-i-cook-favorites";
let favorites = loadFavorites();

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // Storage can be blocked (private windows); favorites then last until the page closes.
  }
}

function isFavorite(id) {
  return favorites.some((favorite) => favorite.id === id);
}

// A copy to keep (favorites, history), without the have/missing marks, since those
// depend on today's ingredients.
function savedCopy(result) {
  return {
    ...result,
    saved: true,
    items: result.items.map((item) => ({ ...item, status: "plain" })),
    matchedLabels: [],
    missingLabels: [],
  };
}

function toggleFavorite(result) {
  if (isFavorite(result.id)) {
    favorites = favorites.filter((favorite) => favorite.id !== result.id);
  } else {
    favorites.push(savedCopy(result));
  }
  saveFavorites();
  drawResults();
  renderProfile();
  const openButton = detail.querySelector(".detail-favorite");
  if (dialog.open && openButton) {
    const newButton = detailFavoriteButton(result);
    // The heart beats with a ring around it when a dish is saved (not when removed).
    newButton.classList.toggle("favorite-just-saved", isFavorite(result.id));
    openButton.replaceWith(newButton);
    newButton.focus();
  }
}

// Recipes the user has made, newest first: added by finishing cooking mode or by
// "I made this". Making a dish again moves it back to the top.
const HISTORY_KEY = "what-can-i-cook-history";
const HISTORY_LIMIT = 30;
let cookedHistory = loadHistory();

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function recordCooked(result) {
  cookedHistory = [
    { ...savedCopy(result), cookedAt: Date.now() },
    ...cookedHistory.filter((entry) => entry.id !== result.id),
  ].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(cookedHistory));
  } catch {
    // Storage can be blocked (private windows); history then lasts until the page closes.
  }
  renderProfile();
}

// "Today", "Yesterday", or a date like "Nov 3".
function cookedDateText(time) {
  const day = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((day(new Date()) - day(new Date(time))) / (24 * 60 * 60 * 1000));
  if (daysAgo === 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function detailFavoriteButton(result) {
  const button = favoriteButton(result, "detail-favorite");
  const saved = isFavorite(result.id);
  button.replaceChildren(
    el("span", "favorite-heart", saved ? "♥" : "♡"),
    el("span", null, saved ? "Saved to favorites" : "Save to favorites"),
  );
  return button;
}

const form = document.getElementById("ingredient-form");
const input = document.getElementById("ingredient-input");
const inputMessage = document.getElementById("input-message");
const suggestions = document.getElementById("ingredient-suggestions");
const quickPicks = document.getElementById("quick-picks");
const haveList = document.getElementById("have-list");
const results = document.getElementById("results");
const mealTabs = document.getElementById("meal-tabs");
const ingredientLabel = document.getElementById("ingredient-label");
const searchButton = document.getElementById("search-button");
const dialog = document.getElementById("recipe-dialog");
const detail = document.getElementById("recipe-detail");
const welcomeDialog = document.getElementById("welcome-dialog");
const welcomeForm = document.getElementById("welcome-form");
const homeSearch = document.getElementById("home-search");
const homeOptions = document.getElementById("home-options");
const homeMessage = document.getElementById("home-message");
const welcomeSkip = document.getElementById("welcome-skip");
const homeLine = document.getElementById("home-line");
const dietLine = document.getElementById("diet-line");
const dietDialog = document.getElementById("diet-dialog");
const dietForm = document.getElementById("diet-form");
const dietOptions = document.getElementById("diet-options");

// Small helper for building elements without writing HTML strings.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function labelOf(key) {
  return INGREDIENTS[key].label;
}

// Shows a note under the ingredient box: red for problems, green for success.
function showMessage(text, isSuccess = false) {
  inputMessage.textContent = text;
  inputMessage.classList.toggle("is-success", isSuccess);
}

// Adds several ingredients, then searches once (one search per ingredient
// would send far too many requests to TheMealDB). Returns how many were added.
async function addIngredients(texts, fromFridge = false) {
  let added = 0;
  // One at a time, so each duplicate check sees the ones added before it.
  for (const text of texts) {
    if (await addIngredient(text)) {
      added += 1;
    }
  }
  if (added > 0) {
    showFridgePicks = fromFridge;
    render();
  }
  return added;
}

// Adds one ingredient to the list without searching. Returns false (and shows
// why) if it's unknown, a staple, or already in the list.
async function addIngredient(text) {
  const typed = text.trim();
  const localKey = resolveIngredient(typed, aliasIndex);
  if (localKey && INGREDIENTS[localKey].staple) {
    showMessage(`No need to add ${labelOf(localKey)}: it's assumed you have it.`);
    return false;
  }

  const phrases = [singularPhrase(typed)];
  if (localKey) {
    const info = INGREDIENTS[localKey];
    phrases.push(...[info.label, ...info.aliases].map(singularPhrase));
  }
  const uniquePhrases = [...new Set(phrases)].filter((phrase) => phrase !== "");
  const label = localKey ? labelOf(localKey) : uniquePhrases[0];

  const isDuplicate = userIngredients.some(
    (ingredient) => (localKey && ingredient.localKey === localKey) || ingredient.phrases.includes(uniquePhrases[0]),
  );
  if (isDuplicate) {
    showMessage(`${label} is already in your list.`);
    return false;
  }

  const allMealDbNames = await mealDbNamesPromise;
  const mealDbNames = allMealDbNames ? findMealDbNames(uniquePhrases, allMealDbNames) : [];
  if (!localKey && mealDbNames.length === 0) {
    showMessage(
      allMealDbNames
        ? `Sorry, no recipes use "${typed}". Check the spelling, or try a more common name for it.`
        : `Sorry, I don't know "${typed}", and the online recipe search isn't available right now.`,
    );
    return false;
  }

  userIngredients.push({ label, localKey, phrases: uniquePhrases, mealDbNames });
  return true;
}

function removeIngredient(label) {
  const index = userIngredients.findIndex((ingredient) => ingredient.label === label);
  userIngredients.splice(index, 1);
  render();
}

async function renderSuggestions() {
  const names = new Map();
  const addName = (name) => names.set(name.toLowerCase(), name.toLowerCase());
  for (const info of Object.values(INGREDIENTS)) {
    if (!info.staple) {
      [info.label, ...info.aliases].forEach(addName);
    }
  }
  (await mealDbNamesPromise)?.forEach(addName);
  const sorted = [...names.values()].sort();
  suggestions.replaceChildren(...sorted.map((name) => new Option(name)));
}

function renderQuickPicks() {
  quickPicks.replaceChildren();
  for (const key of QUICK_PICKS) {
    if (userIngredients.some((ingredient) => ingredient.localKey === key)) {
      continue;
    }
    const button = el("button", "chip chip-add", `+ ${labelOf(key)}`);
    button.type = "button";
    button.addEventListener("click", () => {
      showMessage("");
      addIngredients([labelOf(key)]);
    });
    quickPicks.append(button);
  }
}

function renderHaveList() {
  haveList.replaceChildren();
  for (const { label } of userIngredients) {
    const button = el("button", "chip chip-have", `${label} ✕`);
    button.type = "button";
    button.setAttribute("aria-label", `Remove ${label}`);
    button.addEventListener("click", () => removeIngredient(label));
    haveList.append(button);
  }
}

// Converts a ranked recipe from our own cookbook into the shared result shape.
function localToResult(match) {
  const { recipe, matchedKeys, missingKeys } = match;
  const haveKeys = userIngredients.map((ingredient) => ingredient.localKey);
  const items = recipe.ingredients.map((item) => {
    const info = INGREDIENTS[item.key];
    let status = "have";
    if (missingKeys.includes(item.key)) {
      status = "missing";
    } else if (!info.staple && !haveKeys.includes(item.key)) {
      status = "optional";
    }
    return { name: info.label, amount: item.amount, status, optional: Boolean(item.optional) };
  });
  return {
    source: "local",
    id: recipe.id,
    name: recipe.name,
    meals: recipe.meals,
    area: recipe.area,
    calories: recipe.calories,
    servings: recipe.servings,
    beginner: Boolean(recipe.beginner),
    minutes: recipe.minutes,
    cuisine: `${recipe.cuisine} · ${recipe.minutes} min`,
    image: null,
    about: recipe.about,
    items,
    steps: recipe.steps,
    tip: recipe.tip,
    matchedLabels: matchedKeys.map(labelOf),
    missingLabels: missingKeys.map(labelOf),
  };
}

// Results are grouped by how many ingredients are missing.
const RESULT_GROUPS = [
  { title: "Ready to cook", maxMissing: 0 },
  { title: "Almost there", maxMissing: 3 },
  { title: "More ideas", maxMissing: Infinity },
];

function groupIndex(result) {
  return RESULT_GROUPS.findIndex((group) => result.missingLabels.length <= group.maxMissing);
}

// Dishes with no known time sort after every timed one.
function minutesOf(result) {
  return typeof result.minutes === "number" ? result.minutes : Infinity;
}

// Fewest missing ingredients first, then the quickest, then the user's home cuisine,
// so busy cooks see what they can make soonest.
function compareByEffort(a, b) {
  return (
    a.missingLabels.length - b.missingLabels.length ||
    minutesOf(a) - minutesOf(b) ||
    Number(isHomeDish(b)) - Number(isHomeDish(a))
  );
}

function compareResults(a, b) {
  return (
    groupIndex(a) - groupIndex(b) ||
    compareByEffort(a, b) ||
    b.matchedLabels.length - a.matchedLabels.length ||
    (a.source === "local" ? -1 : 0) - (b.source === "local" ? -1 : 0) ||
    a.name.localeCompare(b.name)
  );
}

function summarizeList(names, limit) {
  if (names.length <= limit) {
    return names.join(", ");
  }
  return `${names.slice(0, limit).join(", ")} +${names.length - limit} more`;
}

// Where each dish came from, on its card and at the bottom of its recipe.
const SOURCE_LABELS = { local: "From our cookbook", mealdb: "From TheMealDB", dummyjson: "From DummyJSON" };
const SOURCE_CREDITS = { mealdb: "Recipe from TheMealDB.", dummyjson: "Recipe from the DummyJSON sample recipes." };

// "≈ 320 kcal per serving"; TheMealDB numbers are rougher, so they say so.
function calorieText(result) {
  // Favorites saved before calories existed don't carry the number; our own recipes can look it up.
  if (result.calories === undefined && result.source === "local") {
    result.calories = RECIPES.find((recipe) => recipe.id === result.id)?.calories ?? null;
  }
  if (result.calories === null || result.calories === undefined) {
    return "Calories unknown";
  }
  const rough = result.source === "mealdb" ? " (rough estimate)" : "";
  return `≈ ${result.calories} kcal per serving${rough}`;
}

// The ♡/♥ button that saves a dish to favorites or removes it.
function favoriteButton(result, className) {
  const saved = isFavorite(result.id);
  const button = el("button", className, saved ? "♥" : "♡");
  button.type = "button";
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", saved ? `Remove ${result.name} from favorites` : `Save ${result.name} to favorites`);
  button.addEventListener("click", () => toggleFavorite(result));
  return button;
}

function renderResultCard(result) {
  const wrapper = el("div", "card-wrap");
  const card = el("button", "recipe-card");
  card.type = "button";
  card.addEventListener("click", () => openRecipe(result));
  wrapper.append(card, favoriteButton(result, "card-favorite"));

  if (result.image) {
    const image = el("img", "card-image");
    image.src = result.thumbnail || result.image;
    image.alt = "";
    image.loading = "lazy";
    card.append(image);
  }
  card.append(el("span", "card-source", SOURCE_LABELS[result.source]));
  if (result.beginner) {
    card.append(el("span", "card-badge", "Beginner friendly"));
  }
  card.append(el("span", "card-title", result.name));
  if (result.cuisine) {
    card.append(el("span", "card-meta", result.cuisine));
  }
  card.append(el("span", "card-calories", calorieText(result)));
  // Saved favorites don't know what's in the kitchen now, so they skip the have/missing lines.
  // A dish found by name may use none of the user's ingredients; then just list what it needs.
  if (!result.saved) {
    const hasSome = result.matchedLabels.length > 0;
    if (hasSome) {
      card.append(el("span", "card-have", `✓ You have: ${result.matchedLabels.join(", ")}`));
    }
    if (result.missingLabels.length === 0) {
      card.append(el("span", "card-ready", "You have everything you need!"));
    } else {
      const prefix = hasSome ? "✗ Missing" : "Needs";
      card.append(el("span", "card-missing", `${prefix}: ${summarizeList(result.missingLabels, 4)}`));
    }
  }
  return wrapper;
}

function renderGroup(title, group) {
  if (group.length === 0) {
    return;
  }
  results.append(el("h3", "group-heading", `${title} (${group.length})`));
  const grid = el("div", "card-grid");
  grid.append(...group.map(renderResultCard));
  results.append(grid);
}

// After adding ingredients from the fridge: the dishes needing the fewest extra
// ingredients, quickest first. No cutoff, so a quick dish missing 3 can still show.
function renderFridgePicks(sorted) {
  if (!showFridgePicks) {
    return;
  }
  const picks = sorted.slice(0, FRIDGE_PICKS);
  if (picks.length === 0) {
    return;
  }
  const box = el("section", "exotic");
  box.append(el("h3", "exotic-heading", "Quickest with what you have"));
  box.append(el("p", "exotic-note", "Fewest extra ingredients first, then the shortest cooking time."));
  const grid = el("div", "card-grid");
  grid.append(...picks.map(renderResultCard));
  box.append(grid);
  results.append(box);
}

// Shows a few of the easiest dishes from other countries, each from a different one.
function renderExoticPicks(sorted) {
  if (!homeArea) {
    return;
  }
  const picks = [];
  const usedAreas = new Set();
  for (const result of sorted) {
    if (result.area && result.area !== "Unknown" && !isHomeDish(result) && !usedAreas.has(result.area)) {
      picks.push(result);
      usedAreas.add(result.area);
    }
    if (picks.length === EXOTIC_PICKS) {
      break;
    }
  }
  if (picks.length === 0) {
    return;
  }
  const box = el("section", "exotic");
  box.append(el("h3", "exotic-heading", "Wanna try something exotic?"));
  box.append(el("p", "exotic-note", `Dishes from outside ${homeArea} cooking that you can make with what you have.`));
  const grid = el("div", "card-grid");
  grid.append(...picks.map(renderResultCard));
  box.append(grid);
  results.append(box);
}

// Remembers the latest results so switching meal sections doesn't search again.
// note is shown instead of the dish count while searching or after an error.
function renderResultList(list, note) {
  latestResults = list;
  latestNote = note;
  drawResults();
}

function isQuick(result) {
  return typeof result.minutes === "number" && result.minutes <= QUICK_MINUTES;
}

// The latest results, narrowed by the Beginner friendly and Quick buttons when they're on.
function shownResults() {
  return latestResults.filter(
    (result) => fitsDiet(result) && (!beginnerOnly || result.beginner) && (!quickOnly || isQuick(result)),
  );
}

// Dietary needs and allergies: each one lists what it avoids (see ingredientContains).
const DIETARY_NEEDS = [
  { id: "vegetarian", label: "Vegetarian", group: "Diet", avoids: ["meat", "fish", "shellfish"] },
  { id: "vegan", label: "Vegan", group: "Diet", avoids: ["meat", "fish", "shellfish", "egg", "dairy", "honey"] },
  { id: "no-pork", label: "No pork", group: "Diet", avoids: ["pork"] },
  { id: "no-beef", label: "No beef", group: "Diet", avoids: ["beef"] },
  { id: "no-alcohol", label: "No alcohol", group: "Diet", avoids: ["alcohol"] },
  { id: "nuts", label: "Peanuts & tree nuts", group: "Allergies", avoids: ["nuts"] },
  { id: "shellfish", label: "Shellfish", group: "Allergies", avoids: ["shellfish"] },
  { id: "fish", label: "Fish", group: "Allergies", avoids: ["fish"] },
  { id: "egg", label: "Eggs", group: "Allergies", avoids: ["egg"] },
  { id: "dairy", label: "Milk & dairy", group: "Allergies", avoids: ["dairy"] },
  { id: "gluten", label: "Gluten (wheat)", group: "Allergies", avoids: ["gluten"] },
  { id: "soy", label: "Soy", group: "Allergies", avoids: ["soy"] },
  { id: "sesame", label: "Sesame", group: "Allergies", avoids: ["sesame"] },
];
const DIET_KEY = "what-can-i-cook-diet";
let dietaryNeeds = loadDietaryNeeds();

function loadDietaryNeeds() {
  try {
    const saved = JSON.parse(localStorage.getItem(DIET_KEY)) || [];
    return saved.filter((id) => DIETARY_NEEDS.some((need) => need.id === id));
  } catch {
    return [];
  }
}

function saveDietaryNeeds(ids) {
  dietaryNeeds = ids;
  try {
    localStorage.setItem(DIET_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked (private windows); the choice then lasts until the page closes.
  }
}

function avoidedTags() {
  return new Set(DIETARY_NEEDS.filter((need) => dietaryNeeds.includes(need.id)).flatMap((need) => need.avoids));
}

// Ingredients in a dish that clash with the user's dietary needs. Required ones hide the
// dish; optional ones can just be left out, so the recipe says so instead.
function dietConflicts(result) {
  const avoided = avoidedTags();
  const clashing = result.items.filter((item) => [...ingredientContains(item.name)].some((tag) => avoided.has(tag)));
  return {
    required: clashing.filter((item) => !item.optional).map((item) => item.name),
    optional: clashing.filter((item) => item.optional).map((item) => item.name),
  };
}

function fitsDiet(result) {
  return dietConflicts(result).required.length === 0;
}

// "Dietary needs: Vegetarian, Eggs · Edit" under the title.
function renderDietLine() {
  dietLine.replaceChildren();
  const labels = DIETARY_NEEDS.filter((need) => dietaryNeeds.includes(need.id)).map((need) => need.label);
  const button = el("button", "link-button", labels.length > 0 ? "Edit" : "Set dietary needs or allergies");
  button.type = "button";
  button.addEventListener("click", openDietDialog);
  if (labels.length > 0) {
    dietLine.append(`Dietary needs: ${labels.join(", ")} · `);
  }
  dietLine.append(button);
}

function openDietDialog() {
  dietOptions.replaceChildren();
  for (const group of ["Diet", "Allergies"]) {
    const fieldset = el("fieldset", "fridge-group");
    fieldset.append(el("legend", null, group));
    for (const need of DIETARY_NEEDS.filter((item) => item.group === group)) {
      const option = el("label", "fridge-item");
      const box = el("input");
      box.type = "checkbox";
      box.value = need.id;
      box.checked = dietaryNeeds.includes(need.id);
      option.append(box, el("span", null, need.label));
      fieldset.append(option);
    }
    dietOptions.append(fieldset);
  }
  dietDialog.showModal();
}

function filterToggle(label, note, isOn, onToggle) {
  const toggle = el("button", "filter-toggle", isOn ? `✓ ${label}` : label);
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", String(isOn));
  toggle.append(el("span", "filter-note", note));
  toggle.addEventListener("click", () => {
    onToggle();
    drawResults();
  });
  return toggle;
}

// Beginner friendly and Quick at the top of the results; turning both on gives quick, easy dishes.
function renderFilters() {
  const row = el("div", "filter-row");
  row.append(
    filterToggle("Beginner friendly", "Few steps, few ingredients, no tricky techniques", beginnerOnly, () => {
      beginnerOnly = !beginnerOnly;
    }),
    filterToggle("Quick", `Ready in ${QUICK_MINUTES} minutes or less`, quickOnly, () => {
      quickOnly = !quickOnly;
    }),
  );
  results.append(row);
}

function renderMealTabs() {
  mealTabs.replaceChildren();
  for (const section of MEAL_SECTIONS) {
    const count = shownResults().filter((result) => section.id === "all" || result.meals.includes(section.id)).length;
    const button = el("button", "meal-tab", userIngredients.length > 0 ? `${section.label} (${count})` : section.label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(section.id === selectedMeal));
    button.addEventListener("click", () => {
      selectedMeal = section.id;
      drawResults();
    });
    mealTabs.append(button);
  }
  const favoritesTab = el("button", "meal-tab favorites-tab", `♥ Favorites (${favorites.length})`);
  favoritesTab.type = "button";
  favoritesTab.setAttribute("aria-pressed", String(selectedMeal === "favorites"));
  favoritesTab.addEventListener("click", () => {
    selectedMeal = "favorites";
    drawResults();
  });
  mealTabs.append(favoritesTab);
}

// Saved dishes, newest first. Works without any ingredients entered.
function drawFavorites() {
  if (favorites.length === 0) {
    results.append(el("p", "empty-state", "No favorites yet. Tap ♡ on any dish to save it here."));
    return;
  }
  results.append(el("p", "search-status", `${favorites.length} saved dish${favorites.length === 1 ? "" : "es"}.`));
  const grid = el("div", "card-grid");
  grid.append(...[...favorites].reverse().map(renderResultCard));
  results.append(grid);
}

function drawResults() {
  renderMealTabs();
  results.replaceChildren();
  if (selectedMeal === "favorites") {
    drawFavorites();
    return;
  }
  const byName = searchMode === "name";
  if (byName && nameQuery === "") {
    results.append(el("p", "empty-state", "Type a dish name above, like mapo tofu or pancakes, and press Search."));
    return;
  }
  if (!byName && userIngredients.length === 0) {
    results.append(el("p", "empty-state", "Add any ingredients above to see dishes. Try tomato and egg to start!"));
    return;
  }
  const section = MEAL_SECTIONS.find((item) => item.id === selectedMeal);
  const list = shownResults().filter((result) => selectedMeal === "all" || result.meals.includes(selectedMeal));
  const filterWords = [quickOnly && "quick", beginnerOnly && "beginner-friendly"].filter(Boolean).join(", ");
  const mealName = (filterWords ? ` ${filterWords}` : "") + (selectedMeal === "all" ? "" : ` ${section.noun}`);
  const hiddenByDiet = latestResults.filter((result) => !fitsDiet(result)).length;
  const dietText = hiddenByDiet > 0 ? ` Hiding ${hiddenByDiet} that don't fit your dietary needs.` : "";
  const named = byName ? ` matching "${nameQuery}"` : "";
  const countText = `Found ${list.length}${mealName} dish${list.length === 1 ? "" : "es"}${named}.${dietText}`;
  const sorted = [...list].sort(compareResults);
  renderFilters();
  // Suggestions from other countries only make sense when searching by ingredient.
  if (!byName) {
    renderFridgePicks([...sorted].sort(compareByEffort));
    renderExoticPicks(sorted);
  }
  results.append(el("p", "search-status", latestNote || countText));
  if (list.length === 0) {
    if (latestNote !== SEARCHING_NOTE) {
      let advice = "No dishes use these ingredients. Try adding something else, like egg or chicken.";
      if (byName && latestResults.length === 0) {
        advice = `No dishes called "${nameQuery}". Check the spelling, or try a shorter name like "tofu".`;
      } else if (beginnerOnly || quickOnly) {
        advice = `No${mealName} dishes use these ingredients. Turn off Beginner friendly or Quick to see more.`;
      } else if (selectedMeal !== "all") {
        advice = `No${mealName} dishes use these ingredients. Try another section, or add more ingredients.`;
      }
      results.append(el("p", "empty-state", advice));
    }
    return;
  }
  RESULT_GROUPS.forEach((group, index) => {
    renderGroup(group.title, sorted.filter((result) => groupIndex(result) === index));
  });
}

async function renderResults() {
  const thisSearch = ++searchCount;
  if (userIngredients.length === 0) {
    renderResultList([], "");
    return;
  }

  const localKeys = userIngredients.map((ingredient) => ingredient.localKey).filter(Boolean);
  const localResults = rankRecipes(RECIPES, INGREDIENTS, localKeys).map(localToResult);
  const searchable = userIngredients.filter((ingredient) => ingredient.mealDbNames.length > 0);

  renderResultList(localResults, SEARCHING_NOTE);
  const online = await searchOnline(
    searchable.length > 0 ? searchMealDb(searchable, homeArea) : Promise.resolve([]),
    searchDummyJson(userIngredients),
  );
  // A newer search started while this one was waiting; let that one draw.
  if (thisSearch !== searchCount) {
    return;
  }
  renderResultList([...localResults, ...online.results], online.note);
}

// Waits for both online sources. If TheMealDB can't be reached, the rest still shows,
// with a note saying why there are fewer dishes. (DummyJSON gives [] when unreachable.)
async function searchOnline(mealDbSearch, dummyJsonSearch) {
  const [mealDb, dummyJson] = await Promise.allSettled([mealDbSearch, dummyJsonSearch]);
  const results = [mealDb, dummyJson].filter((outcome) => outcome.status === "fulfilled").flatMap((outcome) => outcome.value);
  const note =
    mealDb.status === "rejected"
      ? "Couldn't reach TheMealDB, so some dishes are missing. Check your internet connection and try again."
      : "";
  return { results, note };
}

// Adds a heading and a checklist of ingredients (✓ have, ✗ missing, ○ optional, • saved) to the recipe view.
// Amounts are multiplied by factor when the user changes the number of servings.
function appendIngredientGroup(container, title, items, factor) {
  if (items.length === 0) {
    return;
  }
  container.append(el("h3", null, title));
  const list = el("ul", "ingredient-list");
  for (const item of items) {
    const status = item.status === "staple" ? "have" : item.status;
    const symbol = { have: "✓", missing: "✗", optional: "○", plain: "•" }[status];
    const row = el("li", `ingredient-${status}`);
    row.append(el("span", "ingredient-symbol", symbol));
    row.append(el("span", null, formatIngredientLine(item.name, scaleAmount(item.amount || "", factor))));
    if (item.optional) {
      row.append(el("span", "optional-tag", "optional"));
    }
    list.append(row);
  }
  container.append(list);
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;
// Recipes open scaled for one person, since most people cook for themselves.
const DEFAULT_SERVINGS = 1;

// How many people a recipe's amounts feed. Favorites saved before servings existed
// look it up (our recipes) or use the usual TheMealDB guess.
function originalServings(result) {
  return result.servings ?? RECIPES.find((recipe) => recipe.id === result.id)?.servings ?? MEALDB_SERVINGS;
}

function hasAmounts(result) {
  return result.items.some((item) => item.amount);
}

// "Servings: − 2 +" above the ingredients; changing it redraws the amounts below and
// calls onChange(factor) so the steps can follow. Recipes that list no amounts can't
// be scaled, so they just say so.
function renderServingsAndIngredients(result, onChange) {
  const original = originalServings(result);
  let servings = DEFAULT_SERVINGS;
  const section = el("div", "servings-section");
  const ingredientsBox = el("div");

  if (!hasAmounts(result)) {
    section.append(el("p", "servings-note", `Serves ${original}. This recipe doesn't list amounts for its ingredients.`), ingredientsBox);
    appendIngredientGroup(ingredientsBox, "Ingredients", result.items.filter((item) => !isSeasoning(item.name)), 1);
    appendIngredientGroup(ingredientsBox, "Seasonings", result.items.filter((item) => isSeasoning(item.name)), 1);
    detail.append(section);
    onChange(1);
    return;
  }

  const control = el("div", "servings-control");
  const fewer = el("button", "servings-button", "−");
  const more = el("button", "servings-button", "+");
  const count = el("span", "servings-count");
  count.setAttribute("aria-live", "polite");
  fewer.type = "button";
  more.type = "button";
  fewer.setAttribute("aria-label", "Fewer servings");
  more.setAttribute("aria-label", "More servings");
  control.append(el("span", "servings-label", "Servings"), fewer, count, more);

  function update() {
    const factor = servings / original;
    count.textContent = String(servings);
    fewer.disabled = servings <= MIN_SERVINGS;
    more.disabled = servings >= MAX_SERVINGS;
    ingredientsBox.replaceChildren();
    appendIngredientGroup(ingredientsBox, "Ingredients", result.items.filter((item) => !isSeasoning(item.name)), factor);
    appendIngredientGroup(ingredientsBox, "Seasonings", result.items.filter((item) => isSeasoning(item.name)), factor);
    onChange(factor);
  }
  fewer.addEventListener("click", () => {
    servings = Math.max(MIN_SERVINGS, servings - 1);
    update();
  });
  more.addEventListener("click", () => {
    servings = Math.min(MAX_SERVINGS, servings + 1);
    update();
  });

  section.append(control, ingredientsBox);
  detail.append(section);
  update();
}

// Steps ticked off while cooking, by recipe id: kept when the recipe is closed and
// reopened, cleared when the page reloads.
const tickedSteps = new Map();

// One step of a recipe, with a checkbox to tick it off; headings have none.
function stepItem(recipeId, step, index) {
  if (isStepHeading(step)) {
    return el("li", "step-heading", step);
  }
  if (!tickedSteps.has(recipeId)) {
    tickedSteps.set(recipeId, new Set());
  }
  const ticked = tickedSteps.get(recipeId);
  const item = el("li");
  const label = el("label", "step-label");
  const box = el("input");
  box.type = "checkbox";
  box.checked = ticked.has(index);
  box.addEventListener("change", () => {
    if (box.checked) {
      ticked.add(index);
    } else {
      ticked.delete(index);
    }
  });
  label.append(box, el("span", null, step));
  item.append(label);
  return item;
}

function openRecipe(result) {
  detail.replaceChildren();

  const closeButton = el("button", "close-button", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close recipe");
  closeButton.addEventListener("click", () => dialog.close());
  detail.append(closeButton);

  const title = el("h2", "detail-title", result.name);
  title.id = "dialog-title";
  detail.append(title);
  const actions = el("div", "detail-actions");
  const madeButton = el("button", "made-button");
  madeButton.type = "button";
  // A check mark that draws itself when pressed (the SVG is fixed text, not user input).
  madeButton.innerHTML =
    '<svg class="made-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  const madeText = el("span", null, "I made this");
  madeButton.append(madeText);
  madeButton.addEventListener("click", () => {
    recordCooked(result);
    madeText.textContent = "Added to your history";
    // Restart the animation if it's pressed again.
    madeButton.classList.remove("made-done");
    void madeButton.offsetWidth;
    madeButton.classList.add("made-done");
  });
  actions.append(detailFavoriteButton(result), madeButton);
  detail.append(actions);
  // Looked up by id, not stored on the result, so favorites saved earlier get stories too.
  const story = result.source === "local" ? DISH_STORIES[result.id] : null;
  if (story) {
    const storyButton = el("button", "story-button", "📖 Story behind the dish");
    storyButton.type = "button";
    storyButton.setAttribute("aria-expanded", "false");
    const storyPanel = el("p", "dish-story", story);
    storyPanel.hidden = true;
    storyButton.addEventListener("click", () => {
      storyPanel.hidden = !storyPanel.hidden;
      storyButton.setAttribute("aria-expanded", String(!storyPanel.hidden));
    });
    actions.append(storyButton);
    detail.append(storyPanel);
  }
  if (result.cuisine) {
    detail.append(el("p", "card-meta", result.cuisine));
  }
  const calories = el("p", "detail-calories", calorieText(result));
  // Favorites saved before calories existed have neither number, so they get no note.
  if (result.source === "mealdb" && result.calories !== undefined) {
    calories.append(
      el(
        "span",
        "calorie-note",
        result.calories === null
          ? " Too many ingredient amounts couldn't be read to estimate it."
          : ` Estimated from the ingredient list, assuming ${result.servings} servings.`,
      ),
    );
  }
  detail.append(calories);
  if (result.image) {
    const image = el("img", "detail-image");
    image.src = result.image;
    image.alt = result.name;
    detail.append(image);
  }
  if (result.about) {
    detail.append(el("p", "detail-about", result.about));
  }
  // Favorites can be opened even if they clash, so the recipe itself says what to watch for.
  const conflicts = dietConflicts(result);
  if (conflicts.required.length > 0) {
    detail.append(el("p", "diet-warning", `Doesn't fit your dietary needs: contains ${conflicts.required.join(", ")}.`));
  }
  if (conflicts.optional.length > 0) {
    detail.append(el("p", "diet-warning", `For your dietary needs, leave out: ${conflicts.optional.join(", ")}.`));
  }

  // The steps show the amounts for the chosen servings, like the ingredient list.
  const ingredientNames = result.items.map((item) => item.name);
  const stepList = el("ol", "step-list");
  let servingsFactor = 1;
  function scaledSteps() {
    return result.steps.map((step) => scaleStepAmounts(step, servingsFactor, ingredientNames));
  }
  renderServingsAndIngredients(result, (factor) => {
    servingsFactor = factor;
    stepList.replaceChildren(...scaledSteps().map((step, index) => stepItem(result.id, step, index)));
  });

  detail.append(el("h3", null, "How to cook it"));
  const cookButton = el("button", "cook-button", "▶ Start cooking: one step at a time");
  cookButton.type = "button";
  cookButton.addEventListener("click", () => startCooking(result, scaledSteps()));
  detail.append(cookButton);
  detail.append(stepList);

  if (result.tip) {
    const tip = el("p", "detail-tip");
    tip.append(el("strong", null, "Tip: "), result.tip);
    detail.append(tip);
  }

  if (result.source !== "local") {
    const links = el("p", "detail-links");
    links.append(SOURCE_CREDITS[result.source]);
    for (const [url, text] of [
      [result.video, "Watch the video"],
      [result.sourceUrl, "Original recipe"],
    ]) {
      if (url && url.startsWith("https://")) {
        const link = el("a", null, text);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        links.append(" ", link);
      }
    }
    detail.append(links);
  }

  dialog.showModal();
  detail.scrollTop = 0;
}

// The search started by the latest render, so other windows (the receipt scanner)
// can wait for its results.
let latestSearch = Promise.resolve();

function render() {
  renderQuickPicks();
  renderHaveList();
  // In dish-name mode, re-run the name search so have/missing reflects the new ingredients.
  latestSearch = searchMode === "name" ? runNameSearch() : renderResults();
}

// Looks dishes up by name in our cookbook and TheMealDB, still showing what the user has.
async function runNameSearch() {
  const thisSearch = ++searchCount;
  if (nameQuery === "") {
    renderResultList([], "");
    return;
  }
  const localKeys = userIngredients.map((ingredient) => ingredient.localKey).filter(Boolean);
  const localResults = searchRecipesByName(RECIPES, nameQuery)
    .map((recipe) => localToResult(matchRecipe(recipe, INGREDIENTS, localKeys)));
  renderResultList(localResults, SEARCHING_NOTE);
  const online = await searchOnline(
    searchMealDbByName(nameQuery, userIngredients),
    searchDummyJsonByName(nameQuery, userIngredients),
  );
  if (thisSearch !== searchCount) {
    return;
  }
  renderResultList([...localResults, ...online.results], online.note);
}

// Switches the input box between adding ingredients and looking up a dish by name.
function setSearchMode(mode) {
  searchMode = mode;
  for (const tab of document.querySelectorAll(".mode-tab")) {
    tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
  }
  const byName = mode === "name";
  input.placeholder = byName ? "Dish name, e.g. mapo tofu" : "Any ingredient, e.g. salmon";
  ingredientLabel.textContent = byName ? "Search for a dish by name" : "Add an ingredient";
  searchButton.textContent = byName ? "Search" : "Add";
  // Ingredient suggestions would only get in the way of typing a dish name.
  if (byName) {
    input.removeAttribute("list");
  } else {
    input.setAttribute("list", "ingredient-suggestions");
    nameQuery = "";
  }
  input.value = "";
  showMessage("");
  input.focus();
  render();
}

for (const tab of document.querySelectorAll(".mode-tab")) {
  tab.addEventListener("click", () => setSearchMode(tab.dataset.mode));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  if (searchMode === "name") {
    const query = input.value.trim();
    if (query === "") {
      showMessage("Type a dish name, like mapo tofu or pancakes.");
      return;
    }
    nameQuery = query;
    await runNameSearch();
    return;
  }
  const parts = input.value.split(",").filter((part) => part.trim() !== "");
  input.value = "";
  input.focus();
  await addIngredients(parts);
});

// "What's in My Fridge?": show the user's photo next to a checklist, then add what they tick.
const fridgeDialog = document.getElementById("fridge-dialog");
const fridgeForm = document.getElementById("fridge-form");
const fridgePhoto = document.getElementById("fridge-photo");
const fridgePreview = document.getElementById("fridge-preview");
const fridgeChecklist = document.getElementById("fridge-checklist");
const fridgeMessage = document.getElementById("fridge-message");
const fridgeAdd = document.getElementById("fridge-add");

function isInList(name) {
  return userIngredients.some((ingredient) => ingredient.phrases.includes(singularPhrase(name)) || ingredient.label === name);
}

function checkedFridgeItems() {
  return [...fridgeChecklist.querySelectorAll("input:checked:not(:disabled)")].map((box) => box.value);
}

function updateFridgeAddButton() {
  const count = checkedFridgeItems().length;
  fridgeAdd.textContent = count > 0 ? `Add ${count} ingredient${count === 1 ? "" : "s"}` : "Add selected";
}

function renderFridgeChecklist() {
  fridgeChecklist.replaceChildren();
  for (const { group, items } of FRIDGE_CHECKLIST) {
    const fieldset = el("fieldset", "fridge-group");
    fieldset.append(el("legend", null, group));
    for (const name of items) {
      const option = el("label", "fridge-item");
      const box = el("input");
      box.type = "checkbox";
      box.value = name;
      // Already in the list: shown ticked so the user doesn't wonder where it went.
      if (isInList(name)) {
        box.checked = true;
        box.disabled = true;
        option.title = "Already in your list";
      }
      box.addEventListener("change", updateFridgeAddButton);
      option.append(box, el("span", null, name));
      fieldset.append(option);
    }
    fridgeChecklist.append(fieldset);
  }
  updateFridgeAddButton();
}

document.getElementById("fridge-button").addEventListener("click", () => {
  fridgeMessage.textContent = "";
  renderFridgeChecklist();
  fridgeDialog.showModal();
});

fridgePhoto.addEventListener("change", () => {
  const file = fridgePhoto.files[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    fridgeMessage.textContent = "That file isn't a photo. Please choose an image.";
    return;
  }
  if (fridgePreview.src) {
    URL.revokeObjectURL(fridgePreview.src);
  }
  fridgePreview.src = URL.createObjectURL(file);
  fridgePreview.hidden = false;
  fridgeMessage.textContent = "";
});

fridgeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const chosen = checkedFridgeItems();
  if (chosen.length === 0) {
    fridgeMessage.textContent = "Tick at least one ingredient you can see, or choose Cancel.";
    return;
  }
  fridgeDialog.close();
  showMessage("");
  const added = await addIngredients(chosen, true);
  if (added > 0) {
    showMessage(`Added ${added} ingredient${added === 1 ? "" : "s"} from your fridge.`, true);
  }
});

document.getElementById("fridge-cancel").addEventListener("click", () => fridgeDialog.close());

// The profile panel on the right: favorites and the history of dishes made.
const profileDialog = document.getElementById("profile-dialog");
const profileFavorites = document.getElementById("profile-favorites");
const profileHistory = document.getElementById("profile-history");

// One dish in the panel; clicking it opens the recipe.
function profileItem(result, meta) {
  const item = el("button", "profile-item");
  item.type = "button";
  item.append(el("span", "profile-item-name", result.name), el("span", "profile-item-meta", meta));
  item.addEventListener("click", () => openRecipe(result));
  return item;
}

function renderProfile() {
  profileFavorites.replaceChildren(
    ...(favorites.length === 0
      ? [el("p", "profile-empty", "No favorites yet. Tap ♡ on any dish to save it here.")]
      : [...favorites].reverse().map((favorite) => profileItem(favorite, favorite.cuisine || ""))),
  );
  profileHistory.replaceChildren(
    ...(cookedHistory.length === 0
      ? [el("p", "profile-empty", "Nothing made yet. Press \"✓ I made this\" in a recipe, or finish one in cooking mode.")]
      : cookedHistory.map((entry) => profileItem(entry, cookedDateText(entry.cookedAt)))),
  );
}

document.getElementById("profile-button").addEventListener("click", () => {
  renderProfile();
  profileDialog.showModal();
});
document.getElementById("profile-close").addEventListener("click", () => profileDialog.close());
// Clicking the dimmed page outside the panel closes it too.
profileDialog.addEventListener("click", (event) => {
  if (event.target === profileDialog) {
    profileDialog.close();
  }
});

dietForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const chosen = [...dietOptions.querySelectorAll("input:checked")].map((box) => box.value);
  saveDietaryNeeds(chosen);
  dietDialog.close();
  renderDietLine();
  // Only filtering changes, so there's no need to search again.
  drawResults();
});
document.getElementById("diet-cancel").addEventListener("click", () => dietDialog.close());

// Close the recipe when clicking the dark area outside it.
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

// Shows which cuisine comes first, with a button to change it.
function renderHomeLine() {
  homeLine.replaceChildren();
  const button = el("button", "link-button", homeArea ? "Change" : "Choose your home cuisine");
  button.type = "button";
  button.addEventListener("click", openWelcome);
  if (homeArea) {
    homeLine.append(`Showing ${homeArea} food first · `);
  }
  homeLine.append(button);
}

// All nationalities TheMealDB knows, or just our own recipes' ones when offline.
const areaNamesPromise = fetchAreaNames().catch(() => [...new Set(RECIPES.map((recipe) => recipe.area))].sort());

// Shown before the user types anything.
const POPULAR_AREAS = ["Chinese", "American", "Indian", "Japanese", "South Korean", "Mexican", "Italian", "British"];
const MAX_AREA_OPTIONS = 8;

// Lists the nationalities matching the search box as buttons to pick from.
async function renderHomeOptions() {
  const areas = await areaNamesPromise;
  const query = homeSearch.value;
  const matches = query.trim() === "" ? POPULAR_AREAS.filter((area) => areas.includes(area)) : searchAreas(query, areas, MAX_AREA_OPTIONS);
  homeOptions.replaceChildren();
  for (const area of matches) {
    const option = el("button", "home-option", area);
    option.type = "button";
    option.setAttribute("aria-pressed", String(area === pickedArea));
    option.addEventListener("click", () => {
      pickedArea = area;
      homeSearch.value = area;
      homeMessage.textContent = "";
      renderHomeOptions();
    });
    homeOptions.append(option);
  }
  homeMessage.textContent =
    matches.length === 0 ? `No nationality matches "${query.trim()}". Try another spelling, like "Chinese" or "Japan".` : "";
}

function openWelcome() {
  pickedArea = homeArea || null;
  homeSearch.value = homeArea || "";
  homeMessage.textContent = "";
  renderHomeOptions();
  welcomeDialog.showModal();
  homeSearch.focus();
}

function setHomeArea(area) {
  saveHomeArea(area);
  welcomeDialog.close();
  renderHomeLine();
  renderResults();
}

homeSearch.addEventListener("input", () => {
  pickedArea = null;
  renderHomeOptions();
});

welcomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Use the clicked option, or else the best match for what was typed.
  const choice = pickedArea || searchAreas(homeSearch.value, await areaNamesPromise, 1)[0];
  if (!choice) {
    homeMessage.textContent = "Type your nationality and pick it from the list, or choose Skip for now.";
    return;
  }
  setHomeArea(choice);
});
welcomeSkip.addEventListener("click", () => setHomeArea(""));
// Escape skips on the first visit; when changing an earlier choice, it keeps that choice.
welcomeDialog.addEventListener("cancel", () => {
  if (homeArea === null) {
    setHomeArea("");
  }
});

renderSuggestions();
renderHomeLine();
renderDietLine();
render();
if (homeArea === null) {
  openWelcome();
}
