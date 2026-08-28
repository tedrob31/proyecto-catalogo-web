import prisma from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export const revalidate = 60; // ISR validation

export default async function FolderPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const resolvedParams = await params;
  const slugPath = resolvedParams.slug.join('/');
  const config = await prisma.config.findUnique({ where: { id: 'global' } });
  
  // Find the current folder
  const currentFolder = await prisma.driveItem.findFirst({
    where: { 
      path: slugPath,
      isDirectory: true 
    }
  });

  if (!currentFolder) {
    notFound();
  }

  // Fetch items inside this folder
  const items = await prisma.driveItem.findMany({
    where: { parentId: currentFolder.driveId },
    orderBy: [
      { isDirectory: 'desc' }, // Folders first
      { name: 'asc' }
    ],
  });

  const parentPath = resolvedParams.slug.length > 1 
    ? '/' + resolvedParams.slug.slice(0, -1).join('/')
    : '/';

  const imageServer = process.env.NEXT_PUBLIC_IMAGE_URL || '';

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href={parentPath} className="p-2 hover:bg-zinc-800 rounded-full transition">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1 truncate">
            <p className="text-xs text-zinc-400">CATÁLOGO / {resolvedParams.slug.join(' / ').toUpperCase()}</p>
            <h1 className="text-xl font-bold truncate">{currentFolder.name}</h1>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto p-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {items.map((item) => {
            const isFolder = item.isDirectory;
            const imgPath = isFolder ? '' : item.path.replace(/\.[^/.]+$/, ".webp");
            const imgUrl = isFolder 
              ? '/placeholder-album.png'
              : `${imageServer}/catalog/${imgPath}`;

            return (
              <Link 
                href={isFolder ? `/${item.path}` : `${imageServer}/catalog/${item.path}`} 
                key={item.id}
                target={isFolder ? '_self' : '_blank'}
                className="group flex flex-col"
              >
                <div className={`relative overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 ${isFolder ? 'aspect-square' : 'aspect-[4/5]'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={imgUrl} 
                    alt={item.name}
                    loading="lazy"
                    className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {isFolder && (config?.showAlbumNames ?? true) && (
                  <p className="mt-2 text-sm text-zinc-300 font-medium truncate px-1">
                    {item.name}
                  </p>
                )}
              </Link>
            )
          })}
        </div>

        {items.length === 0 && (
          <div className="text-center text-zinc-500 py-20">
            Esta carpeta está vacía.
          </div>
        )}
      </main>
    </div>
  );
}
