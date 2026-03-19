
export type ElementType = 'image' | 'text';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  width?: number;
  height?: number;
  opacity?: number; // 0 to 1
}

export interface ImageElement extends CanvasElement {
  type: 'image';
  src: string; // Base64 or URL
  aspectRatio: number;
  constrainProportions?: boolean; // Defaults to true
  // Filters
  filterBrightness?: number; // 100 is default
  filterContrast?: number;   // 100 is default
  filterGrayscale?: number;  // 0 is default
  filterSepia?: number;      // 0 is default
  filterBlur?: number;       // 0 is default
  // Styling
  borderRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface TextElement extends CanvasElement {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  padding: number;
  lineHeight: number;
  // Advanced styling
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export type EditorElement = ImageElement | TextElement;

export interface CanvasPage {
  id: string;
  elements: EditorElement[];
  backgroundColor: string;
}

export interface AppState {
  pages: CanvasPage[];
  currentPageId: string;
  bookTitle: string;
  selectedIds: string[]; // Changed from single ID to array
  editingId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  isGenerating: boolean;
  showGrid: boolean;
  snapToGrid: boolean; // New: Snap toggle
  customColors: string[];
  aiContext: string;
  // Initiative removed
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  image?: string; // Base64 data for visual context
  timestamp: number;
}
