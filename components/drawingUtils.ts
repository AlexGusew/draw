import { Path, Point, PathChunk } from "./types";

const MIN_FORCE_THRESHOLD = 0.0;
const OPTIMIZATION_TOLERANCE = 0.5;

export function drawPath(ctx: CanvasRenderingContext2D, path: Path) {
  const { color, brushSize, points } = path;
  ctx.strokeStyle = color;
  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      if (p2.force !== undefined && p2.force < MIN_FORCE_THRESHOLD) {
        continue;
      }

      const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);

      const force = p2.force || 0.5;
      ctx.lineWidth = brushSize * force;

      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midPoint.x, midPoint.y);
    }
  } else if (points.length === 1) {
    const point = points[0];
    const force = point.force || 0.5;
    if (force >= MIN_FORCE_THRESHOLD) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, (brushSize * force) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  p1: Point,
  p2: Point,
  color: string,
  lineWidth: number
) {
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

export function optimizePath(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];
  let lastPoint = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];

    const d1 = distance(lastPoint, point);
    const d2 = distance(point, nextPoint);

    if (d1 + d2 > OPTIMIZATION_TOLERANCE) {
      result.push(point);
      lastPoint = point;
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createPathChunks(
  paths: Path[],
  chunkSize: number
): PathChunk[] {
  const chunks: PathChunk[] = [];
  let currentChunk: PathChunk = { paths: [] };

  for (const path of paths) {
    if (currentChunk.paths.length >= chunkSize) {
      chunks.push(currentChunk);
      currentChunk = { paths: [] };
    }
    currentChunk.paths.push(path);
  }

  if (currentChunk.paths.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
