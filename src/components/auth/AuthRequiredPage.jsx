import { ShieldCheck } from 'lucide-react';

export default function AuthRequiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050505] px-6">
      <section className="w-full max-w-lg rounded-2xl border border-amber-300/20 bg-[#080808] p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-300/10 text-amber-200">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-amber-200/70">
          GEMAILLA IA
        </p>
        <h1 className="mb-4 text-3xl font-bold text-amber-100">
          Acceso restringido
        </h1>
        <p className="text-sm leading-6 text-stone-300">
          Debes iniciar sesión con una cuenta autorizada para acceder al panel y a los módulos de negocio.
        </p>
        <p className="mt-6 rounded-lg border border-amber-300/10 bg-amber-300/5 p-4 text-xs leading-5 text-stone-400">
          Si ya cuentas con acceso, inicia sesión mediante el proveedor de identidad configurado para este entorno.
        </p>
      </section>
    </main>
  );
}
