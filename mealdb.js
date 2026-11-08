// Talking to TheMealDB (https://www.themealdb.com), a free online recipe database,
// and turning its meals into the same shape as our own recipes.
//
// The free API can only filter by one ingredient at a time, so a search sends one
// request per ingredient name and merges the results here.

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1/";
const MAX_NAMES_PER_INGREDIENT = 8;
const MAX_DETAILED_MEALS = 24;
const MAX_PER_CATEGORY = 6;

// Ingredients we assume everyone has; never counted as missing.
const MEALDB_STAPLES = new Set([
  "salt",
  "pepper",
  "black pepper",
  "water",
  "oil",
  "olive oil",
  "vegetable oil",
  "sunflower oil",
  "sugar",
]);

// Which meals each TheMealDB category suits. Every other category (main dishes,
// starters, sides) goes in both lunch and dinner, because the database doesn't tell them apart.
const CATEGORY_MEALS = {
  Breakfast: ["breakfast"],
  Dessert: ["dessert"],
};
const MAIN_DISH_MEALS = ["lunch", "dinner"];

const responseCache = new Map();

async function fetchMealDb(path) {
  if (!responseCache.has(path)) {
    const request = fetch(MEALDB_BASE + path).then((response) => {
      if (!response.ok) {
        throw new Error(`TheMealDB returned ${response.status}`);
      }
      return response.json();
    });
    // Forget failed requests so the next search can try again.
    request.catch(() => responseCache.delete(path));
    responseCache.set(path, request);
  }
  return responseCache.get(path);
}

// True if an ingredient phrase is one of the phrases, or a kind of one
// ("cherry tomato" counts as "tomato" because it ends with it).
function phraseMatches(phrase, phrases) {
  return phrases.some((wanted) => phrase === wanted || phrase.endsWith(" " + wanted));
}

async function fetchIngredientNames() {
  const data = await fetchMealDb("list.php?i=list");
  return data.meals.map((item) => item.strIngredient);
}

// Picks the TheMealDB ingredient names to search for, given the user's phrases.
// Exact matches come first, then more specific kinds ("cherry tomatoes").
function findMealDbNames(phrases, allNames) {
  const exact = [];
  const kinds = [];
  for (const name of allNames) {
    const phrase = singularPhrase(name);
    if (phrases.includes(phrase)) {
      exact.push(name);
    } else if (phraseMatches(phrase, phrases)) {
      kinds.push(name);
    }
  }
  kinds.sort((a, b) => a.length - b.length);
  return [...exact, ...kinds].slice(0, MAX_NAMES_PER_INGREDIENT);
}

function mealIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    if (name !== "") {
      items.push({ name, amount: (meal[`strMeasure${i}`] || "").trim() });
    }
  }
  return items;
}

// Splits the instruction text into steps, dropping "STEP 1" style headings and numbering.
function mealSteps(instructions) {
  return instructions
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:step\s*\d+[.):]?|\d+[.)])\s*/i, "").trim())
    // Drop leftover step numbers written on their own line ("2", "Step 3").
    .filter((line) => line !== "" && !/^(step\s*)?\d*$/i.test(line));
}

// TheMealDB doesn't rate difficulty, so we guess: few steps, few ingredients, and
// none of the techniques that trip up new cooks.
const BEGINNER_MAX_STEPS = 6;
const BEGINNER_MAX_INGREDIENTS = 10;
const TRICKY_TECHNIQUES = /deep[- ]?fr|caramel|knead|proof|temper|flamb|pastry/i;

function isBeginnerMeal(items, steps) {
  const realSteps = steps.filter((step) => !isStepHeading(step));
  return (
    realSteps.length <= BEGINNER_MAX_STEPS &&
    items.length <= BEGINNER_MAX_INGREDIENTS &&
    !steps.some((step) => TRICKY_TECHNIQUES.test(step))
  );
}

// TheMealDB has no cooking times either, so we estimate one: the times written
// in the steps ("simmer for 10 minutes", "bake 30-35 mins", "1 hour") plus some
// prep for chopping. Steps with no time written count a few minutes each.
const PREP_MINUTES = 5;
const PREP_MINUTES_PER_INGREDIENT = 1;
const MINUTES_PER_UNTIMED_STEP = 4;
const DURATION_PATTERN = /(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?)\b/gi;

function estimateMinutes(items, steps) {
  let written = 0;
  let untimedSteps = 0;
  for (const step of steps.filter((line) => !isStepHeading(line))) {
    const durations = [...step.matchAll(DURATION_PATTERN)];
    if (/overnight/i.test(step)) {
      written += 8 * 60;
    }
    if (durations.length === 0) {
      untimedSteps += 1;
    }
    for (const [, low, high, unit] of durations) {
      // For a range like "30-35 minutes", plan for the longer end.
      const amount = Number(high || low);
      written += unit.toLowerCase().startsWith("h") ? amount * 60 : amount;
    }
  }
  const total =
    PREP_MINUTES + items.length * PREP_MINUTES_PER_INGREDIENT + written + untimedSteps * MINUTES_PER_UNTIMED_STEP;
  return Math.round(total / 5) * 5;
}

