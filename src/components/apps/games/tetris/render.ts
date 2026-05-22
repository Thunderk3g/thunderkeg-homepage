"use client";

import {
  Board,
  COLORS,
  COLS,
  Piece,
  ROWS,
  TetrominoKind,
  pieceCells,
} from "./engine";

interface HudData {
  score: number;
  level: number;
  lines: number;
  next: TetrominoKind;
}

export interface RenderGeometry {
  // All sizes in CSS pixels.
  cell: number;
  boardW: number;
  boardH: number;
  hudX: number;
  hudW: number;
  totalW: number;
  totalH: number;
}

const COLORS_SOFT: Record<TetrominoKind, string> = COLORS;

export function computeGeometry(maxW: number, maxH: number): RenderGeometry {
  // HUD takes ~35% width on the right.
  const targetAspect = (COLS + 4.5) / ROWS; // board cols + HUD width in cells
  let totalW = Math.min(maxW, maxH * targetAspect);
  let totalH = Math.min(maxH, totalW / targetAspect);
  totalW = totalH * targetAspect;
  const cell = totalH / ROWS;
  const boardW = cell * COLS;
  const boardH = cell * ROWS;
  const hudX = boardW + cell * 0.5;
  const hudW = cell * 4;
  return {
    cell,
    boardW,
    boardH,
    hudX,
    hudW,
    totalW: hudX + hudW,
    totalH,
  };
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string,
  ghost = false,
) {
  if (ghost) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  // Inner bevel.
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px + 1, py + 1, size - 2, Math.max(1, size * 0.12));
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(
    px + 1,
    py + size - 1 - Math.max(1, size * 0.12),
    size - 2,
    Math.max(1, size * 0.12),
  );
  // Outline.
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  geom: RenderGeometry,
) {
  const { cell, boardW, boardH } = geom;
  // Backdrop.
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, boardW, boardH);

  // Subtle grid.
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cell + 0.5, 0);
    ctx.lineTo(c * cell + 0.5, boardH);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cell + 0.5);
    ctx.lineTo(boardW, r * cell + 0.5);
    ctx.stroke();
  }

  // Locked cells.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v) drawCell(ctx, c * cell, r * cell, cell, COLORS_SOFT[v]);
    }
  }

  // Border.
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, boardW - 1, boardH - 1);
}

export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  geom: RenderGeometry,
  ghost = false,
) {
  const { cell } = geom;
  const color = COLORS_SOFT[piece.kind];
  for (const [x, y] of pieceCells(piece)) {
    if (y < 0) continue;
    drawCell(ctx, x * cell, y * cell, cell, color, ghost);
  }
}

function drawMiniPiece(
  ctx: CanvasRenderingContext2D,
  kind: TetrominoKind,
  originX: number,
  originY: number,
  cellSize: number,
) {
  // Render the piece at rotation 0 into a 4x4 box centered at (originX, originY).
  // Reuse pieceCells with a synthetic piece at (0,0).
  const piece: Piece = { kind, rotation: 0, x: 0, y: 0 };
  const cells = pieceCells(piece);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [cx, cy] of cells) {
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  const wCells = maxX - minX + 1;
  const hCells = maxY - minY + 1;
  const offsetX = originX + (4 * cellSize - wCells * cellSize) / 2 - minX * cellSize;
  const offsetY = originY + (4 * cellSize - hCells * cellSize) / 2 - minY * cellSize;
  const color = COLORS_SOFT[kind];
  for (const [cx, cy] of cells) {
    drawCell(ctx, offsetX + cx * cellSize, offsetY + cy * cellSize, cellSize, color);
  }
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  hud: HudData,
  geom: RenderGeometry,
) {
  const { hudX, hudW, totalH, cell } = geom;

  ctx.fillStyle = "#13161f";
  ctx.fillRect(hudX, 0, hudW, totalH);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hudX + 0.5, 0.5, hudW - 1, totalH - 1);

  const pad = cell * 0.4;
  const labelSize = Math.max(10, cell * 0.42);
  const valueSize = Math.max(12, cell * 0.7);

  ctx.fillStyle = "#8a93a8";
  ctx.font = `${labelSize}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.textBaseline = "top";

  let y = pad;

  // NEXT label + preview box.
  ctx.fillText("NEXT", hudX + pad, y);
  y += labelSize + pad * 0.4;
  const boxSize = cell * 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(hudX + pad, y, boxSize, boxSize);
  drawMiniPiece(
    ctx,
    hud.next,
    hudX + pad,
    y,
    boxSize / 4,
  );
  y += boxSize + pad;

  const writeStat = (label: string, value: string) => {
    ctx.fillStyle = "#8a93a8";
    ctx.font = `${labelSize}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.fillText(label, hudX + pad, y);
    y += labelSize + 2;
    ctx.fillStyle = "#e6e9f2";
    ctx.font = `${valueSize}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.fillText(value, hudX + pad, y);
    y += valueSize + pad * 0.6;
  };

  writeStat("SCORE", String(hud.score));
  writeStat("LEVEL", String(hud.level));
  writeStat("LINES", String(hud.lines));
}

export function drawPaused(
  ctx: CanvasRenderingContext2D,
  geom: RenderGeometry,
) {
  const { boardW, boardH, cell } = geom;
  ctx.fillStyle = "rgba(11,13,18,0.7)";
  ctx.fillRect(0, 0, boardW, boardH);
  ctx.fillStyle = "#e6e9f2";
  ctx.font = `${cell * 1.1}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSED", boardW / 2, boardH / 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}
