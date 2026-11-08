// Pure functions for turning typed text into ingredient keys and ranking
// recipes by how many of their ingredients the user already has.

// Lowercases a phrase and makes each word singular: "Cherry Tomatoes" -> "cherry tomato".
function singularPhrase(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word !== "")
    .map((word) => {
      if (word.endsWith("ies") && word.length > 4) {
        return word.slice(0, -3) + "y";
      }
      if (word.endsWith("oes") || /(s|x|ch|sh)es$/.test(word)) {
        return word.slice(0, -2);
      }
      if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");
}

// An ingredient is a seasoning if its last word is one of these ("soy sauce", "olive oil").
const SEASONING_WORDS = new Set([
  "salt", "sugar", "oil", "sauce", "vinegar", "wine", "mirin", "sake", "powder", "paste",
  "seasoning", "spice", "cumin", "paprika", "cinnamon", "oregano", "thyme", "rosemary",
  "turmeric", "nutmeg", "anise", "peppercorn", "masala", "ketchup", "mustard", "mayonnaise",
  "honey", "syrup", "cornstarch", "cornflour", "bouillon", "cube", "water", "extract",
  "flake", "seed", "butter", "starch", "concentrate",
]);

// Whole phrases that are seasonings. "Pepper" is listed here rather than above,
// so "red pepper" (the vegetable) stays an ingredient.
const SEASONING_PHRASES = new Set([
  "pepper", "black pepper", "white pepper", "ground pepper", "cayenne pepper", "sichuan pepper",
  "chili", "chilli", "dried chili", "dried chilli", "bay leaf", "bay leave",
]);

// True for salt, sauces, oils, spices and the like; false for vegetables, meat, noodles, etc.
function isSeasoning(name) {
  const phrase = singularPhrase(name);
  const lastWord = phrase.split(" ").pop();
  return SEASONING_PHRASES.has(phrase) || SEASONING_WORDS.has(lastWord);
}

// Country names people often type, mapped to the nationality word TheMealDB uses.
// Most countries already work by their first letters ("Japan" -> "Japanese").
const COUNTRY_ALIASES = {
  usa: "American", us: "American", "united states": "American",
  uk: "British", england: "British", scotland: "British", wales: "British",
  france: "French", spain: "Spanish", philippines: "Filipino",
  netherlands: "Dutch", holland: "Dutch", switzerland: "Swiss",
  korea: "South Korean", "hong kong": "Hong Konger",
};

// Returns up to `limit` nationalities matching what the user typed: exact matches
// first, then ones containing the text, then ones sharing its first four letters.
function searchAreas(query, areas, limit) {
  const typed = query.trim().toLowerCase();
  if (typed === "") {
    return [];
  }
  const alias = COUNTRY_ALIASES[typed];
  const ranked = areas
    .map((area) => {
      const name = area.toLowerCase();
      let rank = -1;
      if (name === typed || area === alias) {
        rank = 0;
      } else if (name.startsWith(typed)) {
        rank = 1;
      } else if (name.includes(typed)) {
        rank = 2;
      } else if (typed.length >= 4 && name.startsWith(typed.slice(0, 4))) {
        rank = 3;
      }
      return { area, rank };
    })
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.area.localeCompare(b.area));
  return [...new Set(ranked.map((item) => item.area))].slice(0, limit);
}

// What an ingredient contains, for dietary needs and allergies, found from its name.
// Each tag lists words or phrases that mean the ingredient has it.
const CONTAINS_KEYWORDS = {
  pork: ["pork", "bacon", "ham", "pancetta", "prosciutto", "chorizo", "salami", "lard", "pig", "sausage", "spare rib"],
  beef: ["beef", "steak", "veal", "oxtail", "brisket", "sirloin"],
  meat: ["chicken", "turkey", "duck", "lamb", "mutton", "goat", "mince", "meat", "venison", "rabbit", "kidney", "liver",
    "gelatin", "gelatine"],
  fish: ["fish", "salmon", "tuna", "cod", "haddock", "anchovy", "sardine", "mackerel", "trout", "tilapia", "bass",
    "halibut", "worcestershire"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "mussel", "clam", "oyster", "scallop", "squid", "octopus", "calamari"],
  egg: ["egg", "mayonnaise", "meringue"],
  dairy: ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "ghee", "parmesan", "mozzarella", "feta", "cheddar",
    "ricotta", "mascarpone", "buttermilk", "creme fraiche", "paneer"],
  honey: ["honey"],
  gluten: ["flour", "bread", "pasta", "spaghetti", "penne", "macaroni", "noodle", "tortilla", "breadcrumb", "wrapper",
    "filo", "pastry", "couscous", "soy sauce", "beer", "barley", "semolina", "tart shell", "baguette", "toast", "muffin",
    "wonton", "ramen", "udon", "biscuit", "cracker", "bulgur"],
  nuts: ["peanut", "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "nut"],
  soy: ["soy", "soya", "tofu", "edamame", "miso", "doubanjiang", "bean curd", "tempeh"],
  sesame: ["sesame", "tahini"],
  alcohol: ["wine", "beer", "rum", "brandy", "sake", "mirin", "vodka", "whisky", "whiskey", "sherry", "cognac", "liqueur"],
};

