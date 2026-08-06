import { AlertTriangle } from 'lucide-react';

export default function AuthErrorPage({ message = 'No se pudo validar la sesión.' }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7fbfc] px-6">
      <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,43,58,0.10)]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-4 text-3xl font-bold text-red-800">
          Error de autenticación
        </h1>
        <p className="text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}
