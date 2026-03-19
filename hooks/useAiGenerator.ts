import { useState } from 'react';
import { generateSticker } from '../services/geminiService';
import { EditorElement } from '../types';

interface UseAiGeneratorProps {
    onAddElement: (element: EditorElement) => void;
    setIsGenerating: (loading: boolean) => void;
    isGenerating: boolean;
    aiContext: string;
    onUpdateContext: (text: string) => void;
    selectedIds: string[];
    getSelectionImage: () => Promise<string | null>;
}

export const useAiGenerator = ({
    onAddElement,
    setIsGenerating,
    isGenerating,
    aiContext,
    onUpdateContext,
    selectedIds,
    getSelectionImage
}: UseAiGeneratorProps) => {
    const [prompt, setPrompt] = useState('');
    const [activeTab, setActiveTab] = useState<'MEDIA' | 'AI' | 'LAYERS'>('MEDIA');
    const [aiSubTab, setAiSubTab] = useState<'IMAGE' | 'TEXT' | 'MIXED'>('IMAGE');
    const [useSelectionAsContext, setUseSelectionAsContext] = useState(false);

    const handleGenerateAi = async () => {
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        try {
            let imageContext: string | undefined = undefined;

            if (useSelectionAsContext && selectedIds.length > 0) {
                const base64 = await getSelectionImage();
                if (base64) imageContext = base64;
            }

            const fullPrompt = aiContext ? `Context: ${aiContext}. Request: ${prompt}` : prompt;

            const base64Image = await generateSticker(fullPrompt, imageContext);
            if (base64Image) {
                onAddElement({
                    id: crypto.randomUUID(),
                    type: 'image',
                    x: 400,
                    y: 300,
                    rotation: 0,
                    width: 350,
                    height: 350,
                    aspectRatio: 1,
                    src: base64Image
                });
                setPrompt('');
            }
        } catch (err) {
            console.error(err);
            alert('Kunde inte skapa bilden. Kontrollera din anslutning.');
        } finally {
            setIsGenerating(false);
        }
    };

    return {
        prompt,
        setPrompt,
        activeTab,
        setActiveTab,
        aiSubTab,
        setAiSubTab,
        useSelectionAsContext,
        setUseSelectionAsContext,
        handleGenerateAi
    };
};