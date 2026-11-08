// Pixel-art ingredients that fall through the title area, behind the title.
// Each sprite is a square grid (8 × 8, or 16 × 16 for more detail): one character
// per pixel, "." for empty. Every sprite shows at the same size on screen. Most use
// the shared PIXEL_COLORS; a detailed sprite can bring its own { colors, rows }.

const PIXEL_COLORS = {
  R: "#d93a2b", // red
  G: "#3d8b37", // green
  H: "#6cc25f", // light green
  W: "#fffaf0", // white
  o: "#c9b79c", // egg outline
  Y: "#f5b82e", // yolk
  O: "#f08a24", // orange
  S: "#d9c39a", // mushroom stem
  T: "#7cae5a", // broccoli stem
  B: "#c4362c", // raw beef
  E: "#962920", // beef shading
  D: "#6e1a14", // steak outline
  M: "#f2b3ab", // marbling
  A: "#f7e1da", // fat edge
  P: "#f0b9a6", // raw chicken
  Q: "#d9967f", // chicken shading
};

const PIXEL_SPRITES = {
  tomato: ["...GG...", "..GGGG..", ".RRGGRR.", "RRRRRRRR", "RRWRRRRR", "RRRRRRRR", ".RRRRRR.", "..RRRR.."],
  egg: ["..oooo..", ".oWWWWo.", "oWWYYWWo", "oWYYYYWo", "oWYYYYWo", "oWWYYWWo", ".oWWWWo.", "..oooo.."],
  carrot: ["......GG", ".....GG.", "....OOG.", "...OOO..", "..OOO...", ".OOO....", "OO......", "O......."],
  mushroom: ["..RRRR..", ".RWRRWR.", "RRRRRRRR", "RWRRRRWR", "..SSSS..", "..SSSS..", "..SSSS..", "...SS..."],
  broccoli: [".GG.GG..", "GGGGGGG.", "GGHGGGGG", ".GGGGGG.", "..GTTG..", "...TT...", "...TT...", "...TT..."],
  chili: ["......G.", ".....GG.", "....RR..", "...RRR..", "..RRR...", ".RRR....", ".RR.....", "R......."],
  // 16 × 16, for the detail of a raw steak slab in the style of game item icons.
  steak: [
    "................",
    "..........DDD...",
    "........DDBBBD..",
    "......DDBMBBBBD.",
    "....DDBBBBMMBBD.",
    "...DBBMMBBBBBAD.",
    "..DBBBBBBMBBAAD.",
    ".DBMBBBBBBMBAD..",
    ".DBBMMBBBBBBAD..",
    ".DEBBBBMMBBAD...",
    ".DEEBBBBBBAAD...",
    "..DEEEBBBAAD....",
    "...DDEEEAAD.....",
    ".....DDDDD......",
    "................",
    "................",
  ],
  // A whole raw salmon from Shuchen's picture, with the mouth and the gap in the tail filled in.
  salmon: {
    colors: {
      A: "#58403c", // outline
      B: "#bd928b", // jaw
      C: "#99736d", // jaw shading
      E: "#66361d", // back edge
      F: "#ab3533", // body
      G: "#902928", // body shading
      H: "#be4644", // body highlight
      I: "#723530", // belly shading
      J: "#1b2a26", // dark outline
      K: "#3e4e43", // tail outline
      L: "#5d7764", // tail
      M: "#659473", // tail highlight
      N: "#171717", // tail shadow
      O: "#4c6051", // tail shading
    },
    rows: [
      "................",
      "...........AAA..",
      "...........ABBA.",
      "..........ABBCCA",
      ".....AA.EEFGCCCA",
      "....ABCEGFHICAA.",
      "....ACFFFHFJ....",
      "....EFFFHFGJ....",
      "...KLLGHFGIJ....",
      "...KKLMGFIJ.....",
      "..KLLKLLIIJ.....",
      "..KNOOLKIJ......",
      "..KOOAKKJ.......",
      "..KOOCAJ........",
      "....CC..........",
      "................",
    ],
  },
  drumstick: ["......oW", ".....oWo", "....PP..", "..PPPP..", ".PPQPP..", "PPPPPQ..", "PPPPP...", ".PPP...."],
};

