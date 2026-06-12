import React, { useState, useEffect, useRef, useCallback } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Send, Bot, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const SUGGESTED_PROMPTS = [
  '¿Cómo está mi flujo de caja este mes?',
  '¿Qué gastos puedo reducir?',
  'Dame un diagnóstico rápido de mi empresa',
  '¿Cuándo tendré problemas de liquidez?',
];

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-foreground'
      }`}>
        {isUser ? (
          <p className="leading-relaxed">{message.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:leading-relaxed [&_ul]:ml-3 [&_li]:my-0.5 [&_strong]:text-primary"
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, i) => (
          tc.status === 'running' || tc.status === 'in_progress'
            ? <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Consultando datos...</div>
            : null
        ))}
      </div>
    </div>
  );
}

export default function ConsultorVirtual({ company, transactions, monthlyData }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const bottomRef = useRef(null);

  // Build context string from company data
  const buildContext = useCallback(() => {
    if (!company) return '';
    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const lastMonths = monthlyData.slice(-3).map(m => `${m.month}: Ingresos $${Math.round(m.ingresos).toLocaleString()}, Gastos $${Math.round(m.gastos).toLocaleString()}`).join('; ');
    return `\n\n[CONTEXTO DEL NEGOCIO - ${company.name}]\n- Ingresos totales: $${Math.round(totalIngresos).toLocaleString()}\n- Gastos totales: $${Math.round(totalGastos).toLocaleString()}\n- Utilidad neta: $${Math.round(totalIngresos - totalGastos).toLocaleString()}\n- Últimos meses: ${lastMonths || 'Sin datos'}\n- Industria: ${company.industry || 'No especificada'}\n`;
  }, [company, transactions, monthlyData]);

  const initConversation = useCallback(async () => {
    if (conversation || initializing) return;
    setInitializing(true);
    const ctx = buildContext();
    const conv = await firebase.agents.createConversation({
      agent_name: 'financial_advisor',
      metadata: { name: `Asesoría - ${company?.name || 'Mi Empresa'}` },
    });
    setConversation(conv);

    // Send initial context silently via first message
    if (ctx) {
      await firebase.agents.addMessage(conv, {
        role: 'user',
        content: `Hola, soy el dueño de ${company?.name || 'mi empresa'}. Por favor analiza mi situación financiera actual y dame un diagnóstico inicial.${ctx}`,
      });
    }
    setInitializing(false);
  }, [conversation, initializing, buildContext, company]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = firebase.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return unsub;
  }, [conversation]);

  const handleOpen = async () => {
    setOpen(true);
    if (!conversation) await initConversation();
  };

  const sendMessage = async (text) => {
    if (!text.trim() || sending || !conversation) return;
    setSending(true);
    setInput('');
    await firebase.agents.addMessage(conversation, { role: 'user', content: text });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed z-50 right-6 bottom-6 shadow-2xl rounded-2xl border border-border bg-card flex flex-col overflow-hidden transition-all duration-300 ${
              expanded ? 'w-[520px] h-[700px]' : 'w-[360px] h-[520px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">GEMAILLA Consultor</p>
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Activo 24/7
                </p>
              </div>
              <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(initializing && visibleMessages.length === 0) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando tu negocio...
                </div>
              )}

              {visibleMessages.length === 0 && !initializing && (
                <div className="text-center py-6">
                  <Bot className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">¡Hola! Soy tu consultor financiero IA.</p>
                  <p className="text-xs text-muted-foreground mt-1">Pregúntame lo que necesites sobre tu negocio.</p>
                </div>
              )}

              {visibleMessages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggested prompts */}
            {visibleMessages.length <= 2 && !initializing && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2 items-end">
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregunta al consultor..."
                  className="flex-1 resize-none bg-secondary rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-primary/50 transition-colors min-h-[40px] max-h-[100px]"
                  style={{ height: 'auto', overflowY: 'auto' }}
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || sending || !conversation}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-10 w-10 shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}