// Converts a full TheMealDB meal into a search result, given the user's ingredients.
function mealToResult(meal, userIngredients) {
  const items = mealIngredients(meal).map((item) => {
    const phrase = singularPhrase(item.name);
    const owner = userIngredients.find((ingredient) => phraseMatches(phrase, ingredient.phrases));
    let status = "missing";
    if (owner) {
      status = "have";
    } else if (MEALDB_STAPLES.has(phrase)) {
      status = "staple";
    }
    return { ...item, status, ownerLabel: owner ? owner.label : null };
  });
  const matchedLabels = [...new Set(items.filter((item) => item.ownerLabel).map((item) => item.ownerLabel))];
  const servings = meal.strCategory === "Dessert" ? MEALDB_DESSERT_SERVINGS : MEALDB_SERVINGS;
  const steps = mealSteps(meal.strInstructions || "");
  const minutes = estimateMinutes(items, steps);
  const origin = [meal.strArea, meal.strCategory].filter((part) => part && part !== "Unknown");
  const cuisine = [...origin, `≈ ${minutes} min`].join(" · ");
  return {
    source: "mealdb",
    id: `mealdb-${meal.idMeal}`,
    name: meal.strMeal,
    meals: CATEGORY_MEALS[meal.strCategory] || MAIN_DISH_MEALS,
    area: meal.strArea,
    servings,
    calories: estimateCaloriesPerServing(items, servings),
    cuisine,
    image: meal.strMealThumb,
    // A 350px version for cards; the full photo is used in the recipe view.
    thumbnail: `${meal.strMealThumb}/medium`,
    about: origin.length > 0 ? `A ${meal.strArea !== "Unknown" ? meal.strArea + " " : ""}${(meal.strCategory || "").toLowerCase()} dish.` : "",
    items,
    steps,
    beginner: isBeginnerMeal(items, steps),
    minutes,
    video: meal.strYoutube || null,
    sourceUrl: meal.strSource || null,
    matchedLabels,
    missingLabels: items.filter((item) => item.status === "missing").map((item) => item.name.toLowerCase()),
  };
}

// Returns the ids of every meal matching a filter ("c=Dessert" for a category,
// "a=Chinese" for an area), or an empty set if that list can't be loaded
// (the search still works without it).
async function fetchFilterIds(filter) {
  try {
    const data = await fetchMealDb(`filter.php?${filter}`);
    return new Set((data.meals || []).map((meal) => meal.idMeal));
  } catch {
    return new Set();
  }
}

// The areas (countries) TheMealDB has dishes from, e.g. "Chinese", "Italian".
async function fetchAreaNames() {
  const data = await fetchMealDb("list.php?a=list");
  const names = data.meals.map((item) => item.strArea).filter((name) => name && name !== "Unknown");
  return [...new Set(names)].sort();
}

// Searches TheMealDB by dish name ("mapo tofu"). Its name search returns full meals,
// so no separate look-ups are needed.
async function searchMealDbByName(query, userIngredients) {
  const data = await fetchMealDb(`search.php?s=${encodeURIComponent(query.trim())}`);
  return (data.meals || []).map((meal) => mealToResult(meal, userIngredients));
}

// Searches TheMealDB for meals using any of the user's ingredients.
// Meals using more of them are looked up in detail first. homeArea (e.g. "Chinese",
// or null) gets some reserved room so the user's own cuisine always shows up.
async function searchMealDb(userIngredients, homeArea) {
  const hits = new Map();
  await Promise.all(
    userIngredients.map(async (ingredient) => {
      const lists = await Promise.all(
        ingredient.mealDbNames.map((name) => fetchMealDb(`filter.php?i=${encodeURIComponent(name)}`)),
      );
      for (const list of lists) {
        for (const meal of list.meals || []) {
          if (!hits.has(meal.idMeal)) {
            hits.set(meal.idMeal, new Set());
          }
          hits.get(meal.idMeal).add(ingredient.label);
        }
      }
    }),
  );
  // Most-matching meals first; ties broken by id so the same search always gives the same results.
  const rankedIds = [...hits.entries()]
    .sort((a, b) => b[1].size - a[1].size || Number(a[0]) - Number(b[0]))
    .map(([id]) => id);
  const chosenIds = new Set(rankedIds.slice(0, MAX_DETAILED_MEALS));
  // Also take the best few breakfasts, desserts, and home-cuisine dishes, so they
  // aren't crowded out by everything else.
  const reservedFilters = Object.keys(CATEGORY_MEALS).map((category) => `c=${encodeURIComponent(category)}`);
  if (homeArea) {
    reservedFilters.push(`a=${encodeURIComponent(homeArea)}`);
  }
  for (const filter of reservedFilters) {
    const filterIds = await fetchFilterIds(filter);
    rankedIds
      .filter((id) => filterIds.has(id))
      .slice(0, MAX_PER_CATEGORY)
      .forEach((id) => chosenIds.add(id));
  }
  const details = await Promise.all([...chosenIds].map((id) => fetchMealDb(`lookup.php?i=${id}`)));
  return details
    .map((data) => data.meals && data.meals[0])
    .filter(Boolean)
    .map((meal) => mealToResult(meal, userIngredients));
}

if (typeof module !== "undefined") {
  module.exports = { phraseMatches, findMealDbNames, mealSteps, isBeginnerMeal, estimateMinutes, mealToResult };
}
