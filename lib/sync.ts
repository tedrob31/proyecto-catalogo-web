import prisma from './prisma';
import { listDriveFolder, downloadDriveFile } from './drive';
import fs from 'fs';
import path from 'path';

export const syncCatalog = async () => {
  const catalogFolderId = process.env.DRIVE_CATALOG_FOLDER_ID;
  const dataDir = process.env.DATA_DIR || './data';
  const catalogLocalPath = process.env.IMAGES_DIR || path.join(dataDir, 'catalog');

  if (!catalogFolderId) {
    throw new Error('DRIVE_CATALOG_FOLDER_ID is not defined in environment variables');
  }

  console.log('Starting sync for catalog folder...');
  const remoteItems = await listDriveFolder(catalogFolderId);
  console.log(`Found ${remoteItems.length} items in remote drive.`);

  // 1. Get current local state from DB
  const localItems = await prisma.driveItem.findMany();
  const localItemsMap = new Map(localItems.map(item => [item.driveId, item]));

  // 2. Process remote items
  const processedDriveIds = new Set<string>();

  for (const remote of remoteItems) {
    processedDriveIds.add(remote.id);
    const local = localItemsMap.get(remote.id);

    const destPath = path.join(catalogLocalPath, remote.path);

    if (!local) {
      // NEW ITEM
      console.log(`New item detected: ${remote.path}`);
      
      // Save to DB
      await prisma.driveItem.create({
        data: {
          driveId: remote.id,
          name: remote.name,
          isDirectory: remote.isDirectory,
          parentId: remote.parentId === catalogFolderId ? null : remote.parentId, // root items have no parent in our DB logic
          path: remote.path,
          md5Checksum: remote.md5Checksum,
          lastModified: remote.modifiedTime ? new Date(remote.modifiedTime) : null,
        }
      });

      // If it's a file, download it
      if (!remote.isDirectory) {
        console.log(`Downloading: ${remote.name}`);
        await downloadDriveFile(remote.id, destPath);
      } else {
        // If it's a directory, ensure it exists
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
      }
    } else {
      // EXISTING ITEM - Check for updates
      if (!remote.isDirectory && remote.md5Checksum !== local.md5Checksum) {
        console.log(`Item changed (hash mismatch): ${remote.path}`);
        
        // Download updated file
        console.log(`Downloading updated file: ${remote.name}`);
        await downloadDriveFile(remote.id, destPath);

        // Update DB
        await prisma.driveItem.update({
          where: { id: local.id },
          data: {
            md5Checksum: remote.md5Checksum,
            lastModified: remote.modifiedTime ? new Date(remote.modifiedTime) : null,
            name: remote.name,
            path: remote.path,
          }
        });
      } else if (remote.name !== local.name || remote.path !== local.path) {
        // Just a rename or move
        console.log(`Item renamed or moved: ${local.path} -> ${remote.path}`);
        
        // Rename in filesystem if file exists (considering .webp extension)
        const oldDestPath = path.join(catalogLocalPath, local.isDirectory ? local.path : local.path.replace(/\.[^/.]+$/, ".webp"));
        const newDestPath = path.join(catalogLocalPath, remote.isDirectory ? remote.path : remote.path.replace(/\.[^/.]+$/, ".webp"));
        if (fs.existsSync(oldDestPath)) {
          // Ensure new parent directory exists
          const newDir = path.dirname(newDestPath);
          if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
          
          fs.renameSync(oldDestPath, newDestPath);
        }

        // Update DB
        await prisma.driveItem.update({
          where: { id: local.id },
          data: {
            name: remote.name,
            path: remote.path,
          }
        });
      }
    }
  }

  // 3. Delete removed items
  for (const local of localItems) {
    if (!processedDriveIds.has(local.driveId)) {
      console.log(`Item removed remotely: ${local.path}`);
      
      const destPath = path.join(catalogLocalPath, local.isDirectory ? local.path : local.path.replace(/\.[^/.]+$/, ".webp"));
      
      // Delete from filesystem
      if (fs.existsSync(destPath)) {
        if (local.isDirectory) {
          fs.rmSync(destPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(destPath);
        }
      }

      // Delete from DB (Delete cascade should handle children if configured, but let's delete manually or rely on Prisma)
      // Note: Because we process one by one, deleting a parent before a child might cause FK errors unless on cascade delete is set. 
      // It's safer to delete leaves first. However, Prisma can handle it if we delete the DB entry.
      // Wait, we didn't add onDelete: Cascade to the schema. We'll just delete it and let Prisma throw if we do it out of order, 
      // or we can sort by path length descending to delete deepest first.
    }
  }

  // Safe delete: Sort local items by path depth descending so children are deleted before parents
  const itemsToDelete = localItems.filter(local => !processedDriveIds.has(local.driveId));
  itemsToDelete.sort((a, b) => b.path.split('/').length - a.path.split('/').length);

  for (const item of itemsToDelete) {
    await prisma.driveItem.delete({
      where: { id: item.id }
    });
  }

  console.log('Sync completed successfully.');
  // Future: Revalidate Next.js cache
  // fetch('http://localhost:3000/api/revalidate?secret=...')
};