// Pork and beef are meat too, so vegetarians avoid them.
const ALSO_MEAT = ["pork", "beef"];

// Names the keywords get wrong: if a name contains one of these phrases, take
// those tags back off ("unsweetened coconut milk" isn't dairy).
const NOT_REALLY = {
  "butter bean": ["dairy"],
  "peanut butter": ["dairy"],
  "vegan butter": ["dairy"],
  "coconut milk": ["dairy"],
  "coconut cream": ["dairy"],
  "almond milk": ["dairy"],
  "soy milk": ["dairy"],
  "soya milk": ["dairy"],
  "oat milk": ["dairy"],
  "cream of tartar": ["dairy"],
  "water chestnut": ["nuts"],
  "kidney bean": ["meat"],
  "egg plant": ["egg"],
  "flax egg": ["egg"],
  "grape nut": ["nuts"],
  "oyster mushroom": ["shellfish"],
  "rice flour": ["gluten"],
  "almond flour": ["gluten"],
  "chickpea flour": ["gluten"],
  "corn flour": ["gluten"],
  "coconut flour": ["gluten"],
  "rice noodle": ["gluten"],
  "rice vermicelli": ["gluten"],
  "rice stick noodle": ["gluten"],
  "corn tortilla": ["gluten"],
  "wine vinegar": ["alcohol"],
};

// The same phrases in the singular form ingredientContains compares against.
const NOT_REALLY_PHRASES = Object.entries(NOT_REALLY).map(([phrase, tags]) => [singularPhrase(phrase), tags]);

// Returns the set of tags (e.g. "dairy", "gluten") an ingredient name contains.
function ingredientContains(name) {
  const phrase = singularPhrase(name);
  const padded = ` ${phrase} `;
  const tags = new Set();
  for (const [tag, keywords] of Object.entries(CONTAINS_KEYWORDS)) {
    if (keywords.some((keyword) => padded.includes(` ${keyword} `))) {
      tags.add(tag);
    }
  }
  for (const [exception, wrongTags] of NOT_REALLY_PHRASES) {
    if (padded.includes(` ${exception} `)) {
      wrongTags.forEach((tag) => tags.delete(tag));
    }
  }
  if (ALSO_MEAT.some((tag) => tags.has(tag))) {
    tags.add("meat");
  }
  return tags;
}

