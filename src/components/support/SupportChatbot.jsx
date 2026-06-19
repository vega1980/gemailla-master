import React, { useState, useRef, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey } from '@/lib/companyEntityQueries';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, Ticket } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ticketStatusConfig = {
  abierto:     { label: 'Abierto',     color: 'bg-blue-500/15 text-blue-400' },
  en_proceso:  { label: 'En proceso',  color: 'bg-amber-500/15 text-amber-400' },
  resuelto:    { label: 'Resuelto',    color: 'bg-emerald-500/15 text-emerald-400' },
  cerrado:     { label: 'Cerrado',     color: 'bg-secondary text-muted-foreground' },
};

const ticketPriorityColor = { baja: 'text-muted-foreground', media: 'text-blue-400', alta: 'text-amber-400', urgente: 'text-red-400' };

const SUGGESTED = [
  '¿Cómo interpreto mis estados financieros?',
  '¿Cuál es mi situación fiscal este mes?',
  '¿Cómo optimizo mi flujo de caja?',
  '¿Qué documentos debo presentar para una auditoría?',
  '¿Cómo reduzco costos operativos?',
];

export default function SupportChatbot({ company }) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `¡Hola! Soy el asistente virtual de **${company.name}**. Estoy disponible 24/7 para resolver tus dudas sobre finanzas, fiscal, operaciones y más. ¿En qué puedo ayudarte hoy?` }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const bottomRef = useRef(null);

  const { transactions, documents, supportTickets: tickets = [] } = useCompanyData(company?.id, {
    queryNames: ['transactions', 'documents', 'supportTickets'],
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiLoading]);

  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => firebase.entities.SupportTicket.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyEntityQueryKey('supportTickets', company) }),
  });

  const createTicket = async (subject, description) => {
    await firebase.entities.SupportTicket.create({
      companyId: company.id, subject, description, category: 'consulta', status: 'resuelto', priority: 'media',
      resolved_date: new Date().toISOString().slice(0, 10),
    });
    qc.invalidateQueries({ queryKey: companyEntityQueryKey('supportTickets', company) });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setAiLoading(true);

    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const analyzedDocs = documents.filter(d => d.status === 'analyzed').length;

    const history = newMessages.slice(-6).map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n');

    const response = await firebase.integrations.Core.InvokeLLM({
      companyId: company.id,
      prompt: `Eres el asistente virtual de GEMAILLA AI para la empresa "${company.name}". Eres un experto en contabilidad, finanzas, fiscal y operaciones para PyMEs mexicanas. Responde de forma clara, directa y útil. Si no sabes algo específico, guía al usuario a consultar con un especialista.

CONTEXTO FINANCIERO DE LA EMPRESA:
- Ingresos acumulados: $${totalIngresos.toLocaleString()}
- Gastos acumulados: $${totalGastos.toLocaleString()}
- Balance: $${(totalIngresos - totalGastos).toLocaleString()}
- Documentos analizados: ${analyzedDocs}
- Industria: ${company.industry || 'no especificada'}

CONVERSACIÓN RECIENTE:
${history}

PREGUNTA ACTUAL: ${msg}

Responde en español de forma concisa y útil. Usa bullet points cuando sea apropiado.`,
    });

    const assistantMsg = { role: 'assistant', content: response };
    setMessages(prev => [...prev, assistantMsg]);
    setAiLoading(false);

    // Auto-create ticket for the conversation
    if (msg.length > 20) {
      createTicket(msg.slice(0, 60) + (msg.length > 60 ? '...' : ''), response.slice(0, 200));
    }
  };

  const openTickets = tickets.filter(t => t.status === 'abierto' || t.status === 'en_proceso');

  return (
    <div className="space-y-4">
      {/* Open tickets banner */}
      {openTickets.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-400">
            <Ticket className="inline w-3.5 h-3.5 mr-1" />
            {openTickets.length} ticket{openTickets.length > 1 ? 's' : ''} abierto{openTickets.length > 1 ? 's' : ''}
          </p>
          <button onClick={() => setShowTickets(v => !v)} className="text-xs text-amber-400 hover:underline">
            {showTickets ? 'Ocultar' : 'Ver tickets'}
          </button>
        </div>
      )}

      {/* Tickets list */}
      {showTickets && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Tickets de Soporte</p>
          {tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Sin tickets registrados.</p>
          ) : tickets.slice(0, 10).map(ticket => {
            const cfg = ticketStatusConfig[ticket.status] || ticketStatusConfig.abierto;
            return (
              <div key={ticket.id} className="flex items-center justify-between gap-3 p-3 bg-secondary/40 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(ticket.createdAt), 'd MMM yy', { locale: es })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${ticketPriorityColor[ticket.priority]}`}>{ticket.priority}</span>
                  <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                  {ticket.status !== 'cerrado' && (
                    <button onClick={() => updateTicket.mutate({ id: ticket.id, data: { status: 'cerrado' } })} className="text-xs text-muted-foreground hover:text-foreground">Cerrar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chat window */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Asistente GEMAILLA</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Disponible 24/7</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border'}`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {aiLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-secondary border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Pensando...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGESTED.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-secondary/20 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Escribe tu pregunta..."
            className="bg-secondary border-border text-sm flex-1"
            disabled={aiLoading}
          />
          <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || aiLoading} className="bg-primary text-primary-foreground shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}