// Rough calorie estimates for TheMealDB dishes, which come without nutrition
// information or a serving count. We read each ingredient's amount ("2 tbsp",
// "200g", "3 medium"), look the ingredient up in a small table, and add it up.

// Assumed servings for a TheMealDB recipe, since the database doesn't say.
// Desserts are usually a whole cake or pie, so they are cut into more pieces.
const MEALDB_SERVINGS = 4;
const MEALDB_DESSERT_SERVINGS = 8;

// Estimate only when we recognize at least this share of the non-seasoning ingredients.
const MIN_KNOWN_SHARE = 0.75;

// Per-serving results above this are almost certainly a misread amount.
const MAX_BELIEVABLE_CALORIES = 2000;

// Oil beyond a few spoonfuls is for deep frying, and most of it stays in the pan.
const FRYING_OIL_GRAMS = 60;
const FRYING_OIL_ABSORBED = 0.1;

// kcal per 100 g, how much one piece weighs in grams (for "2 eggs", "1 onion"), and
// for dry foods how much one cup weighs (a cup of flour is far lighter than a cup of milk).
// Liquids use 1 ml = 1 g and a 240 g cup, which is close enough for a rough estimate.
const CALORIE_TABLE = {
  egg: { kcal: 143, piece: 50 },
  "egg yolk": { kcal: 322, piece: 17 },
  "egg white": { kcal: 52, piece: 33 },
  tomato: { kcal: 18, piece: 120 },
  "cherry tomato": { kcal: 18, piece: 15 },
  "chopped tomato": { kcal: 20 },
  "canned tomato": { kcal: 20 },
  "tinned tomato": { kcal: 20 },
  "tomato puree": { kcal: 80 },
  "tomato paste": { kcal: 80 },
  passata: { kcal: 30 },
  potato: { kcal: 77, piece: 200 },
  "sweet potato": { kcal: 86, piece: 150 },
  onion: { kcal: 40, piece: 150 },
  shallot: { kcal: 72, piece: 30 },
  "spring onion": { kcal: 32, piece: 15 },
  "green onion": { kcal: 32, piece: 15 },
  scallion: { kcal: 32, piece: 15 },
  leek: { kcal: 61, piece: 90 },
  garlic: { kcal: 149, piece: 5 },
  "garlic clove": { kcal: 149, piece: 5 },
  ginger: { kcal: 80, piece: 10 },
  carrot: { kcal: 41, piece: 60 },
  celery: { kcal: 16, piece: 40 },
  pepper: { kcal: 26, piece: 150 },
  "bell pepper": { kcal: 26, piece: 150 },
  "red pepper": { kcal: 26, piece: 150 },
  "green pepper": { kcal: 26, piece: 150 },
  "yellow pepper": { kcal: 26, piece: 150 },
  chilli: { kcal: 40, piece: 10 },
  chili: { kcal: 40, piece: 10 },
  mushroom: { kcal: 22, piece: 15, cup: 70 },
  spinach: { kcal: 23, piece: 30, cup: 30 },
  lettuce: { kcal: 15, piece: 300 },
  cabbage: { kcal: 25, piece: 900 },
  "bok choy": { kcal: 13, piece: 100 },
  broccoli: { kcal: 34, piece: 300 },
  cauliflower: { kcal: 25, piece: 500 },
  courgette: { kcal: 17, piece: 200 },
  zucchini: { kcal: 17, piece: 200 },
  aubergine: { kcal: 25, piece: 300 },
  eggplant: { kcal: 25, piece: 300 },
  cucumber: { kcal: 15, piece: 300 },
  pea: { kcal: 81, cup: 145 },
  sweetcorn: { kcal: 86, cup: 165 },
  corn: { kcal: 86, cup: 165 },
  "green bean": { kcal: 31 },
  avocado: { kcal: 160, piece: 150 },
  lemon: { kcal: 29, piece: 100 },
  "lemon juice": { kcal: 22 },
  lime: { kcal: 30, piece: 70 },
  "lime juice": { kcal: 25 },
  orange: { kcal: 47, piece: 150 },
  apple: { kcal: 52, piece: 180 },
  banana: { kcal: 89, piece: 120 },
  strawberry: { kcal: 32, piece: 12 },
  raspberry: { kcal: 52, piece: 2 },
  blueberry: { kcal: 57, piece: 1 },
  "coconut milk": { kcal: 230 },
  "coconut cream": { kcal: 330 },
  milk: { kcal: 61 },
  cream: { kcal: 340 },
  "double cream": { kcal: 450 },
  "heavy cream": { kcal: 340 },
  "single cream": { kcal: 190 },
  "sour cream": { kcal: 200 },
  yogurt: { kcal: 60 },
  "greek yogurt": { kcal: 100 },
  "cream cheese": { kcal: 340 },
  butter: { kcal: 717 },
  "peanut butter": { kcal: 590 },
  cheese: { kcal: 400, cup: 110 },
  "cheddar cheese": { kcal: 400, cup: 110 },
  parmesan: { kcal: 430, cup: 100 },
  "parmesan cheese": { kcal: 430, cup: 100 },
  mozzarella: { kcal: 280, cup: 110 },
  feta: { kcal: 260, cup: 150 },
  flour: { kcal: 364, cup: 125 },
  "glutinous rice flour": { kcal: 370, cup: 125 },
  cornstarch: { kcal: 381, cup: 128 },
  cornflour: { kcal: 381, cup: 128 },
  sugar: { kcal: 387, cup: 200 },
  honey: { kcal: 304 },
  syrup: { kcal: 280 },
  "maple syrup": { kcal: 260 },
  chocolate: { kcal: 550, cup: 170 },
  "dark chocolate": { kcal: 550, cup: 170 },
  "cocoa powder": { kcal: 230, cup: 85 },
  oil: { kcal: 884 },
  rice: { kcal: 360, cup: 185 },
  pasta: { kcal: 360, cup: 100 },
  spaghetti: { kcal: 360 },
  penne: { kcal: 360, cup: 100 },
  macaroni: { kcal: 360, cup: 100 },
  noodle: { kcal: 360 },
  "rice noodle": { kcal: 360 },
  bread: { kcal: 265, piece: 30 },
  breadcrumb: { kcal: 395, cup: 110 },
  tortilla: { kcal: 300, piece: 45 },
  "tart shell": { kcal: 450, piece: 30 },
  chicken: { kcal: 170, piece: 1200 },
  "chicken breast": { kcal: 120, piece: 170 },
  "chicken thigh": { kcal: 180, piece: 100 },
  "chicken wing": { kcal: 200, piece: 40 },
  "chicken leg": { kcal: 190, piece: 250 },
  beef: { kcal: 250 },
  "minced beef": { kcal: 250 },
  "ground beef": { kcal: 250 },
  "beef fillet": { kcal: 200 },
  steak: { kcal: 250, piece: 250 },
  pork: { kcal: 240 },
  "pork belly": { kcal: 520 },
  "pork chop": { kcal: 230, piece: 180 },
  bacon: { kcal: 450, piece: 25 },
  sausage: { kcal: 300, piece: 60 },
  ham: { kcal: 145, piece: 25 },
  lamb: { kcal: 280 },
  "minced lamb": { kcal: 280 },
  salmon: { kcal: 208, piece: 150 },
  fish: { kcal: 82, piece: 150 },
  cod: { kcal: 82, piece: 150 },
  prawn: { kcal: 99, piece: 15 },
  shrimp: { kcal: 99, piece: 15 },
  tuna: { kcal: 130 },
  anchovy: { kcal: 210, piece: 4 },
  tofu: { kcal: 76 },
  bean: { kcal: 130 },
  "kidney bean": { kcal: 130 },
  "black bean": { kcal: 130 },
  chickpea: { kcal: 160 },
  lentil: { kcal: 350, cup: 190 },
  "red bean": { kcal: 330, cup: 200 },
  peanut: { kcal: 570, cup: 145 },
  almond: { kcal: 580, cup: 140 },
  cashew: { kcal: 550, cup: 140 },
  walnut: { kcal: 650, cup: 120 },
  "sesame seed": { kcal: 570, cup: 144 },
  coconut: { kcal: 350, cup: 85 },
  stock: { kcal: 5 },
  water: { kcal: 0 },
  wine: { kcal: 85 },
  "soy sauce": { kcal: 53 },
  sauce: { kcal: 80 },
  vinegar: { kcal: 20 },
  mayonnaise: { kcal: 680 },
  ketchup: { kcal: 110 },
  "orange juice": { kcal: 45 },
  "english muffin": { kcal: 230, piece: 60 },
  jam: { kcal: 250 },
  treacle: { kcal: 290 },
  "black treacle": { kcal: 290 },
  baguette: { kcal: 270, piece: 250 },
  toast: { kcal: 265, piece: 30 },
  "filo pastry": { kcal: 300, piece: 20 },
  pastry: { kcal: 450 },
  mincemeat: { kcal: 280 },
  mince: { kcal: 250 },
  "doner meat": { kcal: 250 },
  fry: { kcal: 300 },
  date: { kcal: 280, piece: 20 },
  "medjool date": { kcal: 280, piece: 20 },
  pecan: { kcal: 690, cup: 110 },
  "pecan nut": { kcal: 690, cup: 110 },
  "chocolate chip": { kcal: 500, cup: 170 },
  "ice cream": { kcal: 200, piece: 65 },
  cacao: { kcal: 230, cup: 85 },
  haddock: { kcal: 80, piece: 150 },
  fennel: { kcal: 31, piece: 250 },
  "fennel bulb": { kcal: 31, piece: 250 },
  "vine leave": { kcal: 90, piece: 3 },
  // Herbs and spices: used in small amounts, so they add little either way.
  parsley: { kcal: 36, piece: 10 },
  coriander: { kcal: 23, piece: 10 },
  cilantro: { kcal: 23, piece: 10 },
  basil: { kcal: 23, piece: 10 },
  mint: { kcal: 44, piece: 5 },
  dill: { kcal: 43, piece: 5 },
  chive: { kcal: 30, piece: 5 },
  thyme: { kcal: 100, piece: 1 },
  "bay leaf": { kcal: 300, piece: 0.5 },
  allspice: { kcal: 260, piece: 2 },
  cardamom: { kcal: 310, piece: 0.5 },
  clove: { kcal: 270, piece: 0.5 },
  "cinnamon stick": { kcal: 250, piece: 3 },
  vanilla: { kcal: 290, piece: 2 },
  "garlic granule": { kcal: 330 },
  "bicarbonate of soda": { kcal: 0 },
  "baking powder": { kcal: 50 },
  hotsauce: { kcal: 10, piece: 5 },
};

