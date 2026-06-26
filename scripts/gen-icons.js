/* Generates MoMoney's icon set + per-person avatars from the user's monkey SVG. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BG = '#B07D56'; // brand caramel

// The user's exact monkey face artwork (1024 canvas, transparent).
const MONKEY = `
  <circle cx="220" cy="512" r="104" fill="#5A341F"/>
  <circle cx="804" cy="512" r="104" fill="#5A341F"/>
  <path d="M242 430C196 434 160 468 160 512C160 556 196 590 242 594C226 544 226 480 242 430Z" fill="#FFD8A3"/>
  <path d="M782 430C828 434 864 468 864 512C864 556 828 590 782 594C798 544 798 480 782 430Z" fill="#FFD8A3"/>
  <ellipse cx="512" cy="502" rx="316" ry="308" fill="#5A341F"/>
  <path d="M462 216C496 270 510 300 512 334C526 292 558 250 616 214C588 215 552 230 526 259C516 226 496 207 462 216Z" fill="#5A341F"/>
  <path d="M512 395C557 322 686 342 731 435C771 520 744 658 660 707C597 743 427 743 364 707C280 658 253 520 293 435C338 342 467 322 512 395Z" fill="#FFD8A3"/>
  <ellipse cx="346" cy="600" rx="38" ry="25" fill="#F5A16F" opacity="0.9"/>
  <ellipse cx="678" cy="600" rx="38" ry="25" fill="#F5A16F" opacity="0.9"/>
  <circle cx="396" cy="506" r="42" fill="#2D1A12"/>
  <circle cx="628" cy="506" r="42" fill="#2D1A12"/>
  <circle cx="381" cy="491" r="13" fill="white"/>
  <circle cx="613" cy="491" r="13" fill="white"/>
  <path d="M348 420C365 402 401 398 421 414" stroke="#5A341F" stroke-width="14" stroke-linecap="round"/>
  <path d="M676 420C659 402 623 398 603 414" stroke="#5A341F" stroke-width="14" stroke-linecap="round"/>
  <ellipse cx="512" cy="578" rx="20" ry="15" fill="#5A341F"/>
  <circle cx="491" cy="568" r="11" fill="#2D1A12"/>
  <circle cx="533" cy="568" r="11" fill="#2D1A12"/>
  <path d="M430 648C452 699 572 699 594 648" stroke="#5A341F" stroke-width="14" stroke-linecap="round"/>
`;

// Accessories drawn on top of the monkey (in the 1024 coordinate space).
const PINK_BOW = `
  <g transform="translate(512 188)">
    <path d="M0 0 L-78 -42 L-78 42 Z" fill="#FF9DBE" stroke="#E0567A" stroke-width="7"/>
    <path d="M0 0 L78 -42 L78 42 Z" fill="#FF9DBE" stroke="#E0567A" stroke-width="7"/>
    <circle cx="0" cy="0" r="22" fill="#E76A93"/>
  </g>
`;
// Sunglasses pushed up onto the monkey's head (not over the eyes).
const SUNGLASSES = `
  <g transform="rotate(-6 512 340)">
    <rect x="316" y="306" width="148" height="78" rx="28" fill="#23201E"/>
    <rect x="560" y="306" width="148" height="78" rx="28" fill="#23201E"/>
    <rect x="450" y="332" width="124" height="18" rx="9" fill="#23201E"/>
    <ellipse cx="370" cy="334" rx="20" ry="10" fill="#3A3431" opacity="0.7"/>
    <ellipse cx="618" cy="334" rx="20" ry="10" fill="#3A3431" opacity="0.7"/>
  </g>
`;
const LOLLIPOP = `
  <g>
    <rect x="772" y="250" width="12" height="190" rx="6" fill="#E7CBA0"/>
    <circle cx="778" cy="232" r="50" fill="#FF6FA0"/>
    <path d="M778 232 m0 -36 a36 36 0 1 1 -25 11 a23 23 0 1 0 16 -7" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
  </g>
`;

function svg({ bg, scale = 1, accessory = '' }) {
  const background = bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : '';
  const inner = `${MONKEY}${accessory}`;
  const body =
    scale === 1
      ? inner
      : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background}${body}</svg>`;
}

const assets = path.join(__dirname, '..', 'assets');
async function render(s, file) {
  await sharp(Buffer.from(s)).png().toFile(path.join(assets, file));
  console.log('wrote', file);
}

(async () => {
  // App icon + splash + adaptive (the plain monkey)
  await render(svg({ bg: BG, scale: 0.92 }), 'icon.png');
  await render(svg({ bg: BG, scale: 0.92 }), 'favicon.png');
  await render(svg({ bg: null, scale: 0.6 }), 'adaptive-foreground.png');
  await render(svg({ bg: null, scale: 0.9 }), 'splash-icon.png');
  // Per-person avatars (transparent, with accessory)
  await render(svg({ bg: null, scale: 0.84, accessory: PINK_BOW }), 'avatar-rosi.png');
  await render(svg({ bg: null, scale: 0.84, accessory: SUNGLASSES }), 'avatar-rizal.png');
  await render(svg({ bg: null, scale: 0.84, accessory: LOLLIPOP }), 'avatar-nonik.png');
})();
