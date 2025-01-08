"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useReducer,
} from "react";
import {
  DrawingToolProps,
  Point,
  DrawingState,
  DrawingAction,
  PathChunk,
} from "./types";
import { drawPath, drawLine, optimizePath } from "./drawingUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import debounce from "lodash/debounce";
import { MIN_FORCE_THRESHOLD } from "@/lib/constants";

const CHUNK_SIZE = 1000; // Number of points per chunk
const SCALE_FACTOR = 0.5; // Scale factor for the low-res canvas

const initialState: DrawingState = {
  pathChunks: [],
  currentChunkIndex: -1,
  currentPathIndex: -1,
  isDrawing: false,
};

function drawingReducer(
  state: DrawingState,
  action: DrawingAction
): DrawingState {
  switch (action.type) {
    case "START_PATH":
      const newChunk: PathChunk = {
        paths: [
          {
            color: action.color,
            brushSize: action.brushSize,
            points: [action.point],
          },
        ],
      };
      return {
        pathChunks: [
          ...state.pathChunks.slice(0, state.currentChunkIndex + 1),
          newChunk,
        ],
        currentChunkIndex: state.currentChunkIndex + 1,
        currentPathIndex: 0,
        isDrawing: true,
      };
    case "UPDATE_PATH":
      if (!state.isDrawing) return state;
      const currentChunk = state.pathChunks[state.currentChunkIndex];
      const currentPath = currentChunk.paths[state.currentPathIndex];

      if (
        (action.point.force ?? 0) < MIN_FORCE_THRESHOLD &&
        currentPath.points.length > 1
      ) {
        return {
          ...state,
          isDrawing: false,
        };
      }

      if (currentPath.points.length >= CHUNK_SIZE) {
        // Start a new chunk
        const newChunk: PathChunk = {
          paths: [
            {
              ...currentPath,
              points: [
                currentPath.points[currentPath.points.length - 1],
                action.point,
              ],
            },
          ],
        };
        return {
          ...state,
          pathChunks: [...state.pathChunks, newChunk],
          currentChunkIndex: state.pathChunks.length,
          currentPathIndex: 0,
        };
      } else {
        // Update existing chunk
        const updatedChunks = state.pathChunks.map((chunk, index) =>
          index === state.currentChunkIndex
            ? {
                ...chunk,
                paths: chunk.paths.map((path, pathIndex) =>
                  pathIndex === state.currentPathIndex
                    ? { ...path, points: [...path.points, action.point] }
                    : path
                ),
              }
            : chunk
        );
        return {
          ...state,
          pathChunks: updatedChunks,
        };
      }
    case "END_PATH":
      console.log("END_PATH", state, state.isDrawing);

      if (!state.isDrawing) return state;
      return {
        ...state,
        pathChunks: [
          ...state.pathChunks.slice(0, -3),
          ...state.pathChunks.slice(-3).map((chunk) => ({
            ...chunk,
            paths: chunk.paths.map((c) => ({
              ...c,
              points: optimizePath(c.points),
            })),
          })),
        ],
        isDrawing: false,
      };

    case "UNDO":
      if (state.currentChunkIndex < 0) return state;
      if (state.currentPathIndex > 0) {
        return {
          ...state,
          currentPathIndex: state.currentPathIndex - 1,
        };
      } else if (state.currentChunkIndex > 0) {
        const prevChunk = state.pathChunks[state.currentChunkIndex - 1];
        return {
          ...state,
          currentChunkIndex: state.currentChunkIndex - 1,
          currentPathIndex: prevChunk.paths.length - 1,
        };
      }
      return state;
    case "REDO":
      const lastChunk = state.pathChunks[state.currentChunkIndex];
      if (state.currentPathIndex < lastChunk.paths.length - 1) {
        return {
          ...state,
          currentPathIndex: state.currentPathIndex + 1,
        };
      } else if (state.currentChunkIndex < state.pathChunks.length - 1) {
        return {
          ...state,
          currentChunkIndex: state.currentChunkIndex + 1,
          currentPathIndex: 0,
        };
      }
      return state;
    case "CLEAR":
      return initialState;
    default:
      return state;
  }
}