// Scaling ingredient amounts for a different number of servings.
const FRACTION_VALUES = { "½": 1 / 2, "¼": 1 / 4, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3 };
const NICE_FRACTIONS = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];
// "1 1/2", "1/2", "1½", "1 ½" (TheMealDB), "½", "2", or "0.5".
const QUANTITY_PATTERN = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(?:(\d+) ?)?([½¼¾⅓⅔])|(\d+(?:\.\d+)?)/g;
// Numbers that aren't amounts: "1½ times the egg volume", "200°C", "5%", "soaked 4 hours".
const NOT_AN_AMOUNT_AFTER = /^\s*(times\b|°|%|(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b)/;

// In a step, a number is only an amount when a measure or an ingredient follows it
// ("2 tbsp oil", "200g flour", "3 eggs"). Times, temperatures, and counts like
// "cut into 4 pieces" are left alone.
const STEP_QUANTITY = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|(?:\d+ ?)?[½¼¾⅓⅔]|\d+(?:\.\d+)?)`;
const STEP_AMOUNT_PATTERN = new RegExp(
  String.raw`(${STEP_QUANTITY}(?:\s*(?:-|–|to)\s*${STEP_QUANTITY})?)(\s*)((?:(?:large|medium|small|whole|fresh|more|extra)\s+)?)([A-Za-z]+)`,
  "g",
);
const STEP_UNITS = new Set(
  (
    "tbsp tbs tablespoon tsp teaspoon cup g gram kg kilogram ml milliliter millilitre l liter litre " +
    "oz ounce lb pound clove slice stalk sprig can pinch handful sheet bunch knob dash"
  ).split(" "),
);

// Writing an ingredient the way a recipe would: "½ tomato", "2 medium tomatoes",
// "2 tbsp soy sauce", "a pinch of salt", "salt, to taste". Amounts come in many
// shapes (ours, and TheMealDB's "200g", "1/2 cup", "Pinch"), so the amount is split
// into its quantity, the words after it, and any note (", whites only", "(or 1 can)").
const LINE_QUANTITY = /^((?:about\s+)?(?:\d+\s+\d+\/\d+|\d+\/\d+|(?:\d+ ?)?[½¼¾⅓⅔]|\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?:\d+\/\d+|(?:\d+ ?)?[½¼¾⅓⅔]|\d+(?:\.\d+)?))?)\s*(.*)$/i;
const LINE_UNITS = new Set([
  ...STEP_UNITS,
  ..."lbs head piece packet pack jar bottle bag box tin fillet block bowl serving cube strip leaf stick".split(" "),
]);
// "Pinch" alone (TheMealDB) means "a pinch of".
const SMALL_AMOUNT_WORDS = new Set("pinch dash handful sprinkle sprinkling splash drizzle knob".split(" "));
// Short units that never take a plural "s".
const UNIT_ABBREVIATIONS = new Set("tbsp tbs tsp g kg ml l oz lb".split(" "));
// Describing words TheMealDB capitalizes ("3 Large"); other words keep their capitals ("Chinese").
const DESCRIBING_WORDS = new Set(
  "large medium small big thin thick whole chopped sliced diced minced fresh green red long beaten dried ground grated crushed frozen ripe".split(" "),
);
// Words that read better after the ingredient: "½ tsp dried chili flakes".
const AFTER_NAME_WORDS = new Set("flakes powder paste juice zest".split(" "));
// Ingredients that aren't counted one by one, so they never get a plural "s".
const MASS_NOUNS = new Set(
  "rice tofu garlic ginger spinach flour sugar salt milk water butter cheese kimchi beef pork mince shrimp fish broccoli celery".split(" "),
);

function pluralize(name) {
  const words = name.split(" ");
  const last = words.pop();
  let plural = `${last}s`;
  if (last.endsWith("s") || MASS_NOUNS.has(last.toLowerCase())) {
    plural = last;
  } else if (/(tomato|potato)$/i.test(last) || /(s|x|z|ch|sh)$/i.test(last)) {
    plural = `${last}es`;
  } else if (/[^aeiou]y$/i.test(last)) {
    plural = `${last.slice(0, -1)}ies`;
  } else if (/leaf$/i.test(last)) {
    plural = `${last.slice(0, -1)}ves`;
  }
  return [...words, plural].join(" ");
}

// More than one of something: "2", "1½", "8–10", "about 40" (but not "½" or "1").
function isMoreThanOne(quantity) {
  const numbers = quantity.match(/\d+(?:\.\d+)?|[½¼¾⅓⅔]/g) || [];
  if (/[-–]|\bto\b/.test(quantity) || numbers.length > 2) {
    return true;
  }
  const [whole, fraction] = numbers;
  if (whole === undefined) {
    return false;
  }
  if (/[½¼¾⅓⅔]/.test(whole)) {
    return false;
  }
  return Number(whole) > 1 || (Number(whole) === 1 && fraction !== undefined && !quantity.includes("/"));
}

function formatIngredientLine(name, amount) {
  const text = (amount || "").trim();
  if (text === "") {
    return name;
  }
  const lowerName = name.toLowerCase();
  // The note: from the first comma or bracket, or a trailing "for frying".
  const noteStart = text.search(/,|\s\(|\sfor\s/);
  const core = noteStart === -1 ? text : text.slice(0, noteStart).trim();
  const rawNote = noteStart === -1 ? "" : text.slice(noteStart).trim();
  const note = rawNote === "" ? "" : rawNote.startsWith(",") || rawNote.startsWith("(") ? `${rawNote.startsWith("(") ? " " : ""}${rawNote}` : `, ${rawNote}`;

  const glued = core.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l|oz|lb)$/i);
  if (glued) {
    return `${core} ${lowerName}${note}`;
  }
  const quantityMatch = core.match(LINE_QUANTITY);
  if (!quantityMatch || /\btimes\b/i.test(core)) {
    const firstWord = core.toLowerCase().split(" ")[0];
    if (/^an?\s/i.test(core) && core.toLowerCase() !== "a little") {
      return `${core.toLowerCase()} of ${lowerName}${note}`;
    }
    if (core.toLowerCase() === "a little") {
      return `a little ${lowerName}${note}`;
    }
    if (SMALL_AMOUNT_WORDS.has(singularPhrase(firstWord)) && !core.includes(" ")) {
      return `a ${firstWord} of ${lowerName}${note}`;
    }
    return `${lowerName}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  const [, quantity, rest] = quantityMatch;
  const more = isMoreThanOne(quantity);
  const isUnit = (word) => LINE_UNITS.has(singularPhrase(word)) || LINE_UNITS.has(word.toLowerCase());
  const restWords = rest
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      // Pounds are the one short unit with a plural: "½ lb", "2 lbs".
      if (lower === "lb" || lower === "lbs") {
        return more ? "lbs" : "lb";
      }
      // Units follow the number once servings change it: "⅔ clove", "2 cups".
      if (isUnit(word) && !UNIT_ABBREVIATIONS.has(lower)) {
        return more ? pluralize(singularPhrase(lower)) : singularPhrase(lower);
      }
      return isUnit(word) || DESCRIBING_WORDS.has(lower) ? lower : word;
    });
  const hasUnit = restWords.some(isUnit);
  const nameLast = singularPhrase(lowerName).split(" ").pop();
  // The amount ends with the ingredient: "4 tbsp olive oil", "2 long Chinese eggplants",
  // "2 fillets". A more specific name ("olive oil") is kept; a bare one ("fillets")
  // becomes the full name ("white fish fillets").
  if (restWords.length > 0 && singularPhrase(restWords[restWords.length - 1]) === nameLast) {
    const last = restWords.pop();
    const otherUnit = restWords.some(isUnit);
    const moreSpecific = restWords.some((word) => !isUnit(word) && !DESCRIBING_WORDS.has(word.toLowerCase()));
    if (moreSpecific) {
      restWords.push(otherUnit ? last : agreeInNumber(last, more));
    } else {
      restWords.push(otherUnit ? lowerName : agreeInNumber(lowerName, more));
    }
    return `${quantity} ${restWords.join(" ")}${note}`;
  }
  if (hasUnit) {
    const before = restWords.filter((word) => !AFTER_NAME_WORDS.has(word));
    const after = restWords.filter((word) => AFTER_NAME_WORDS.has(word));
    return [quantity, ...before, lowerName, ...after].join(" ") + note;
  }
  // A count, maybe with describing words: "2 medium tomatoes", "1 chopped onion".
  return [quantity, ...restWords, agreeInNumber(lowerName, more)].join(" ") + note;
}

