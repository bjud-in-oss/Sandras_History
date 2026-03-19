export const CANVAS_PRESETS = [
    { id: 'a4', label: 'A4 (Stående)', width: 794, height: 1123 },
    { id: 'a4_land', label: 'A4 (Liggande)', width: 1123, height: 794 },
    { id: 'a3', label: 'A3 (Stående)', width: 1123, height: 1587 },
    { id: 'insta_sq', label: 'Instagram (1:1)', width: 1080, height: 1080 },
    { id: 'insta_port', label: 'Instagram (4:5)', width: 1080, height: 1350 },
    { id: 'story', label: 'Story (9:16)', width: 1080, height: 1920 },
    { id: 'hd', label: 'Full HD (16:9)', width: 1920, height: 1080 },
];

export const DEFAULT_PRESET = CANVAS_PRESETS[0];