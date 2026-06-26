/* Generates MoMoney's caramel monkey icon set from one SVG (run with node). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const C = {
  bg: '#B07D56', // brand caramel
  outline: '#4A3A2E', // thick dark outline
  head: '#6E5039', // medium brown head
  face: '#F3E4CC', // cream face & inner ears
  nose: '#8C6242',
  noseOutline: '#5A4030',
};

/** Cute outlined monkey on a 1024 canvas. bg=null → transparent. The outline is
 *  drawn as a slightly larger dark silhouette behind the fills for a clean,
 *  even border (matching the provided sticker style). */
function monkeySvg({ bg, scale = 1 }) {
  const art = `
    <g transform="translate(512 512) scale(${scale}) translate(-512 -520)">
      <!-- outline silhouette (ears + head) -->
      <circle cx="252" cy="476" r="130" fill="${C.outline}"/>
      <circle cx="772" cy="476" r="130" fill="${C.outline}"/>
      <ellipse cx="512" cy="522" rx="314" ry="284" fill="${C.outline}"/>
      <!-- ears -->
      <circle cx="252" cy="476" r="108" fill="${C.head}"/>
      <circle cx="772" cy="476" r="108" fill="${C.head}"/>
      <ellipse cx="252" cy="480" rx="54" ry="62" fill="${C.face}"/>
      <ellipse cx="772" cy="480" rx="54" ry="62" fill="${C.face}"/>
      <!-- head -->
      <ellipse cx="512" cy="522" rx="292" ry="262" fill="${C.head}"/>
      <!-- face -->
      <path d="M512 318
        C 624 318 706 360 706 360
        C 742 470 742 560 700 636
        C 656 712 588 752 512 752
        C 436 752 368 712 324 636
        C 282 560 282 470 318 360
        C 318 360 400 318 512 318 Z" fill="${C.face}"/>
      <!-- eyes -->
      <ellipse cx="430" cy="548" rx="33" ry="42" fill="${C.outline}"/>
      <ellipse cx="594" cy="548" rx="33" ry="42" fill="${C.outline}"/>
      <!-- nose -->
      <ellipse cx="512" cy="650" rx="34" ry="24" fill="${C.nose}" stroke="${C.noseOutline}" stroke-width="6"/>
      <!-- mouth -->
      <path d="M474 694 Q512 724 550 694" stroke="${C.outline}" stroke-width="11" fill="none" stroke-linecap="round"/>
    </g>`;
  const background = bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background}${art}</svg>`;
}

const assets = path.join(__dirname, '..', 'assets');

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(assets, file));
  console.log('wrote', file);
}

(async () => {
  await render(monkeySvg({ bg: C.bg, scale: 1 }), 'icon.png');
  await render(monkeySvg({ bg: C.bg, scale: 1 }), 'favicon.png');
  // Android adaptive foreground: transparent, art inside the safe zone.
  await render(monkeySvg({ bg: null, scale: 0.62 }), 'adaptive-foreground.png');
  // Splash mark: transparent monkey, cream background comes from the plugin.
  await render(monkeySvg({ bg: null, scale: 0.9 }), 'splash-icon.png');
})();