// Grams in one of each unit. "piece" units use the ingredient's own piece weight.
const UNIT_GRAMS = {
  g: 1, gram: 1, kg: 1000, ml: 1, l: 1000, litre: 1000, liter: 1000, cl: 10,
  tbsp: 15, tbs: 15, tblsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5,
  cup: 240, oz: 28, ounce: 28, lb: 454, pound: 454,
  can: 400, tin: 400, handful: 30, bunch: 100, pinch: 0.5, dash: 0.5,
};
const PIECE_WORDS = { clove: 1, piece: 1, whole: 1, medium: 1, large: 1.3, small: 0.7 };

// A slice of anything (bread, ham, smoked salmon) is thin, whatever the whole piece weighs.
const SLICE_GRAMS = 25;
const TINY_AMOUNT = /to taste|pinch|dash|garnish|sprinkl|drizzle|to serve|for frying/;

// Finds the table entry for an ingredient: the whole name, else its last two words,
// else its last word ("plum tomatoes" -> "tomato").
function lookUpCalories(name) {
  const words = singularPhrase(name).split(" ");
  for (const phrase of [words.join(" "), words.slice(-2).join(" "), words.slice(-1)[0]]) {
    if (CALORIE_TABLE[phrase]) {
      return CALORIE_TABLE[phrase];
    }
  }
  return null;
}

