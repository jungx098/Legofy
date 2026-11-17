import {
  targetSize,
  quantizeImage,
  stampBricks,
  legoFilename,
  effectivePalette
} from './legofy.js';

const controls = document.querySelector('#controls');
const photoInput = document.querySelector('#photo');
const bricksInput = document.querySelector('#bricks');
const brickCount = document.querySelector('#brick-count');
const paletteSelect = document.querySelector('#palette');
const ditherInput = document.querySelector('#dither');
const downloadButton = document.querySelector('#download');
const status = document.querySelector('#status');
const original = document.querySelector('#original');
const result = document.querySelector('#result');
const resultContext = result.getContext('2d');

let palettes = null;
let brick = null;
let source = null;
let sourceName = '';
let objectUrl = '';
let loadToken = 0;
let renderToken = 0;
let timer = 0;

function show(message) {
  status.textContent = message;
}

function isGif(file) {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

async function loadAssets() {
  try {
    const response = await fetch('palettes.json');
    if (!response.ok) throw new Error('palette');
    palettes = await response.json();
    const image = new Image();
    brick = await new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('brick'));
      image.src = '1x1.png';
    });
    const scratch = document.createElement('canvas');
    scratch.width = brick.naturalWidth;
    scratch.height = brick.naturalHeight;
    const context = scratch.getContext('2d');
    context.drawImage(brick, 0, 0);
    brick = context.getImageData(0, 0, scratch.width, scratch.height);
  } catch (error) {
    show('Could not load the brick sprite or the palette file.');
    photoInput.disabled = true;
    bricksInput.disabled = true;
    paletteSelect.disabled = true;
    ditherInput.disabled = true;
    downloadButton.disabled = true;
  }
}

function scheduleRender(delay) {
  const token = ++renderToken;
  clearTimeout(timer);
  timer = setTimeout(() => renderNow(token), delay);
}

function renderNow(token) {
  if (token !== renderToken || !source || !brick) return;
  const bricks = Number(bricksInput.value);
  const [gridWidth, gridHeight] = targetSize(source.width, source.height, bricks);
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = gridWidth;
  gridCanvas.height = gridHeight;
  const gridContext = gridCanvas.getContext('2d');
  gridContext.drawImage(source, 0, 0, gridWidth, gridHeight);
  const grid = gridContext.getImageData(0, 0, gridWidth, gridHeight);
  const paletteName = effectivePalette(paletteSelect.value, ditherInput.checked);
  if (paletteName) {
    quantizeImage(grid, palettes[paletteName], ditherInput.checked);
  }
  const output = stampBricks(grid, brick);
  if (token !== renderToken) return;
  result.width = output.width;
  result.height = output.height;
  resultContext.putImageData(output, 0, 0);
  downloadButton.disabled = false;
}

async function onPhoto() {
  const file = photoInput.files && photoInput.files[0];
  if (!file) return;
  if (isGif(file)) {
    show('This demo is for still images.');
    photoInput.value = '';
    return;
  }
  const token = ++loadToken;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (error) {
    if (token !== loadToken) return;
    show('Could not read that file.');
    photoInput.value = '';
    return;
  }
  if (token !== loadToken) {
    bitmap.close();
    return;
  }
  if (source) source.close();
  source = bitmap;
  sourceName = file.name;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  original.src = objectUrl;
  original.alt = 'Original photo';
  show('');
  photoInput.value = '';
  scheduleRender(0);
}

function onBricks() {
  brickCount.textContent = bricksInput.value;
  if (source) scheduleRender(100);
}

function onDownload() {
  if (downloadButton.disabled) return;
  result.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = legoFilename(sourceName);
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

photoInput.addEventListener('change', onPhoto);
bricksInput.addEventListener('input', onBricks);
paletteSelect.addEventListener('change', () => { if (source) scheduleRender(0); });
ditherInput.addEventListener('change', () => { if (source) scheduleRender(0); });
downloadButton.addEventListener('click', onDownload);

loadAssets();
