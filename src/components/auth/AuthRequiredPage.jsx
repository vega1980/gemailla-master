import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';

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
    <main className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-[#f7fbfc] px-5 pb-[clamp(1.5rem,4svh,3rem)] pt-[clamp(1.25rem,5svh,4rem)] text-slate-900 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(8,145,160,0.12),transparent_30%),radial-gradient(circle_at_85%_8%,rgba(180,134,11,0.1),transparent_28%)]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-clamp(2.75rem,9svh,7rem))] w-full max-w-[760px] flex-col items-center justify-start">
        <div className="text-center">
          <img
            className="mx-auto h-44 w-44 shrink-0 object-contain drop-shadow-[0_12px_14px_rgba(105,67,0,0.28)] sm:h-52 sm:w-52"
            src="/assets/logo-emblem-metallic.png"
            alt="Gemailla IA"
          />
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.08em] text-[#626c71]">La evolución de la asesoría empresarial</p>
          <h1 className="metallic-gray-title mt-1 font-display text-4xl font-bold tracking-[0.05em] sm:text-5xl">GEMAILLA IA</h1>
        </div>

        <p className="mt-[clamp(0.75rem,2svh,1.25rem)] text-center text-base font-medium leading-7 text-slate-600 sm:text-lg">
          Inicia sesión con tu correo y contraseña para acceder al panel.
        </p>

        <form
          className="enterprise-panel mt-[clamp(1rem,2.75svh,2rem)] w-full max-w-[680px] space-y-4 rounded-2xl p-5 text-left sm:p-7"
          onSubmit={handleSubmit}
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-800" htmlFor="auth-email">
            Correo autorizado
          </label>
          <input
            id="auth-email"
            className="w-full rounded-lg border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-800" htmlFor="auth-password">
            Contraseña
          </label>
          <input
            id="auth-password"
            className="w-full rounded-lg border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="embossed-button w-full rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </main>
  );
}
