import { AppState } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';

export const fetchDriveFiles = async (
  accessToken: string, 
  folderId: string = 'root',
  driveId?: string
): Promise<any[]> => {
  const query = `'${folderId}' in parents and trashed = false`;
  
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id, name, mimeType, size, thumbnailLink, modifiedTime)',
    pageSize: '1000',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  if (driveId) {
    params.append('driveId', driveId);
    params.append('corpora', 'drive');
  } else {
    params.append('corpora', 'user');
  }

  const response = await fetch(`${DRIVE_API_URL}/files?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
     const err = await response.json();
     console.error("Drive Error:", err);
     throw new Error('Kunde inte hämta filer från Drive');
  }
  const data = await response.json();
  
  return data.files || [];
};

export const fetchSharedDrives = async (accessToken: string): Promise<any[]> => {
  const response = await fetch('https://www.googleapis.com/drive/v3/drives', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error('Kunde inte hämta delade enheter');
  }
  const data = await response.json();
  return data.drives || [];
};

export const fetchFileBlob = async (accessToken: string, fileId: string): Promise<Blob> => {
  const url = `${DRIVE_API_URL}/files/${fileId}?alt=media`;
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Kunde inte hämta fildata för: ${fileId}`);
  return await response.blob();
};

export const createFolder = async (accessToken: string, parentId: string, name: string): Promise<string> => {
  const response = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId === 'root' ? [] : [parentId]
    })
  });
  const data = await response.json();
  return data.id;
};

export const findFileInFolder = async (accessToken: string, folderId: string, filename: string): Promise<string | null> => {
    try {
        const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
        
        const params = new URLSearchParams({
            q: query,
            fields: 'files(id)',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true',
            corpora: 'user'
        });

        const response = await fetch(`${DRIVE_API_URL}/files?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }
        return null;
    } catch (e) {
        console.error("Error searching for file", e);
        return null;
    }
};

export const uploadToDrive = async (
    accessToken: string, 
    folderId: string, 
    filename: string, 
    blob: Blob,
    mimeType: string = 'application/pdf'
) => {
  const existingFileId = await findFileInFolder(accessToken, folderId, filename);

  const method = existingFileId ? 'PATCH' : 'POST';
  const url = existingFileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`;

  const metadata: any = {
    mimeType: mimeType
  };
  
  if (!existingFileId) {
      metadata.name = filename;
      metadata.parents = [folderId];
  }

  const initResponse = await fetch(url, {
    method: method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': blob.size.toString()
    },
    body: JSON.stringify(metadata)
  });

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) {
      throw new Error('Kunde inte initiera uppladdning till Drive');
  }

  await fetch(uploadUrl, { method: 'PUT', body: blob });
};

export const findOrCreateFolder = async (accessToken: string, parentId: string, folderName: string): Promise<string> => {
    const existingId = await findFileInFolder(accessToken, parentId, folderName);
    if (existingId) return existingId;
    return await createFolder(accessToken, parentId, folderName);
};

export const fetchProjectState = async (accessToken: string, folderId: string): Promise<AppState | null> => {
    const fileId = await findFileInFolder(accessToken, folderId, 'project.json');
    if (!fileId) return null;

    try {
        const blob = await fetchFileBlob(accessToken, fileId);
        const text = await blob.text();
        const stateData = JSON.parse(text);
        return stateData;
    } catch (e) {
        console.error("Corrupt project file", e);
        return null;
    }
};

export const saveProjectState = async (accessToken: string, state: AppState, parentFolderId: string = 'root'): Promise<string> => {
    // Find or create a folder for the book
    const folderName = state.bookTitle || 'Namnlös bok';
    const folderId = await findOrCreateFolder(accessToken, parentFolderId, folderName);

    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    await uploadToDrive(accessToken, folderId, 'project.json', blob, 'application/json');
    return folderId;
};
