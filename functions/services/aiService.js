export const createDisabledAiResponse = (message = 'Servicio de IA no configurado.') => ({
  disabled: true,
  status: 'disabled',
  message,
});
