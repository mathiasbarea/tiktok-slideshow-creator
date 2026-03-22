const fs = require('fs');
const { GlobalFonts } = require('@napi-rs/canvas');

function registerWindowsFallbackFonts() {
  const fontCandidates = [
    { path: 'C:/Windows/Fonts/arial.ttf', family: 'Arial' },
    { path: 'C:/Windows/Fonts/arialbd.ttf', family: 'Arial Bold' },
    { path: 'C:/Windows/Fonts/segoeui.ttf', family: 'Segoe UI' },
    { path: 'C:/Windows/Fonts/segoeuib.ttf', family: 'Segoe UI Bold' }
  ];

  for (const candidate of fontCandidates) {
    if (!fs.existsSync(candidate.path)) continue;
    try {
      GlobalFonts.registerFromPath(candidate.path, candidate.family);
    } catch {}
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function cleanRenderableText(value) {
  return normalizeText(value).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

function wrapText(ctx, text, maxWidth) {
  const cleanText = cleanRenderableText(text);
  const manualLines = cleanText.split('\n');
  const wrapped = [];

  for (const line of manualLines) {
    if (ctx.measureText(line.trim()).width <= maxWidth) {
      wrapped.push(line.trim());
      continue;
    }

    const words = line.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
  }

  return wrapped.filter(Boolean);
}

function buildFontDeclaration(slot, fontSize) {
  const family = slot.fontFamily || 'Arial';
  const weight = slot.fontWeight || (family.toLowerCase().includes('bold') ? 'bold' : 'normal');
  return `${weight} ${Math.round(fontSize)}px "${family}", Arial, "Segoe UI", sans-serif`;
}

function fitTextToSlot(ctx, text, slot, scaleX, scaleY) {
  const width = Math.round(slot.width * scaleX);
  const height = Math.round(slot.height * scaleY);
  const maxLines = slot.maxLines || 6;
  const minFontSize = Math.max(16, Math.round((slot.minFontSize || 22) * Math.min(scaleX, scaleY)));
  let fontSize = Math.round((slot.fontSize || 42) * Math.min(scaleX, scaleY));

  while (fontSize >= minFontSize) {
    ctx.font = buildFontDeclaration(slot, fontSize);
    const lines = wrapText(ctx, text, width);
    const limitedLines = lines.slice(0, maxLines);
    const lineHeight = fontSize * (slot.lineHeight || 1.2);
    if (limitedLines.length <= maxLines && (limitedLines.length * lineHeight) <= height) {
      return { lines: limitedLines, fontSize, lineHeight };
    }
    fontSize -= 2;
  }

  ctx.font = buildFontDeclaration(slot, minFontSize);
  const lines = wrapText(ctx, text, width).slice(0, maxLines);
  return {
    lines,
    fontSize: minFontSize,
    lineHeight: minFontSize * (slot.lineHeight || 1.2),
  };
}

function drawTextInSlot(ctx, text, slot, canvasWidth, canvasHeight) {
  const scaleX = canvasWidth / 1080;
  const scaleY = canvasHeight / 1920;
  const x = slot.x * scaleX;
  const y = slot.y * scaleY;
  const width = slot.width * scaleX;
  const height = slot.height * scaleY;
  const { lines, fontSize, lineHeight } = fitTextToSlot(ctx, text, slot, scaleX, scaleY);
  const totalHeight = lines.length * lineHeight;
  const baseY = slot.valign === 'middle'
    ? y + ((height - totalHeight) / 2)
    : slot.valign === 'bottom'
      ? y + height - totalHeight
      : y;

  ctx.font = buildFontDeclaration(slot, fontSize);
  ctx.textAlign = slot.align || 'center';
  ctx.textBaseline = 'top';

  const textX = slot.align === 'left'
    ? x
    : slot.align === 'right'
      ? x + width
      : x + (width / 2);

  if (slot.stroke) {
    ctx.strokeStyle = slot.stroke;
    ctx.lineWidth = Math.max(1, Math.round((slot.strokeWidth || 3) * Math.min(scaleX, scaleY)));
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineY = baseY + (index * lineHeight);
    if (slot.stroke) ctx.strokeText(lines[index], textX, lineY);
    ctx.fillStyle = slot.fill || '#111111';
    ctx.fillText(lines[index], textX, lineY);
  }
}

module.exports = {
  drawTextInSlot,
  normalizeText,
  registerWindowsFallbackFonts,
  wrapText,
};