// Shown bigger than the rest (.pixel-sprite-big and -medium in style.css).
const SPRITE_SIZES = { salmon: "big", steak: "medium" };
// "Medium speed": each one takes 4.5–6.5 seconds to fall through the title area.
const FALL_SECONDS_MIN = 4.5;
const FALL_SECONDS_MAX = 6.5;

// Turns a sprite grid into an SVG picture with one square per pixel.
function spriteImage(rows, colors) {
  const squares = rows
    .flatMap((row, y) =>
      [...row].map((pixel, x) =>
        pixel === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[pixel]}"/>`,
      ),
    )
    .join("");
  const size = rows.length;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${squares}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function startPixelRain() {
  const header = document.querySelector(".site-header");
  const sky = document.createElement("div");
  sky.className = "pixel-sky";
  sky.setAttribute("aria-hidden", "true");
  const names = Object.keys(PIXEL_SPRITES);
  const images = Object.values(PIXEL_SPRITES).map((sprite) =>
    Array.isArray(sprite) ? spriteImage(sprite, PIXEL_COLORS) : spriteImage(sprite.rows, sprite.colors),
  );
  // One ingredient of each kind, each in its own lane across the width, so no two
  // ever overlap. The lanes are shuffled so the order changes on every visit.
  const lanes = images.map((image, lane) => lane);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const laneWidth = 100 / images.length;
  images.forEach((image, i) => {
    const sprite = document.createElement("img");
    const size = SPRITE_SIZES[names[i]];
    sprite.className = size ? `pixel-sprite pixel-sprite-${size}` : "pixel-sprite";
    sprite.src = image;
    sprite.alt = "";
    // Somewhere inside its lane, never past the lane's edge (--sprite-size is set in style.css).
    sprite.style.left = `calc(${lanes[i] * laneWidth}% + ${Math.random().toFixed(2)} * (${laneWidth}% - var(--sprite-size)))`;
    sprite.style.animationDuration = `${FALL_SECONDS_MIN + Math.random() * (FALL_SECONDS_MAX - FALL_SECONDS_MIN)}s`;
    sprite.style.animationDelay = `${Math.random() * FALL_SECONDS_MAX}s`;
    sky.append(sprite);
  });
  header.prepend(sky);
}

// The profile button's picture: a little pixel chef.
const PROFILE_ICON = {
  colors: {
    o: "#4a2b2b", // outline
    W: "#ffffff", // hat and collar
    H: "#e3dccf", // hat band
    S: "#f2c7a5", // face
    M: "#b8735a", // smile
    E: "#2a1a14", // eyes
    R: "#e8907a", // cheeks
    A: "#8a2d1f", // shirt
  },
  rows: [
    "....ooo.ooo.....",
    "...oWWWoWWWo....",
    "..oWWWWWWWWWo...",
    "..oWWWWWWWWWo...",
    "...oHWWWWWHo....",
    "...oHHHHHHHo....",
    "...oSSSSSSSo....",
    "...oSESSSESo....",
    "...oRSSSSSRo....",
    "...oSSMMMSSo....",
    "....oSSSSSo.....",
    "..ooooSSSoooo...",
    ".oAAAAWWWAAAAo..",
    ".oAAAAAWAAAAAo..",
    ".oAAAAAAAAAAAo..",
    ".ooooooooooooo..",
  ],
};

function showProfileIcon() {
  const icon = document.createElement("img");
  icon.className = "pixel-avatar";
  icon.src = spriteImage(PROFILE_ICON.rows, PROFILE_ICON.colors);
  icon.alt = "";
  document.getElementById("profile-button").replaceChildren(icon);
}

startPixelRain();
showProfileIcon();