// "tortillas" with 1 → "tortilla"; "tomato" with 2 → "tomatoes".
function agreeInNumber(name, more) {
  if (more) {
    return pluralize(name);
  }
  const words = name.split(" ");
  const last = words.pop();
  let singular = singularPhrase(last);
  if (MASS_NOUNS.has(last)) {
    singular = last;
  } else if (/leaves$/i.test(last)) {
    singular = `${last.slice(0, -3)}f`;
  }
  return [...words, singular].join(" ");
}

function scaleStepAmounts(step, factor, ingredientNames) {
  if (factor === 1) {
    return step;
  }
  const ingredientWords = new Set(ingredientNames.flatMap((name) => singularPhrase(name).split(" ")));
  return step.replace(STEP_AMOUNT_PATTERN, (match, amount, space, adjective, word) => {
    const singular = singularPhrase(word);
    if (!STEP_UNITS.has(singular) && !STEP_UNITS.has(word.toLowerCase()) && !ingredientWords.has(singular)) {
      return match;
    }
    return `${scaleAmount(amount, factor)}${space}${adjective}${word}`;
  });
}

// Writes a quantity the way a recipe would: whole numbers above 10, otherwise
// to the nearest quarter or third ("1½", "⅔").
function formatQuantity(value) {
  if (value >= 10) {
    return String(Math.round(value));
  }
  let whole = Math.floor(value);
  let best = [0, ""];
  for (const candidate of [[0, ""], ...NICE_FRACTIONS, [1, ""]]) {
    if (Math.abs(value - whole - candidate[0]) < Math.abs(value - whole - best[0])) {
      best = candidate;
    }
  }
  if (best[0] === 1) {
    whole += 1;
    best = [0, ""];
  }
  if (whole === 0 && best[1] === "") {
    return "¼";
  }
  return `${whole > 0 ? whole : ""}${best[1]}`;
}

