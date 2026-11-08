// Scanning a supermarket receipt: the photo is read on this device (Tesseract.js,
// loaded only when first needed), the foods on it are found, the user ticks the right
// ones, and a window shows the dishes they can make with what they just bought.

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const RECEIPT_RESULTS_SHOWN = 12;

// Lines that are never food: totals, payment, the store's details.
const RECEIPT_SKIP_LINE =
  /\b(sub ?total|total|tax|change|cash|visa|mastercard|amex|debit|credit|balance|thank|store|street|receipt|card|points|savings?|discount|coupon|member)\b|\*{2,}/i;

// Receipt shorthand, written out. An empty string drops the word ("ORG", "12CT").
const RECEIPT_ABBREVIATIONS = {
  chkn: "chicken",
  chk: "chicken",
  brst: "breast",
  bnls: "",
  org: "",
  orgnc: "",
  lg: "",
  sm: "",
  med: "",
  ct: "",
  pk: "",
  pkg: "",
  ea: "",
  grn: "green",
  onin: "onion",
  onn: "onion",
  tom: "tomato",
  toms: "tomato",
  tmto: "tomato",
  broc: "broccoli",
  brocc: "broccoli",
  crowns: "",
  sce: "sauce",
  mshrm: "mushroom",
  mush: "mushroom",
  pot: "potato",
  pots: "potato",
  bf: "beef",
  grd: "ground",
  grnd: "ground",
  slmn: "salmon",
  shrmp: "shrimp",
  carr: "carrot",
  crrt: "carrot",
  cabb: "cabbage",
  grlc: "garlic",
  lttc: "lettuce",
  spnch: "spinach",
  ndl: "noodle",
  ndls: "noodles",
  btr: "butter",
  mlk: "milk",
  chs: "cheese",
  ygrt: "yogurt",
  ppr: "pepper",
  bll: "bell",
  appl: "apple",
  bnna: "banana",
  lmn: "lemon",
};

// Every ingredient name the app knows, singular, mapped to the name to show:
// our own ingredients (and their other names), then TheMealDB's.
function receiptPhrases(mealDbNames) {
  const phrases = new Map();
  for (const info of Object.values(INGREDIENTS)) {
    if (!info.staple) {
      for (const name of [info.label, ...info.aliases]) {
        phrases.set(singularPhrase(name), info.label);
      }
    }
  }
  for (const name of mealDbNames) {
    const phrase = singularPhrase(name);
    if (phrase !== "" && !phrases.has(phrase)) {
      phrases.set(phrase, name.toLowerCase());
    }
  }
  // Longest first, so "green onion" wins over "onion".
  return [...phrases.entries()].sort((a, b) => b[0].length - a[0].length);
}

// The foods on a receipt, as ingredient names, in receipt order without repeats.
function parseReceipt(text, mealDbNames) {
  const phrases = receiptPhrases(mealDbNames);
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    if (RECEIPT_SKIP_LINE.test(line)) {
      continue;
    }
    const words = line
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .map((word) => (word in RECEIPT_ABBREVIATIONS ? RECEIPT_ABBREVIATIONS[word] : word))
      .filter(Boolean);
    const padded = ` ${singularPhrase(words.join(" "))} `;
    const match = phrases.find(([phrase]) => padded.includes(` ${phrase} `));
    if (match && !found.includes(match[1])) {
      found.push(match[1]);
    }
  }
  return found;
}

let tesseractLoading = null;

function loadTesseract() {
  if (!tesseractLoading) {
    tesseractLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_URL;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => {
        tesseractLoading = null;
        reject(new Error("Couldn't load the receipt reader."));
      };
      document.head.append(script);
    });
  }
  return tesseractLoading;
}

// Reads the text on a receipt photo. onProgress gets a number from 0 to 1.
async function readReceiptPhoto(file, onProgress) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(message.progress);
      }
    },
  });
  // A link to the photo in memory, which the reader accepts however the file was made.
  const photoUrl = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(photoUrl);
    return data.text;
  } finally {
    URL.revokeObjectURL(photoUrl);
    await worker.terminate();
  }
}

const receiptDialog = document.getElementById("receipt-dialog");
const receiptForm = document.getElementById("receipt-form");
const receiptPhoto = document.getElementById("receipt-photo");
const receiptPreview = document.getElementById("receipt-preview");
const receiptStatus = document.getElementById("receipt-status");
const receiptChecklist = document.getElementById("receipt-checklist");
const receiptFind = document.getElementById("receipt-find");
const receiptResultsDialog = document.getElementById("receipt-results-dialog");
const receiptResultsView = document.getElementById("receipt-results-view");

function checkedReceiptItems() {
  return [...receiptChecklist.querySelectorAll("input:checked")].map((box) => box.value);
}

function updateReceiptFindButton() {
  const count = checkedReceiptItems().length;
  receiptFind.disabled = count === 0;
  receiptFind.textContent = count > 0 ? `Find dishes with ${count} item${count === 1 ? "" : "s"}` : "Find dishes";
}

function renderReceiptChecklist(foods) {
  receiptChecklist.replaceChildren();
  for (const food of foods) {
    const option = el("label", "fridge-item");
    const box = el("input");
    box.type = "checkbox";
    box.value = food;
    box.checked = true;
    box.addEventListener("change", updateReceiptFindButton);
    option.append(box, el("span", null, food));
    receiptChecklist.append(option);
  }
  updateReceiptFindButton();
}

document.getElementById("receipt-button").addEventListener("click", () => {
  receiptStatus.textContent = "";
  renderReceiptChecklist([]);
  receiptDialog.showModal();
});

document.getElementById("receipt-cancel").addEventListener("click", () => receiptDialog.close());

receiptPhoto.addEventListener("change", async () => {
  const file = receiptPhoto.files[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    receiptStatus.textContent = "That file isn't a photo. Please choose an image of your receipt.";
    return;
  }
  if (receiptPreview.src) {
    URL.revokeObjectURL(receiptPreview.src);
  }
  receiptPreview.src = URL.createObjectURL(file);
  receiptPreview.hidden = false;
  renderReceiptChecklist([]);
  receiptStatus.textContent = "Reading your receipt… (the first time takes a little longer)";
  try {
    const text = await readReceiptPhoto(file, (progress) => {
      receiptStatus.textContent = `Reading your receipt… ${Math.round(progress * 100)}%`;
    });
    const foods = parseReceipt(text, (await mealDbNamesPromise) || []);
    renderReceiptChecklist(foods);
    receiptStatus.textContent =
      foods.length > 0
        ? `Found ${foods.length} food${foods.length === 1 ? "" : "s"}. Untick anything that's wrong.`
        : "No foods found. Try a sharper photo, flat and well lit, or add ingredients by typing.";
  } catch {
    receiptStatus.textContent = "Couldn't read the receipt. Check your internet connection (the reader downloads once), then try again.";
  }
});

function renderReceiptResults(foods) {
  receiptResultsView.replaceChildren();
  const closeButton = el("button", "close-button", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.addEventListener("click", () => receiptResultsDialog.close());
  receiptResultsView.append(closeButton, el("h2", null, "Dishes from your shopping"));
  receiptResultsView.append(el("p", "receipt-using", `With: ${foods.join(", ")}`));
  return closeButton;
}

receiptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const foods = checkedReceiptItems();
  if (foods.length === 0) {
    return;
  }
  receiptDialog.close();
  if (searchMode !== "ingredients") {
    setSearchMode("ingredients");
  }
  renderReceiptResults(foods);
  receiptResultsView.append(el("p", "receipt-finding", "Finding dishes…"));
  receiptResultsDialog.showModal();

  await addIngredients(foods, true);
  await latestSearch;

  renderReceiptResults(foods);
  // Fewest extra ingredients first, then the quickest.
  const dishes = [...shownResults()].sort(compareByEffort);
  if (latestNote) {
    receiptResultsView.append(el("p", "search-status", latestNote));
  }
  if (dishes.length === 0) {
    receiptResultsView.append(el("p", "empty-state", "No dishes found with these ingredients. Try adding a few more."));
    return;
  }
  const grid = el("div", "card-grid");
  grid.append(...dishes.slice(0, RECEIPT_RESULTS_SHOWN).map(renderResultCard));
  const seeAll = el("button", "primary-button", `See all ${dishes.length} dishes on the main page`);
  seeAll.type = "button";
  seeAll.addEventListener("click", () => receiptResultsDialog.close());
  receiptResultsView.append(grid, seeAll);
});

if (typeof module !== "undefined") {
  module.exports = { parseReceipt };
}
