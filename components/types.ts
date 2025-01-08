export interface Point {
  x: number;
  y: number;
  force?: number;
}

export interface Path {
  color: string;
  brushSize: number;
  points: Point[];
}

export interface PathChunk {
  paths: Path[];
}

export interface DrawingState {
  pathChunks: PathChunk[];
  currentChunkIndex: number;
  currentPathIndex: number;
  isDrawing: boolean;
}

export interface DrawingToolProps {
  width: number;
  height: number;
}

export type DrawingAction =
  | { type: "START_PATH"; point: Point; color: string; brushSize: number }
  | { type: "UPDATE_PATH"; point: Point }
  | { type: "END_PATH" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };
