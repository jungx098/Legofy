// Resize, quantize, and stamp a photo the way legofy/__init__.py does.
// The browser resample is not Pillow Lanczos. Grid size uses the same
// round-half-to-even rule as Python 3 round().

export function pythonRound(value) {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function targetSize(width, height, bricks) {
  let newWidth = width;
  let newHeight = height;
  if (newWidth > bricks || newHeight > bricks) {
    const scale = newWidth < newHeight ? newHeight / bricks : newWidth / bricks;
    newWidth = pythonRound(newWidth / scale) || 1;
    newHeight = pythonRound(newHeight / scale) || 1;
  }
  return [newWidth, newHeight];
}

export function overlayChannel(spriteValue, overlay) {
  let value;
  if (spriteValue < 33) value = overlay - 100;
  else if (spriteValue > 233) value = overlay + 100;
  else value = overlay - 133 + spriteValue;
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function nearestColor(red, green, blue, colors) {
  let best = colors[0];
  let bestDistance = Infinity;
  for (let index = 0; index < colors.length; index += 1) {
    const color = colors[index];
    const dr = red - color[0];
    const dg = green - color[1];
    const db = blue - color[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best;
}

function paletteColors(flat) {
  const colors = [];
  for (let index = 0; index < flat.length; index += 3) {
    colors.push([flat[index], flat[index + 1], flat[index + 2]]);
  }
  return colors;
}

function addError(pixels, width, height, x, y, er, eg, eb, factor) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 3;
  pixels[offset] += er * factor;
  pixels[offset + 1] += eg * factor;
  pixels[offset + 2] += eb * factor;
}

export function quantizeImage(imageData, flatPalette, dither) {
  const colors = paletteColors(flatPalette);
  const { width, height, data } = imageData;
  const pixels = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const offset = (y * width + x) * 3;
      pixels[offset] = data[source];
      pixels[offset + 1] = data[source + 1];
      pixels[offset + 2] = data[source + 2];
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const red = Math.min(255, Math.max(0, pixels[offset]));
      const green = Math.min(255, Math.max(0, pixels[offset + 1]));
      const blue = Math.min(255, Math.max(0, pixels[offset + 2]));
      const chosen = nearestColor(red, green, blue, colors);
      pixels[offset] = chosen[0];
      pixels[offset + 1] = chosen[1];
      pixels[offset + 2] = chosen[2];
      if (dither) {
        const er = red - chosen[0];
        const eg = green - chosen[1];
        const eb = blue - chosen[2];
        addError(pixels, width, height, x + 1, y, er, eg, eb, 7 / 16);
        addError(pixels, width, height, x - 1, y + 1, er, eg, eb, 3 / 16);
        addError(pixels, width, height, x, y + 1, er, eg, eb, 5 / 16);
        addError(pixels, width, height, x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const offset = (y * width + x) * 3;
      data[source] = pixels[offset];
      data[source + 1] = pixels[offset + 1];
      data[source + 2] = pixels[offset + 2];
      data[source + 3] = 255;
    }
  }
  return imageData;
}

export function stampBricks(grid, brick) {
  const gridWidth = grid.width;
  const gridHeight = grid.height;
  const brickWidth = brick.width;
  const brickHeight = brick.height;
  const output = new ImageData(gridWidth * brickWidth, gridHeight * brickHeight);
  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const cell = (gy * gridWidth + gx) * 4;
      const cellRed = grid.data[cell];
      const cellGreen = grid.data[cell + 1];
      const cellBlue = grid.data[cell + 2];
      for (let by = 0; by < brickHeight; by += 1) {
        for (let bx = 0; bx < brickWidth; bx += 1) {
          const sprite = (by * brickWidth + bx) * 4;
          const destX = gx * brickWidth + bx;
          const destY = gy * brickHeight + by;
          const dest = (destY * output.width + destX) * 4;
          output.data[dest] = overlayChannel(brick.data[sprite], cellRed);
          output.data[dest + 1] = overlayChannel(brick.data[sprite + 1], cellGreen);
          output.data[dest + 2] = overlayChannel(brick.data[sprite + 2], cellBlue);
          output.data[dest + 3] = 255;
        }
      }
    }
  }
  return output;
}

export function legoFilename(name) {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const baseName = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  return stem + '_lego.png';
}

export function effectivePalette(paletteName, dither) {
  if (paletteName) return paletteName;
  if (dither) return 'all';
  return '';
}
