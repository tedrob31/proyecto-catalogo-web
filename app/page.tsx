import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Search } from 'lucide-react';

export const revalidate = 60; // ISR validation, can be adjusted or done via on-demand revalidation

export default async function CatalogRoot({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams.q || '';
  const config = await prisma.config.findUnique({ where: { id: 'global' } });
  
  // Fetch items. If query exists, search across all items. Otherwise, just fetch root folders.
  let items = [];
  
  if (q.trim()) {
    items = await prisma.driveItem.findMany({
      where: {
        name: { contains: q },
        // if we want to search files and folders
      },
      take: 20,
    });
  } else {
    items = await prisma.driveItem.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
  }

  const imageServer = process.env.NEXT_PUBLIC_IMAGE_URL || '';

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* Header & Search */}
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-zinc-900 p-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          <h1 className="text-xl font-bold">{config?.title || 'CATÁLOGO'}</h1>
          <form className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <input 
              type="text" 
              name="q"
              defaultValue={q}
              placeholder="Buscar álbumes y fotos..." 
              className="w-full bg-zinc-900 text-white rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-zinc-700"
            />
          </form>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto p-4 mt-4">
        {q ? <h2 className="text-lg font-semibold mb-4">Resultados de búsqueda</h2> : <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">Álbumes</h2>}
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {items.map((item) => {
            const isFolder = item.isDirectory;
            const imgPath = isFolder ? '' : item.path.replace(/\.[^/.]+$/, ".webp");
            const imgUrl = isFolder 
              ? '/placeholder-album.png' // We will integrate album covers later
              : `${imageServer}/catalog/${imgPath}`;

            return (
              <Link 
                href={isFolder ? `/${item.path}` : `${imageServer}/catalog/${item.path}`} 
                key={item.id}
                target={isFolder ? '_self' : '_blank'}
                className="group flex flex-col"
              >
                <div className="aspect-square relative overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={imgUrl} 
                    alt={item.name}
                    loading="lazy"
                    className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {(config?.showAlbumNames ?? true) && (
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
            No se encontraron resultados.
          </div>
        )}
      </main>
    </div>
  );
}