// Multiplies every amount in a text like "2 medium" or "1 can (330 ml)" by factor.
function scaleAmount(text, factor) {
  if (factor === 1) {
    return text;
  }
  return text.replace(QUANTITY_PATTERN, (match, mixedWhole, mixedTop, mixedBottom, top, bottom, glyphWhole, glyph, plain, offset) => {
    if (NOT_AN_AMOUNT_AFTER.test(text.slice(offset + match.length))) {
      return match;
    }
    let value;
    if (mixedWhole !== undefined) {
      value = Number(mixedWhole) + Number(mixedTop) / Number(mixedBottom);
    } else if (top !== undefined) {
      value = Number(top) / Number(bottom);
    } else if (glyph !== undefined) {
      value = Number(glyphWhole || 0) + FRACTION_VALUES[glyph];
    } else {
      value = Number(plain);
    }
    return formatQuantity(value * factor);
  });
}

// Short lines ending in ":" ("For the sauce:") are section headings in recipe
// instructions, not steps.
function isStepHeading(step) {
  return step.endsWith(":") && step.length <= 60;
}

// Maps every label and alias (lowercased) to its ingredient key.
function buildAliasIndex(ingredients) {
  const index = new Map();
  for (const [key, info] of Object.entries(ingredients)) {
    index.set(key.replace(/_/g, " "), key);
    index.set(info.label.toLowerCase(), key);
    for (const alias of info.aliases) {
      index.set(alias.toLowerCase(), key);
    }
  }
  return index;
}

// Returns the ingredient key for typed text, or null if it is unknown.
// Handles simple English plurals: "tomatoes" -> "tomato", "eggs" -> "egg".
function resolveIngredient(text, aliasIndex) {
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (cleaned === "") {
    return null;
  }
  const candidates = [cleaned];
  if (cleaned.endsWith("es")) {
    candidates.push(cleaned.slice(0, -2));
  }
  if (cleaned.endsWith("s")) {
    candidates.push(cleaned.slice(0, -1));
  }
  for (const candidate of candidates) {
    if (aliasIndex.has(candidate)) {
      return aliasIndex.get(candidate);
    }
  }
  return null;
}

// Compares one recipe with what the user has: which ingredients they have and which
// they're missing. Staples and optional ingredients are never counted as missing.
function matchRecipe(recipe, ingredients, haveKeys) {
  const have = new Set(haveKeys);
  const nonStaples = recipe.ingredients.filter((item) => !ingredients[item.key].staple);
  const required = nonStaples.filter((item) => !item.optional);
  return {
    recipe,
    matchedKeys: nonStaples.filter((item) => have.has(item.key)).map((item) => item.key),
    missingKeys: required.filter((item) => !have.has(item.key)).map((item) => item.key),
  };
}

// Recipes whose name contains every word typed, allowing the start of a word:
// "mapo" finds Mapo Tofu, "egg tart" finds Hong Kong-style Egg Tarts.
function searchRecipesByName(recipes, query) {
  const typedWords = singularPhrase(query).split(" ").filter((word) => word !== "");
  if (typedWords.length === 0) {
    return [];
  }
  return recipes.filter((recipe) => {
    const nameWords = singularPhrase(recipe.name).split(/[\s-]+/);
    return typedWords.every((typed) => nameWords.some((word) => word.startsWith(typed)));
  });
}

// Ranks recipes that use at least one ingredient the user has.
// Staples (salt, oil, ...) and optional ingredients are never counted as missing.
// Recipes missing the fewest ingredients come first.
function rankRecipes(recipes, ingredients, haveKeys) {
  const results = recipes
    .map((recipe) => matchRecipe(recipe, ingredients, haveKeys))
    .filter((match) => match.matchedKeys.length > 0);
  results.sort(
    (a, b) =>
      a.missingKeys.length - b.missingKeys.length ||
      b.matchedKeys.length - a.matchedKeys.length ||
      a.recipe.name.localeCompare(b.recipe.name),
  );
  return results;
}

if (typeof module !== "undefined") {
  module.exports = {
    singularPhrase,
    isSeasoning,
    ingredientContains,
    scaleAmount,
    scaleStepAmounts,
    formatIngredientLine,
    searchAreas,
    isStepHeading,
    buildAliasIndex,
    resolveIngredient,
    matchRecipe,
    searchRecipesByName,
    rankRecipes,
  };
}
