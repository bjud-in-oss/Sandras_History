
import { Tool, Type } from "@google/genai";

// 1. SYSTEM INSTRUCTION (The Prompt)
export const SYSTEM_INSTRUCTION = `
ROLL:
Du är Lead System Architect och "Hjärnan" bakom SkapaStudio.
Du har en fysisk närvaro i form av en flytande boll med en textruta.

KONTEXT:
Du har tillgång till en lista över element på canvasen (ELEMENTS). Varje element har ID, typ (image/text) och position (x,y).
Använd denna lista för att förstå vad användaren menar med "bilden till vänster", "texten högst upp" eller "den valda bilden".

HUVUDUPPGIFT:
Din uppgift är att hjälpa användaren skapa layouter, redigera bilder och generera AI-konst.

VERKTYG (Viktigt!):
Du har full kontroll över canvasen.

- **selectElement**: MARKERA ett objekt. Använd detta om användaren pekar ut något ("den där bilden") så att de ser att du förstått.
- **updateElement**: Ändra utseende (filter, färg, storlek, position).
- **generateImage**: SKAPA eller REDIGERA bilder med AI.
  - NY BILD: Om användaren säger "Skapa en katt", använd bara 'prompt'.
  - REDIGERA/VARIATION: Om användaren säger "Ta bort kontakterna på denna", MÅSTE du skicka med 'referenceId'.
    1. Hitta rätt ID i ELEMENTS-listan (t.ex. den som är vald eller baserat på beskrivning).
    2. Anropa selectElement(id) först för tydlighet.
    3. Anropa generateImage(prompt, referenceId).

- **manageHistory**: Ångra (undo) / Gör om (redo).
- **resizeCanvas**: Ändra storlek på arbetsytan.
- **manageProject**: Spara/Ladda ner.
- **addText** / **addImage**: Lägg till innehåll.
- **deleteElement**: Ta bort.
- **moveLayer**: Flytta i djupled.
- **toggleGrid** / **setBackground**: Canvas-inställningar.
- **applyLayout**: Auto-layout.

INTERAKTION:
- Var proaktiv. Om du tror användaren menar en specifik bild, markera den.
- Håll svaren korta och på svenska.
`;

// 2. TOOL DEFINITIONS
export const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "selectElement",
        description: "Selects an element on the canvas to highlight it for the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "The ID of the element to select." }
          },
          required: ["id"]
        }
      },
      {
        name: "updateElement",
        description: "Updates properties of the currently selected element or a specific element by ID.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "The ID of the element to update. If omitted, updates the selected element." },
            color: { type: Type.STRING, description: "Hex color code (e.g. #ff0000)" },
            fontSize: { type: Type.NUMBER, description: "Font size in pixels" },
            x: { type: Type.NUMBER, description: "X position" },
            y: { type: Type.NUMBER, description: "Y position" },
            rotation: { type: Type.NUMBER, description: "Rotation in degrees" },
            text: { type: Type.STRING, description: "Update text content" },
            width: { type: Type.NUMBER, description: "Width of the element" },
            textAlign: { type: Type.STRING, enum: ["left", "center", "right"] },
            opacity: { type: Type.NUMBER, description: "Opacity from 0.0 to 1.0" },
            // Filters
            filterBrightness: { type: Type.NUMBER, description: "Brightness % (0-200, default 100)" },
            filterContrast: { type: Type.NUMBER, description: "Contrast % (0-200, default 100)" },
            filterGrayscale: { type: Type.NUMBER, description: "Grayscale % (0-100, default 0)" },
            filterSepia: { type: Type.NUMBER, description: "Sepia % (0-100, default 0)" },
            filterBlur: { type: Type.NUMBER, description: "Blur radius in pixels (0-20, default 0)" },
            // Styling
            borderRadius: { type: Type.NUMBER, description: "Border radius in pixels (for rounded corners)" },
            strokeColor: { type: Type.STRING, description: "Border color" },
            strokeWidth: { type: Type.NUMBER, description: "Border thickness" },
            shadowColor: { type: Type.STRING, description: "Shadow color" },
            shadowBlur: { type: Type.NUMBER, description: "Shadow blur radius" },
            constrainProportions: { type: Type.BOOLEAN, description: "Lock aspect ratio" }
          }
        }
      },
      {
        name: "generateImage",
        description: "Generates a new image using AI based on a text prompt. Can use an existing image as reference.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: "Creative description of the image to generate" },
            referenceId: { type: Type.STRING, description: "Optional: ID of an existing image element on canvas to use as visual reference (Image-to-Image)" }
          },
          required: ["prompt"]
        }
      },
      {
        name: "manageHistory",
        description: "Performs undo or redo operations.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["undo", "redo"] }
            },
            required: ["action"]
        }
      },
      {
        name: "resizeCanvas",
        description: "Resizes the canvas to specific dimensions or a preset.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                width: { type: Type.NUMBER, description: "Width in pixels" },
                height: { type: Type.NUMBER, description: "Height in pixels" },
                preset: { type: Type.STRING, enum: ["a4", "a4_land", "instagram", "story", "hd"], description: "Optional preset name" }
            }
        }
      },
      {
        name: "manageProject",
        description: "Saves the project or downloads the current view as an image.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["save_project", "download_image"] }
            },
            required: ["action"]
        }
      },
      {
        name: "addText",
        description: "Adds a new text element to the canvas.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The text content to add" },
            color: { type: Type.STRING, description: "Hex color (default black)" },
            fontSize: { type: Type.NUMBER, description: "Font size (default 32)" },
            x: { type: Type.NUMBER, description: "X position (default center)" },
            y: { type: Type.NUMBER, description: "Y position (default center)" }
          },
          required: ["text"]
        }
      },
      {
        name: "addImage",
        description: "Adds an image URL to the canvas (use generateImage for AI).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: "URL to image (optional, defaults to placeholder)" },
            description: { type: Type.STRING, description: "Description for alt text or generation context" }
          }
        }
      },
      {
        name: "deleteElement",
        description: "Deletes the currently selected element or specific ID.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "ID to delete. If empty, deletes selection." }
          }
        }
      },
      {
        name: "moveLayer",
        description: "Moves an element up or down in the layer stack.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            direction: { type: Type.STRING, enum: ["front", "back", "forward", "backward"] }
          },
          required: ["direction"]
        }
      },
      {
        name: "toggleGrid",
        description: "Toggles the visibility of the canvas grid.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            show: { type: Type.BOOLEAN, description: "True to show, false to hide" }
          },
          required: ["show"]
        }
      },
      {
        name: "setBackground",
        description: "Changes the canvas background color.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            color: { type: Type.STRING, description: "Hex color code" }
          },
          required: ["color"]
        }
      },
      {
        name: "applyLayout",
        description: "Arranges all elements on the canvas into a specific geometric layout.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["grid", "circle", "stack", "scatter"], description: "The type of layout to apply." }
          },
          required: ["type"]
        }
      },
      {
        name: "requestVisualContext",
        description: "Requests a screenshot of the current canvas to visually analyze it.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            target: { 
              type: Type.STRING, 
              enum: ["canvas"],
              description: "Target area"
            }
          },
          required: ["target"]
        }
      },
      {
        name: "moveHelpBubble",
        description: "Moves the help/chat bubble to a new position on the screen.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: "Screen X coordinate" },
            y: { type: Type.NUMBER, description: "Screen Y coordinate" }
          },
          required: ["x", "y"]
        }
      }
    ]
  }
];