import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthRequiredPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const invalidCredentials = [
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password',
      ].includes(error?.code);

      setErrorMessage(
        invalidCredentials
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Revisa tus datos e inténtalo otra vez.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#09090B] px-5 text-white">
      <img
        src="/assets/auth-bg.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />









      <section className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[680px] flex-col items-center justify-start px-5 pb-8 pt-[clamp(2.25rem,6vh,4.5rem)]">
        <img
          src="/assets/logo-full.png"
          alt="GEMAILLA IA — La Evolución de la Asesoría Empresarial"
          className="mb-[clamp(1rem,2.4vh,1.6rem)] w-[min(88vw,480px)] max-h-[38svh] shrink-0 object-contain"
          style={{
            filter: 'drop-shadow(0 12px 28px rgba(212,175,55,0.18))',
          }}
        />

        <p className="mb-5 text-center font-serif text-lg leading-8 text-zinc-200 sm:text-xl">
          Inicia sesión con tu correo y contraseña para acceder al panel.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border p-7 backdrop-blur-md sm:p-9"
          style={{
            background:
              'linear-gradient(135deg, rgba(30,30,31,0.94), rgba(11,11,12,0.94))',
            borderColor: 'rgba(212,175,55,0.34)',
            boxShadow:
              'inset 0 1px 0 rgba(243,229,171,0.08), 0 28px 90px rgba(0,0,0,0.52)',
          }}
        >
          <label
            className="block font-serif text-base font-semibold uppercase tracking-[0.14em] text-[#F3E5AB]"
            htmlFor="auth-email"
          >
            Correo
          </label>

          <div className="relative mt-3">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D4AF37]" />

            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border bg-[#09090B] py-4 pl-12 pr-4 text-lg text-white outline-none transition placeholder:text-zinc-600 focus:border-[#F3E5AB]/70 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'rgba(212,175,55,0.24)' }}
            />
          </div>

          <label
            className="mt-7 block font-serif text-base font-semibold uppercase tracking-[0.14em] text-[#F3E5AB]"
            htmlFor="auth-password"
          >
            Contraseña
          </label>

          <div className="relative mt-3">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D4AF37]" />

            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border bg-[#09090B] py-4 pl-12 pr-12 text-lg text-white outline-none transition placeholder:text-zinc-600 focus:border-[#F3E5AB]/70 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'rgba(212,175,55,0.24)' }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-[#F3E5AB]"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {errorMessage && (
            <div
              className="mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-base text-red-200"
              style={{
                background: 'rgba(127,29,29,0.18)',
                borderColor: 'rgba(248,113,113,0.42)',
              }}
              role="alert"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 font-serif text-lg font-bold uppercase tracking-[0.14em] text-[#09090B] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                'linear-gradient(100deg, #B8862D 0%, #EEDC82 48%, #F3E5AB 100%)',
              boxShadow: '0 12px 28px rgba(212,175,55,0.20)',
            }}
          >
            {isSubmitting && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  );
}
