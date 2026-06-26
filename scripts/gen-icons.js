/* Generates MoMoney's caramel monkey icon set from one SVG (run with node). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const C = {
  bg: '#B07D56', // brand caramel
  earOuter: '#8E6242',
  earInner: '#F2A99B',
  head: '#CFA67E',
  face: '#F2E3CF',
  cheek: '#F2A99B',
  muzzle: '#FBF4EA',
  dark: '#4A3A2E',
};

/** Monkey artwork on a 1024 canvas. bg=null → transparent. scale shrinks the
 *  art around the center (for the Android adaptive safe zone). */
function monkeySvg({ bg, scale = 1 }) {
  const art = `
    <g transform="translate(512 512) scale(${scale}) translate(-512 -532)">
      <circle cx="292" cy="372" r="118" fill="${C.earOuter}"/>
      <circle cx="292" cy="372" r="64" fill="${C.earInner}"/>
      <circle cx="732" cy="372" r="118" fill="${C.earOuter}"/>
      <circle cx="732" cy="372" r="64" fill="${C.earInner}"/>
      <circle cx="512" cy="540" r="300" fill="${C.head}"/>
      <ellipse cx="512" cy="575" rx="232" ry="242" fill="${C.face}"/>
      <circle cx="372" cy="632" r="44" fill="${C.cheek}" opacity="0.65"/>
      <circle cx="652" cy="632" r="44" fill="${C.cheek}" opacity="0.65"/>
      <circle cx="430" cy="536" r="40" fill="${C.dark}"/>
      <circle cx="594" cy="536" r="40" fill="${C.dark}"/>
      <circle cx="444" cy="522" r="13" fill="#FFFFFF"/>
      <circle cx="608" cy="522" r="13" fill="#FFFFFF"/>
      <ellipse cx="512" cy="678" rx="120" ry="86" fill="${C.muzzle}"/>
      <ellipse cx="482" cy="666" rx="12" ry="16" fill="${C.dark}"/>
      <ellipse cx="542" cy="666" rx="12" ry="16" fill="${C.dark}"/>
      <path d="M460 706 Q512 748 564 706" stroke="${C.dark}" stroke-width="12" fill="none" stroke-linecap="round"/>
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
