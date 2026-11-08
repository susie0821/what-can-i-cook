// DummyJSON (https://dummyjson.com/docs/recipes): a free set of about 50 sample
// recipes with photos, times, servings, difficulty, and calories. Its ingredient
// lists have no amounts ("Tofu, cubed"), so they can't be scaled.

const DUMMYJSON_URL = "https://dummyjson.com/recipes?limit=0";

// Its cuisine names, mapped to the nationality words the rest of the app uses
// (so "Wanna try something exotic?" and home cuisine work). Null means no one country.
const DUMMYJSON_AREAS = {
  Korean: "South Korean",
  Hawaiian: "American",
  Mediterranean: null,
  Asian: null,
};

// Its meal types, mapped to our sections. Drinks don't belong in a cooking app.
const DUMMYJSON_MEALS = {
  Breakfast: ["breakfast"],
  Lunch: ["lunch"],
  Dinner: ["dinner"],
  Snacks: ["lunch", "dinner"],
  Appetizer: ["lunch", "dinner"],
  "Side Dish": ["lunch", "dinner"],
  Dessert: ["dessert"],
};
const SKIPPED_CUISINES = new Set(["Cocktail", "Smoothie"]);

// The whole collection, loaded once. Resolves to [] if it can't be reached, since
// the other sources still work without it.
let dummyJsonRecipes = null;

function loadDummyJsonRecipes() {
  if (!dummyJsonRecipes) {
    dummyJsonRecipes = fetch(DUMMYJSON_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`DummyJSON returned ${response.status}`);
        }
        return response.json();
      })
      .then((data) => data.recipes.filter((recipe) => !SKIPPED_CUISINES.has(recipe.cuisine)))
      .catch(() => {
        dummyJsonRecipes = null;
        return [];
      });
  }
  return dummyJsonRecipes;
}

// "Tofu, cubed" -> "Tofu"; "Salt and pepper to taste" stays whole.
function dummyIngredientName(text) {
  return text.split(",")[0].trim();
}

// True if an ingredient description mentions one of the user's phrases as whole words:
// "Cooked rice for serving" mentions "rice", "Fresh mozzarella cheese" mentions "cheese".
function mentions(description, phrases) {
  const padded = ` ${singularPhrase(description)} `;
  return phrases.some((phrase) => padded.includes(` ${phrase} `));
}

function isDummyStaple(name) {
  const phrase = singularPhrase(name);
  return MEALDB_STAPLES.has(phrase) || phrase.startsWith("salt and pepper");
}

function dummyToResult(recipe, userIngredients) {
  const items = recipe.ingredients.map((text) => {
    const name = dummyIngredientName(text);
    const owner = userIngredients.find((ingredient) => mentions(text, ingredient.phrases));
    let status = "missing";
    if (owner) {
      status = "have";
    } else if (isDummyStaple(name)) {
      status = "staple";
    }
    return { name, amount: "", status, ownerLabel: owner ? owner.label : null };
  });
  const minutes = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const area = recipe.cuisine in DUMMYJSON_AREAS ? DUMMYJSON_AREAS[recipe.cuisine] : recipe.cuisine;
  const meals = [...new Set(recipe.mealType.flatMap((type) => DUMMYJSON_MEALS[type] || []))];
  return {
    source: "dummyjson",
    id: `dummyjson-${recipe.id}`,
    name: recipe.name,
    meals: meals.length > 0 ? meals : MAIN_DISH_MEALS,
    area,
    servings: recipe.servings,
    calories: recipe.caloriesPerServing,
    cuisine: `${recipe.cuisine} · ${minutes} min`,
    image: recipe.image,
    about: `A ${recipe.cuisine} dish, rated ${recipe.difficulty.toLowerCase()} to make.`,
    items,
    steps: recipe.instructions,
    beginner: recipe.difficulty === "Easy",
    minutes,
    matchedLabels: [...new Set(items.filter((item) => item.ownerLabel).map((item) => item.ownerLabel))],
    missingLabels: items.filter((item) => item.status === "missing").map((item) => item.name.toLowerCase()),
  };
}

// Recipes that use at least one of the user's ingredients.
async function searchDummyJson(userIngredients) {
  const recipes = await loadDummyJsonRecipes();
  return recipes
    .map((recipe) => dummyToResult(recipe, userIngredients))
    .filter((result) => result.matchedLabels.length > 0);
}

// Recipes whose name contains what was typed, the same way our own cookbook is searched.
async function searchDummyJsonByName(query, userIngredients) {
  const recipes = await loadDummyJsonRecipes();
  return searchRecipesByName(recipes, query).map((recipe) => dummyToResult(recipe, userIngredients));
}

if (typeof module !== "undefined") {
  module.exports = { dummyIngredientName, mentions, dummyToResult };
}
