import { GoogleGenAI } from "@google/genai";

export const generateSticker = async (prompt: string, imageContext?: string): Promise<string | null> => {
  try {
    // Initialize inside function to ensure we use the current API_KEY from process.env
    // which might be set after the module loads.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = [];
    
    // Add image first if available (multimodal input)
    if (imageContext) {
      // Remove header if present (data:image/png;base64,)
      const base64Data = imageContext.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }

    parts.push({
      text: imageContext 
        ? `Use the attached image as a reference layout/composition. ${prompt}. Ensure high quality, clear background.` 
        : `Generate a high quality sticker-style illustration of: ${prompt}. White background, clear outlines.`
    });

    const response = await ai.models.generateContent({
      model: imageContext ? 'gemini-3.1-flash-image-preview' : 'gemini-3.1-flash-image-preview', // Use appropriate model
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating sticker:", error);
    throw error;
  }
};