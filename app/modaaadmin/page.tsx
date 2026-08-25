import prisma from '@/lib/prisma';
import { syncCatalog } from '@/lib/sync';
import { revalidatePath } from 'next/cache';

// This is a Server Action to trigger sync
async function triggerSyncAction() {
  'use server';
  try {
    await syncCatalog();
    revalidatePath('/', 'layout'); // Revalidate everything
    return { success: true, message: 'Sincronización completada con éxito.' };
  } catch (error: any) {
    console.error('Error during sync:', error);
    return { success: false, message: error.message || 'Ocurrió un error en la sincronización.' };
  }
}

async function updateConfigAction(formData: FormData) {
  'use server';
  const title = formData.get('title') as string;
  const maintenanceMode = formData.get('maintenanceMode') === 'on';
  const showAlbumNames = formData.get('showAlbumNames') === 'on';
  
  await prisma.config.upsert({
    where: { id: 'global' },
    update: { title, maintenanceMode, showAlbumNames },
    create: { id: 'global', title, maintenanceMode, showAlbumNames }
  });
  
  revalidatePath('/', 'layout');
}

export default async function AdminPage() {
  let config = await prisma.config.findUnique({ where: { id: 'global' } });
  
  if (!config) {
    config = await prisma.config.create({
      data: { id: 'global' }
    });
  }

  const itemsCount = await prisma.driveItem.count();
  const coversCount = await prisma.albumCover.count();

  return (
    <div className="p-8 max-w-4xl mx-auto bg-zinc-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Sync Card */}
        <div className="bg-zinc-800 p-6 rounded-xl shadow-lg border border-zinc-700">
          <h2 className="text-xl font-semibold mb-4">Estado del Sistema</h2>
          <p className="text-zinc-400 mb-2">Total de items (carpetas y fotos): <span className="text-white font-bold">{itemsCount}</span></p>
          <p className="text-zinc-400 mb-6">Portadas asignadas: <span className="text-white font-bold">{coversCount}</span></p>
          
          <form action={triggerSyncAction}>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition">
              Sincronizar con Google Drive
            </button>
          </form>
          <p className="text-xs text-zinc-500 mt-3 text-center">
            Esto puede tardar varios minutos si hay muchos archivos nuevos.
          </p>
        </div>

        {/* Config Card */}
        <div className="bg-zinc-800 p-6 rounded-xl shadow-lg border border-zinc-700">
          <h2 className="text-xl font-semibold mb-4">Configuraciones</h2>
          
          <form action={updateConfigAction} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Título de la Web</label>
              <input 
                type="text" 
                name="title" 
                defaultValue={config.title}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white" 
              />
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="showAlbumNames" 
                name="showAlbumNames" 
                defaultChecked={config.showAlbumNames}
                className="w-5 h-5"
              />
              <label htmlFor="showAlbumNames" className="text-sm text-zinc-300">
                Mostrar Nombres de Álbumes
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="maintenanceMode" 
                name="maintenanceMode" 
                defaultChecked={config.maintenanceMode}
                className="w-5 h-5 accent-red-500"
              />
              <label htmlFor="maintenanceMode" className="text-sm text-red-400 font-semibold">
                Activar Modo Mantenimiento
              </label>
            </div>

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg font-medium transition mt-4">
              Guardar Configuración
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
