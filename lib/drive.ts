import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Load the service account credentials
const getDriveService = () => {
  const credentialsPath = process.env.DRIVE_CREDENTIALS_PATH || './data/credentials.json';
  
  if (!fs.existsSync(/*turbopackIgnore: true*/ credentialsPath)) {
    throw new Error(`Credentials file not found at ${credentialsPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
};

// Fetch all items within a folder recursively
export const listDriveFolder = async (folderId: string, parentPath: string = '') => {
  const drive = getDriveService();
  const files: any[] = [];
  
  let pageToken: string | undefined = undefined;

  do {
    const res: any = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, parents)',
      pageToken: pageToken,
      pageSize: 1000,
    });

    for (const file of res.data.files) {
      const isDirectory = file.mimeType === 'application/vnd.google-apps.folder';
      const currentPath = path.join(parentPath, file.name);
      
      files.push({
        id: file.id,
        name: file.name,
        isDirectory,
        md5Checksum: file.md5Checksum || null,
        modifiedTime: file.modifiedTime,
        path: currentPath,
        parentId: folderId,
      });

      // If it's a folder, recursively list its contents
      if (isDirectory) {
        const children = await listDriveFolder(file.id, currentPath);
        files.push(...children);
      }
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
};

import sharp from 'sharp';

// Download a file from Drive
export const downloadDriveFile = async (fileId: string, destPath: string) => {
  const drive = getDriveService();
  
  // Convert destination path to .webp
  const parsedPath = path.parse(destPath);
  const webpDestPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);

  // Ensure the directory exists
  const destDir = path.dirname(webpDestPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  const transformer = sharp()
    .resize({
      width: 800,
      height: 1000,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80 });

  return new Promise<void>((resolve, reject) => {
    res.data
      .pipe(transformer)
      .pipe(fs.createWriteStream(webpDestPath))
      .on('finish', () => resolve())
      .on('error', (err: any) => reject(err));
  });
};