// Reads the first number in an amount, including fractions: "1 1/2 cups" -> 1.5.
function readQuantity(text) {
  const normalized = text.replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").replace(/⅓/g, " 1/3");
  // Mixed numbers ("1 1/2") first, then fractions ("1/2"), then plain numbers ("2", "0.5").
  const match = normalized.match(/(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  if (match[1]) {
    return Number(match[1]) + Number(match[2]) / Number(match[3]);
  }
  if (match[4]) {
    return Number(match[4]) / Number(match[5]);
  }
  return Number(match[6]);
}

// Returns grams for an amount like "200g", "2 tbsp", or "3 medium", or null if unreadable.
function amountInGrams(amount, entry) {
  const text = amount.toLowerCase();
  const quantity = readQuantity(text);
  if (quantity === null) {
    if (TINY_AMOUNT.test(text)) {
      return 0;
    }
    // No amount at all usually means one piece ("Onion" with an empty measure).
    return entry.piece ? entry.piece : null;
  }
  const words = text.match(/[a-z]+/g) || [];
  for (const word of words) {
    // Try the word as written, without "s" ("cloves" -> "clove"), and without "es" ("dashes" -> "dash").
    for (const unit of [word, word.replace(/s$/, ""), word.replace(/es$/, "")]) {
      if (unit === "cup" && entry.cup) {
        return quantity * entry.cup;
      }
      if (UNIT_GRAMS[unit] !== undefined) {
        return quantity * UNIT_GRAMS[unit];
      }
      if (unit === "slice") {
        return quantity * SLICE_GRAMS;
      }
      if (PIECE_WORDS[unit] !== undefined) {
        return entry.piece ? quantity * entry.piece * PIECE_WORDS[unit] : null;
      }
    }
  }
  return entry.piece ? quantity * entry.piece : null;
}

// Grams that end up in the food: all of it, except that only a little deep-frying oil is absorbed.
function absorbedGrams(entry, grams) {
  if (entry !== CALORIE_TABLE.oil || grams <= FRYING_OIL_GRAMS) {
    return grams;
  }
  return FRYING_OIL_GRAMS + (grams - FRYING_OIL_GRAMS) * FRYING_OIL_ABSORBED;
}

// Estimates calories per serving for a list of { name, amount }, or null when
// too many ingredients can't be read to give a meaningful number.
function estimateCaloriesPerServing(items, servings) {
  let total = 0;
  let mainCount = 0;
  let knownMainCount = 0;
  for (const item of items) {
    const seasoning = isSeasoning(item.name);
    const entry = lookUpCalories(item.name);
    const grams = entry ? amountInGrams(item.amount, entry) : null;
    if (!seasoning) {
      mainCount += 1;
    }
    if (grams !== null) {
      total += (absorbedGrams(entry, grams) / 100) * entry.kcal;
      if (!seasoning) {
        knownMainCount += 1;
      }
    }
  }
  if (mainCount === 0 || knownMainCount / mainCount < MIN_KNOWN_SHARE) {
    return null;
  }
  const perServing = Math.round(total / servings / 10) * 10;
  return perServing > 0 && perServing <= MAX_BELIEVABLE_CALORIES ? perServing : null;
}

if (typeof module !== "undefined") {
  module.exports = { lookUpCalories, readQuantity, amountInGrams, estimateCaloriesPerServing };
}
