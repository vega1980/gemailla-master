import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthRequiredPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo iniciar sesión. Revisa tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050505] px-6 py-10">
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

        <form className="mt-8 space-y-4 text-left" onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/70" htmlFor="auth-email">
            Correo autorizado
          </label>
          <input
            id="auth-email"
            className="w-full rounded-lg border border-amber-300/20 bg-black/30 px-4 py-3 text-sm text-amber-50 outline-none transition focus:border-amber-200/70"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/70" htmlFor="auth-password">
            Contraseña
          </label>
          <input
            id="auth-password"
            className="w-full rounded-lg border border-amber-300/20 bg-black/30 px-4 py-3 text-sm text-amber-50 outline-none transition focus:border-amber-200/70"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {errorMessage && (
            <p className="rounded-lg border border-red-300/20 bg-red-500/10 p-3 text-xs leading-5 text-red-100" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-amber-200 px-4 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-6 rounded-lg border border-amber-300/10 bg-amber-300/5 p-4 text-xs leading-5 text-stone-400">
          Usa el proveedor de Firebase Email/Password configurado para este entorno local.
        </p>
      </section>
    </main>
  );
}
