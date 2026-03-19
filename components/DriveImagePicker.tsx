import React, { useState, useEffect } from 'react';
import { X, Folder, Image as ImageIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { fetchDriveFiles, fetchFileBlob } from '../services/driveService';

interface DriveImagePickerProps {
  accessToken: string;
  onClose: () => void;
  onSelectImage: (blobUrl: string) => void;
}

export const DriveImagePicker: React.FC<DriveImagePickerProps> = ({ accessToken, onClose, onSelectImage }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folderStack, setFolderStack] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      try {
        const data = await fetchDriveFiles(accessToken, currentFolderId);
        setFiles(data);
      } catch (error) {
        console.error('Error fetching drive files:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [accessToken, currentFolderId]);

  const handleFolderClick = (folderId: string) => {
    setFolderStack([...folderStack, currentFolderId]);
    setCurrentFolderId(folderId);
  };

  const handleBack = () => {
    const prevFolderId = folderStack[folderStack.length - 1];
    setFolderStack(folderStack.slice(0, -1));
    setCurrentFolderId(prevFolderId);
  };

  const handleFileClick = async (file: any) => {
    if (file.mimeType.startsWith('image/')) {
      setImageLoading(true);
      try {
        const blob = await fetchFileBlob(accessToken, file.id);
        const url = URL.createObjectURL(blob);
        onSelectImage(url);
        onClose();
      } catch (error) {
        console.error('Error fetching image blob:', error);
      } finally {
        setImageLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Välj bild från Drive</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {folderStack.length > 0 && (
          <button onClick={handleBack} className="flex items-center gap-2 text-indigo-400 text-sm font-bold hover:text-indigo-300">
            <ArrowLeft className="w-4 h-4" /> Tillbaka
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
            {files.map(file => (
              <button 
                key={file.id}
                onClick={() => file.mimeType === 'application/vnd.google-apps.folder' ? handleFolderClick(file.id) : handleFileClick(file)}
                className="p-4 rounded-xl bg-gray-800 hover:bg-gray-700 flex flex-col items-center gap-2 text-center transition-all"
              >
                {file.mimeType === 'application/vnd.google-apps.folder' ? (
                  <Folder className="w-10 h-10 text-yellow-500" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-blue-400" />
                )}
                <span className="text-xs text-gray-300 truncate w-full">{file.name}</span>
              </button>
            ))}
          </div>
        )}
        {imageLoading && <div className="text-center text-indigo-400 font-bold">Laddar bild...</div>}
      </div>
    </div>
  );
};
