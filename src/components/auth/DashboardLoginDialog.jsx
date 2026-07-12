import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DashboardLoginDialog({
  open,
  destinationPath,
  onOpenChange,
}) {
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
      await login(email.trim(), password);
      window.location.assign(destinationPath || '/dashboard');
    } catch {
      setErrorMessage('Correo o contraseña incorrectos.');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="border-amber-300/25 bg-[#080808] text-amber-50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-amber-100">
            Iniciar sesión
          </DialogTitle>
          <DialogDescription className="text-amber-50/60">
            Accede a los módulos sin salir del Dashboard.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-lg border border-amber-300/25 bg-black/40 px-4 py-3"
            type="email"
            placeholder="Correo autorizado"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />

          <input
            className="w-full rounded-lg border border-amber-300/25 bg-black/40 px-4 py-3"
            type="password"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {errorMessage && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-100" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-amber-200 px-4 py-3 font-bold text-stone-950 disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
