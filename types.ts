
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

export enum FileType {
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  TEXT = 'TEXT',
  FOLDER = 'FOLDER',
  HEADER = 'HEADER',
  GOOGLE_DOC = 'GOOGLE_DOC',
  AUDIO = 'AUDIO'
}

export interface TextConfig {
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
  verticalPosition: 'top' | 'center' | 'bottom';
  color?: string; // Hex color for text
  backgroundColor?: string; // Hex color for background box
  backgroundOpacity?: number; // 0.0 to 1.0
  padding?: number; // Padding around text in the box
  boxHeight?: number; // Specific height for footer area (only relevant for footer)
}

export interface RichTextLine {
  id: string;
  text: string;
  config: TextConfig;
}

export interface PageMetadata {
  headerLines: RichTextLine[];
  footerLines: RichTextLine[];
  hideObject?: boolean;
}

export type CompressionLevel = 'low' | 'medium' | 'high';

export interface DriveFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  thumbnail?: string;
  parentId?: string;
  modifiedTime: string;
  
  // Legacy fields
  description?: string; 
  headerText?: string;
  textConfig?: TextConfig;
  hideObject?: boolean;

  // Metadata
  pageMeta?: Record<number, PageMetadata>; 
  pageCount?: number;
  
  // Local data
  isLocal?: boolean;
  fileObj?: File; 
  blobUrl?: string; 
  transcript?: string; 
  sortOrder?: number;

  // Unified Process Caching
  processedBuffer?: ArrayBuffer; // Den färdigkomprimerade datan
  processedSize?: number;        // Den exakta storleken efter komprimering
  compressionLevelUsed?: CompressionLevel; // Vilken nivå som användes för cachen
}

export interface AppSettings {
  compressionLevel: CompressionLevel;
  maxChunkSizeMB: number;
  safetyMarginPercent: number;
}

export interface ChunkData {
    id: number;
    items: DriveFile[];
    sizeBytes: number;
    isOptimized: boolean; 
    isUploading: boolean;
    isSynced: boolean;
    title: string;
}

export interface MemoryBook {
  id: string;
  title: string;
  createdAt: string;
  items: DriveFile[];
  coverImageId?: string;
  driveFolderId?: string; // ID till mappen i Google Drive där boken bor
  settings?: AppSettings; // Bok-specifika inställningar
  chunks?: ChunkData[]; // Persisted chunks
  optimizationCursor?: number; // Index where optimization stopped
  optimizationHash?: string; // Hash to verify chunks validity
}

export interface ExportedFile {
    id: string;
    name: string;
    type: 'png' | 'pdf';
    timestamp: Date;
    driveId?: string; 
}