const DrawingTool: React.FC<DrawingToolProps> = React.memo(function Comp({
  width,
  height,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lowResCanvasRef = useRef<HTMLCanvasElement>(null);
  const [state, dispatch] = useReducer(drawingReducer, initialState);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [touchThreshold, setTouchThreshold] = useState(10);

  const renderFullQuality = useCallback(() => {
    const canvas = canvasRef.current;
    const lowResCanvas = lowResCanvasRef.current;
    if (canvas && lowResCanvas) {
      const ctx = canvas.getContext("2d");
      const lowResCtx = lowResCanvas.getContext("2d");
      if (ctx && lowResCtx) {
        // Clear both canvases
        ctx.clearRect(0, 0, width, height);
        lowResCtx.clearRect(0, 0, width * SCALE_FACTOR, height * SCALE_FACTOR);

        // Set background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);
        lowResCtx.fillStyle = "white";
        lowResCtx.fillRect(0, 0, width * SCALE_FACTOR, height * SCALE_FACTOR);

        // Draw paths on both canvases
        state.pathChunks
          .slice(0, state.currentChunkIndex + 1)
          .forEach((chunk) => {
            chunk.paths.slice(0, state.currentPathIndex + 1).forEach((path) => {
              drawPath(ctx, path);
              drawPath(lowResCtx, {
                ...path,
                brushSize: path.brushSize * SCALE_FACTOR,
                points: path.points.map((p) => ({
                  ...p,
                  x: p.x * SCALE_FACTOR,
                  y: p.y * SCALE_FACTOR,
                })),
              });
            });
          });

        // Show high-res canvas and hide low-res canvas
        canvas.style.opacity = "1";
        lowResCanvas.style.opacity = "0";
      }
    }
  }, [
    state.pathChunks,
    state.currentChunkIndex,
    state.currentPathIndex,
    width,
    height,
  ]);

  // const debouncedFullRender = useMemo(
  //   () => debounce(renderFullQuality, 200),
  //   [renderFullQuality]
  // );

  useEffect(() => {
    const canvas = canvasRef.current;
    const lowResCanvas = lowResCanvasRef.current;
    if (canvas && lowResCanvas) {
      canvas.width = width;
      canvas.height = height;
      lowResCanvas.width = width * SCALE_FACTOR;
      lowResCanvas.height = height * SCALE_FACTOR;
      renderFullQuality();
    }
  }, [width, height, renderFullQuality]);

  useEffect(() => {
    renderFullQuality();
  }, [
    state.pathChunks,
    state.currentChunkIndex,
    state.currentPathIndex,
    renderFullQuality,
  ]);

  const getPointFromEvent = useCallback(
    (e: React.PointerEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (e.pointerType === "touch") {
        const touchArea = (e.width || 0) * (e.height || 0);
        if (touchArea > touchThreshold) {
          return null;
        }
      }

      const force = e.pressure !== 0 ? e.pressure : 0.5;
      return { x, y, force };
    },
    [touchThreshold]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const point = getPointFromEvent(e);
      if (point) dispatch({ type: "START_PATH", point, color, brushSize });
    },
    [getPointFromEvent, color, brushSize]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const point = getPointFromEvent(e);
      if (point && state.isDrawing) {
        const canvas = canvasRef.current;
        const lowResCanvas = lowResCanvasRef.current;
        if (canvas && lowResCanvas) {
          const lowResCtx = lowResCanvas.getContext("2d");
          if (lowResCtx) {
            const currentChunk = state.pathChunks[state.currentChunkIndex];
            const currentPath = currentChunk.paths[state.currentPathIndex];
            const lastPoint = currentPath.points[currentPath.points.length - 1];
            drawLine(
              lowResCtx,
              {
                x: lastPoint.x * SCALE_FACTOR,
                y: lastPoint.y * SCALE_FACTOR,
              },
              { x: point.x * SCALE_FACTOR, y: point.y * SCALE_FACTOR },
              currentPath.color,
              currentPath.brushSize * SCALE_FACTOR * (point.force || 0.5)
            );

            // Show low-res canvas and hide high-res canvas during drawing
            canvas.style.opacity = "0";
            lowResCanvas.style.opacity = "1";
          }
        }
        dispatch({ type: "UPDATE_PATH", point });
      }
    },
    [
      getPointFromEvent,
      state.isDrawing,
      state.pathChunks,
      state.currentChunkIndex,
      state.currentPathIndex,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dispatch({ type: "END_PATH" });
      renderFullQuality();
    },
    [renderFullQuality]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dispatch({ type: "END_PATH" });
      renderFullQuality();
    },
    [renderFullQuality]
  );

  const clearCanvas = useCallback(() => {
    dispatch({ type: "CLEAR" });
    renderFullQuality();
  }, [renderFullQuality]);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const canvasProps = useMemo(
    () => ({
      width,
      height,
      className: "border border-gray-300 rounded-lg shadow-lg touch-none",
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      style: { touchAction: "none" } as React.CSSProperties,
    }),
    [
      width,
      height,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    ]
  );

  return (
    <div className="flex flex-col items-center space-y-4">
      <pre>
        Chunks{" "}
        {JSON.stringify(
          state.pathChunks.map((c) =>
            c.paths.reduce((acc, p) => acc + p.points.length, 0)
          )
        )}
      </pre>
      <div className="relative">
        <canvas
          ref={lowResCanvasRef}
          width={width * SCALE_FACTOR}
          height={height * SCALE_FACTOR}
          className="absolute top-0 left-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
        <canvas ref={canvasRef} {...canvasProps} />
      </div>
      <div className="flex space-x-4 items-center">
        <div>
          <Label htmlFor="color">Color:</Label>
          <Input
            id="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-16 h-8"
          />
        </div>
        <div>
          <Label htmlFor="brushSize">Brush Size:</Label>
          <Input
            id="brushSize"
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div>
          <Label htmlFor="touchThreshold">Palm Rejection Sensitivity:</Label>
          <Input
            id="touchThreshold"
            type="range"
            min="1"
            max="50"
            value={touchThreshold}
            onChange={(e) => setTouchThreshold(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <Button
          onClick={undo}
          disabled={
            state.currentChunkIndex < 0 ||
            (state.currentChunkIndex === 0 && state.currentPathIndex === 0)
          }
        >
          Undo
        </Button>
        <Button
          onClick={redo}
          disabled={
            state.currentChunkIndex === state.pathChunks.length - 1 &&
            state.currentPathIndex ===
              state.pathChunks[state.currentChunkIndex]?.paths.length - 1
          }
        >
          Redo
        </Button>
        <Button onClick={clearCanvas}>Clear</Button>
      </div>
    </div>
  );
});

export default DrawingTool;
