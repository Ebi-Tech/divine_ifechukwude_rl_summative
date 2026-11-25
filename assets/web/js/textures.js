import * as THREE from "three";

const cache = new Map();

function finishTexture(canvas, repeat = false) {
  /** Wrap a drawn canvas as an sRGB texture, optionally tiling. */
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeCanvas(width, height) {
  /** Return a canvas and its 2D context. */
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext("2d") };
}

export function cached(key, build) {
  /** Return the texture for a key, building it only the first time. */
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

function fitText(context, text, maxWidth) {
  /** Shrink the current font until the text fits the width. */
  let size = parseInt(context.font.match(/(\d+)px/)[1], 10);
  while (context.measureText(text).width > maxWidth && size > 10) {
    size -= 4;
    context.font = context.font.replace(/\d+px/, `${size}px`);
  }
}

function grain(context, width, height, amount = 0.06) {
  /** Scatter faint specks and streaks over a painted board so it looks hand painted and weathered. */
  for (let i = 0; i < (width * height) / 900; i += 1) {
    context.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${amount})` : `rgba(255,255,255,${amount})`;
    context.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

export function signTexture(text, options = {}) {
  /** Return a painted signboard texture with centred text, created once per text and style. */
  const { background = "#f4ead5", color = "#2b1d14", border = "rgba(43,29,20,0.55)", width = 1024, height = 256,
    font = "800 120px system-ui, sans-serif", subtitle = "", weathered = true } = options;
  const key = `sign|${text}|${background}|${color}|${width}x${height}|${subtitle}|${font}`;
  return cached(key, () => {
    const { canvas, context } = makeCanvas(width, height);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    if (weathered) grain(context, width, height, 0.05);
    context.strokeStyle = border;
    context.lineWidth = height * 0.06;
    context.strokeRect(height * 0.05, height * 0.05, width - height * 0.1, height - height * 0.1);
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = font;
    fitText(context, text, width * 0.9);
    context.fillText(text, width / 2, subtitle ? height * 0.42 : height / 2 + height * 0.03);
    if (subtitle) {
      context.font = `600 ${Math.round(height * 0.2)}px system-ui, sans-serif`;
      fitText(context, subtitle, width * 0.85);
      context.fillText(subtitle, width / 2, height * 0.77);
    }
    return finishTexture(canvas);
  });
}

export function bannerTexture(text) {
  /** Return a cloth banner texture with a woven border, created once. */
  return cached(`banner|${text}`, () => {
    const { canvas, context } = makeCanvas(1024, 192);
    context.fillStyle = "#1f8a4c";
    context.fillRect(0, 0, 1024, 192);
    for (let x = 0; x < 1024; x += 32) {
      context.fillStyle = x % 64 ? "#f2c14e" : "#2a6fb5";
      context.fillRect(x, 0, 32, 16);
      context.fillRect(x, 176, 32, 16);
    }
    context.fillStyle = "#fffaf0";
    context.font = "italic 800 96px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 512, 100);
    return finishTexture(canvas);
  });
}

const KITENGE_PALETTES = [
  ["#e4572e", "#f2c14e", "#17a398", "#2b1d14"],
  ["#6a4c93", "#f2a541", "#1982c4", "#fffaf0"],
  ["#2a9d8f", "#e9c46a", "#e76f51", "#264653"],
  ["#d62828", "#fcbf49", "#003049", "#eae2b7"],
  ["#3f9b4a", "#f7f3e8", "#1d1d2b", "#f2c14e"],
  ["#1f4e79", "#f2b631", "#c8352e", "#f7f3e8"],
];

export function kitengeTexture(variant) {
  /** Return a bold geometric wax print pattern, one of a few variants, created once. */
  return cached(`kitenge|${variant}`, () => {
    const [base, accent, third, line] = KITENGE_PALETTES[variant % KITENGE_PALETTES.length];
    const { canvas, context } = makeCanvas(128, 128);
    context.fillStyle = base;
    context.fillRect(0, 0, 128, 128);
    const style = variant % 4;
    if (style === 0) drawCircles(context, [accent, third, line, accent]);
    if (style === 1) drawDiamonds(context, [accent, line, third]);
    if (style === 2) drawWaves(context, [accent, third, line]);
    if (style === 3) drawLeaves(context, accent, third, line);
    const texture = finishTexture(canvas, true);
    texture.repeat.set(2, 3);
    return texture;
  });
}

function drawCircles(context, colors, scale = 1) {
  /** Draw concentric circle motifs. */
  for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
    [26, 18, 10, 4].forEach((radius, index) => {
      context.fillStyle = colors[index % colors.length];
      context.beginPath();
      context.arc(x * scale, y * scale, radius * scale, 0, Math.PI * 2);
      context.fill();
    });
  }
}

function drawDiamonds(context, colors, scale = 1) {
  /** Draw nested diamond motifs. */
  for (const [x, y] of [[32, 32], [96, 32], [64, 96], [0, 96], [128, 96]]) {
    [30, 20, 12].forEach((size, index) => {
      context.fillStyle = colors[index % colors.length];
      context.beginPath();
      context.moveTo(x * scale, (y - size) * scale);
      context.lineTo((x + size) * scale, y * scale);
      context.lineTo(x * scale, (y + size) * scale);
      context.lineTo((x - size) * scale, y * scale);
      context.fill();
    });
  }
}

function drawWaves(context, colors, scale = 1) {
  /** Draw thick wave bands. */
  for (let row = 0; row < 6; row += 1) {
    context.strokeStyle = colors[row % colors.length];
    context.lineWidth = 9 * scale;
    context.beginPath();
    for (let x = 0; x <= 128; x += 4) context.lineTo(x * scale, (row * 22 + 10 + Math.sin((x / 128) * Math.PI * 4) * 7) * scale);
    context.stroke();
  }
}

function drawLeaves(context, accent, third, line, scale = 1) {
  /** Draw leaf and dot motifs. */
  for (const [x, y, angle] of [[32, 40, 0.6], [96, 40, -0.6], [64, 100, 0]]) {
    context.save();
    context.translate(x * scale, y * scale);
    context.rotate(angle);
    context.fillStyle = accent;
    context.beginPath();
    context.ellipse(0, 0, 14 * scale, 30 * scale, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = line;
    context.lineWidth = 3 * scale;
    context.beginPath();
    context.moveTo(0, -28 * scale);
    context.lineTo(0, 28 * scale);
    context.stroke();
    context.restore();
  }
  context.fillStyle = third;
  for (const [x, y] of [[8, 8], [120, 8], [64, 64], [8, 120], [120, 120]]) {
    context.beginPath();
    context.arc(x * scale, y * scale, 6 * scale, 0, Math.PI * 2);
    context.fill();
  }
}

export function printMaskTexture() {
  /** Return the four ink masks for printed clothes (stripes, circles, diamonds, leaves) in one 2 by 2 atlas. */
  return cached("print-mask", () => {
    const { canvas, context } = makeCanvas(512, 512);
    context.fillStyle = "#000";
    context.fillRect(0, 0, 512, 512);
    const cells = [[0, 0], [256, 0], [0, 256], [256, 256]];
    cells.forEach(([x, y], index) => {
      context.save();
      context.beginPath();
      context.rect(x, y, 256, 256);
      context.clip();
      context.translate(x, y);
      if (index === 0) {
        context.fillStyle = "#fff";
        for (let row = 0; row < 256; row += 32) context.fillRect(0, row, 256, 13);
      } else if (index === 1) {
        drawCircles(context, ["#fff", "#000", "#fff", "#000"], 2);
      } else if (index === 2) {
        drawDiamonds(context, ["#fff", "#000", "#fff"], 2);
      } else {
        drawLeaves(context, "#fff", "#fff", "#000", 2);
      }
      context.restore();
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  });
}

export function blobTexture() {
  /** Return a soft round shadow for under people and goods. */
  return cached("blob", () => {
    const { canvas, context } = makeCanvas(64, 64);
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  });
}

export function glowTexture() {
  /** Return a warm round glow for lamp bulbs at dusk. */
  return cached("glow", () => {
    const { canvas, context } = makeCanvas(64, 64);
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,235,190,1)");
    gradient.addColorStop(0.25, "rgba(255,200,120,0.55)");
    gradient.addColorStop(1, "rgba(255,170,80,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  });
}

export function packTexture(kind) {
  /** Return plain, unbranded packaging art: noodle packs, soap bars and woven rice sacks. */
  return cached(`pack|${kind}`, () => {
    const { canvas, context } = makeCanvas(128, 128);
    if (kind === "noodles") {
      context.fillStyle = "#f2a51e";
      context.fillRect(0, 0, 128, 128);
      context.fillStyle = "#d1361f";
      context.fillRect(0, 0, 128, 30);
      context.fillRect(0, 104, 128, 24);
      context.strokeStyle = "#fff3c4";
      context.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        context.beginPath();
        for (let x = 30; x <= 98; x += 4) context.lineTo(x, 56 + i * 6 + Math.sin(x * 0.3 + i) * 3);
        context.stroke();
      }
      context.fillStyle = "#fff";
      context.font = "800 20px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("NOODLES", 64, 22);
    } else if (kind === "soap") {
      context.fillStyle = "#4aa3d0";
      context.fillRect(0, 0, 128, 128);
      context.fillStyle = "#f4fbff";
      context.fillRect(0, 44, 128, 40);
      context.fillStyle = "#2a6f9c";
      context.font = "800 26px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("SOAP", 64, 74);
    } else {
      context.fillStyle = "#f1ece0";
      context.fillRect(0, 0, 128, 128);
      context.strokeStyle = "rgba(150,135,110,0.35)";
      for (let i = 0; i < 128; i += 4) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 128);
        context.stroke();
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(128, i);
        context.stroke();
      }
      context.fillStyle = "#2a8a4a";
      context.fillRect(0, 18, 128, 10);
      context.fillStyle = "#c8352e";
      context.fillRect(0, 100, 128, 10);
      context.fillStyle = "#2a5a3a";
      context.font = "800 30px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText("RICE", 64, 72);
      context.font = "700 14px system-ui, sans-serif";
      context.fillText("25 kg", 64, 90);
    }
    return finishTexture(canvas);
  });
}

export function counterPrintTexture(color) {
  /** Return a printed counter front with a diamond border, like the stall counters in the hall, without any brand. */
  return cached(`counter|${color}`, () => {
    const { canvas, context } = makeCanvas(256, 128);
    context.fillStyle = "#f6edd6";
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = color;
    context.fillRect(0, 0, 256, 18);
    context.fillRect(0, 110, 256, 18);
    for (let x = 16; x < 256; x += 48) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x + 16, 40);
      context.lineTo(x + 34, 64);
      context.lineTo(x + 16, 88);
      context.lineTo(x - 2, 64);
      context.fill();
      context.fillStyle = "#f6edd6";
      context.beginPath();
      context.moveTo(x + 16, 54);
      context.lineTo(x + 24, 64);
      context.lineTo(x + 16, 74);
      context.lineTo(x + 8, 64);
      context.fill();
    }
    grain(context, 256, 128, 0.05);
    return finishTexture(canvas);
  });
}

export function wovenTexture() {
  /** Return a woven basket stripe texture, created once. */
  return cached("woven", () => {
    const { canvas, context } = makeCanvas(64, 64);
    const colors = ["#c99a5b", "#a5733b", "#e3c18c", "#b5462e"];
    for (let row = 0; row < 8; row += 1) {
      context.fillStyle = colors[row % colors.length];
      context.fillRect(0, row * 8, 64, 8);
    }
    context.strokeStyle = "rgba(60,35,15,0.35)";
    for (let x = 0; x < 64; x += 6) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 64);
      context.stroke();
    }
    return finishTexture(canvas, true);
  });
}

export function createChalkboard() {
  /** Return a chalkboard canvas texture that is redrawn in place each day. */
  const { canvas, context } = makeCanvas(768, 320);
  const texture = finishTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { canvas, context, texture };
}

export function drawChalkboard(board, shopName, frame, scoreLabel) {
  /** Write today's decision and the top 3 scores on a shop's chalkboard. */
  const { context, canvas, texture } = board;
  context.fillStyle = "#23392c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#7a5230";
  context.lineWidth = 22;
  context.strokeRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.textBaseline = "top";
  context.font = "600 30px 'Comic Sans MS', 'Chalkboard SE', system-ui, sans-serif";
  context.fillText(frame ? `Day ${frame.day}  ${shopName}` : shopName, 36, 30);
  context.font = "800 46px 'Chalkboard SE', system-ui, sans-serif";
  context.fillStyle = "#fff3c4";
  context.fillText(frame ? `Today: ${frame.action_label}` : "Opening soon", 36, 78);
  context.font = "500 28px 'Chalkboard SE', system-ui, sans-serif";
  context.fillStyle = "rgba(255,255,255,0.85)";
  const scores = frame && frame.scores;
  if (scores) {
    context.fillText(`Top 3 choices (${scoreLabel})`, 36, 150);
    scores.forEach((entry, index) => {
      const y = 194 + index * 38;
      context.fillStyle = "rgba(255,255,255,0.85)";
      context.fillText(`${index + 1}. ${entry.label}`, 36, y);
      context.fillStyle = "rgba(255,243,196,0.9)";
      context.fillRect(440, y + 6, Math.max(4, entry.score * 220), 20);
      context.fillText(`${Math.round(entry.score * 100)}%`, 670, y);
    });
  } else if (frame) {
    context.fillText("Run by the owner's own rules of thumb:", 36, 150);
    context.fillText("restock when low, open a sack when the bowl", 36, 194);
    context.fillText("runs out, chase old debts, keep cash safe.", 36, 232);
  }
  texture.needsUpdate = true;
}

export function tileTexture() {
  /** Return worn white wall tiles with grey grout, each tile a slightly different white, for the wash trough. */
  return cached("tiles", () => {
    const { canvas, context } = makeCanvas(256, 256);
    context.fillStyle = "#9a9a94";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const shade = 226 + Math.floor(Math.random() * 22);
        context.fillStyle = `rgb(${shade},${shade},${shade - 4 - Math.floor(Math.random() * 8)})`;
        context.fillRect(col * 64 + 3, row * 64 + 3, 58, 58);
        context.fillStyle = "rgba(255,255,255,0.35)";
        context.fillRect(col * 64 + 6, row * 64 + 6, 20, 3);
      }
    }
    grain(context, 256, 256, 0.07);
    context.fillStyle = "rgba(120,90,60,0.12)";
    context.fillRect(0, 200, 256, 56);
    return finishTexture(canvas, true);
  });
}

export function ribbedTexture() {
  /** Return the black ribbed plastic of a water tank, with lighter ribs around it. */
  return cached("ribbed", () => {
    const { canvas, context } = makeCanvas(32, 256);
    context.fillStyle = "#1c1c1e";
    context.fillRect(0, 0, 32, 256);
    for (let y = 8; y < 256; y += 21) {
      context.fillStyle = "#3a3a3e";
      context.fillRect(0, y, 32, 5);
      context.fillStyle = "#0e0e10";
      context.fillRect(0, y + 5, 32, 3);
    }
    return finishTexture(canvas, true);
  });
}

export function cloudTexture() {
  /** Return a tiling layer of soft grey and white clouds for an overcast sky. */
  return cached("clouds", () => {
    const { canvas, context } = makeCanvas(512, 512);
    context.fillStyle = "rgba(205,210,216,0.55)";
    context.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 140; i += 1) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const radius = 30 + Math.random() * 90;
      const light = 200 + Math.floor(Math.random() * 50);
      for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
        const gradient = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
        gradient.addColorStop(0, `rgba(${light},${light},${light + 4},0.55)`);
        gradient.addColorStop(1, `rgba(${light},${light},${light + 4},0)`);
        context.fillStyle = gradient;
        context.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
      }
    }
    const texture = finishTexture(canvas, true);
    texture.repeat.set(5, 5);
    return texture;
  });
}

export function signAtlas(entries) {
  /** Draw many painted signs into one tall texture, one sign per row, so every sign shares one material. */
  const rowHeight = 128;
  const { canvas, context } = makeCanvas(512, rowHeight * entries.length);
  entries.forEach(([text, background, ink], row) => {
    const top = row * rowHeight;
    context.fillStyle = background;
    context.fillRect(0, top, 512, rowHeight);
    context.strokeStyle = ink;
    context.lineWidth = 6;
    context.strokeRect(8, top + 8, 496, rowHeight - 16);
    context.fillStyle = ink;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "800 60px system-ui, sans-serif";
    fitText(context, text, 460);
    context.fillText(text, 256, top + rowHeight / 2 + 3);
  });
  grain(context, 512, rowHeight * entries.length, 0.05);
  const texture = finishTexture(canvas);
  return { texture, rows: entries.length };
}

export function atlasPlane(atlas, row, width, height) {
  /** Return a plane whose UVs show one row of a sign atlas. */
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    const v = uv.getY(i);
    uv.setY(i, 1 - (row + 1 - v) / atlas.rows);
  }
  return geometry;
}

export function windowTexture() {
  /** Return a tiling facade of window rows for distant city buildings. */
  return cached("windows", () => {
    const { canvas, context } = makeCanvas(64, 64);
    context.fillStyle = "#eeeae2";
    context.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        context.fillStyle = Math.random() < 0.15 ? "#c9d6e0" : "#4d6274";
        context.fillRect(col * 16 + 3, row * 16 + 5, 10, 8);
      }
    }
    return finishTexture(canvas, true);
  });
}
