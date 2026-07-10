import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firebase, isAiDisabledResponse } from '@/api/firebaseClient';
import { createCorrelationId } from '@/lib/observability';
import { useCompanyAiConversations } from '@/lib/companyEntityQueries';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/app/providers/AuthProvider';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Send, Loader2, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import PlanGate from '@/features/subscription/components/PlanGate';
import { useSubscription } from '@/lib/subscriptionContext';


import { askLLM } from '@modules/ai/services/aiService';
const HIGH_COST_APPROVAL_THRESHOLD_USD = 0.25;

function estimateRequestCostUsd(prompt, context) {
  return ((String(prompt || '').length + String(context || '').length) / 1000) * 0.01;
}

const MAX_CONTEXT_DOCUMENTS = 15;

const suggestedQueries = [
  '¿Cuál es el total de gastos en nómina este año?',
  '¿Qué facturas tengo pendientes de analizar?',
  'Resumen financiero de mi empresa',
  '¿Cuáles son mis principales proveedores?',
];

const getErrorMessage = (error, fallback) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const buildActionableErrorMessage = (error, fallback, correlationId, parentCorrelationId) => {
  const baseMessage = getErrorMessage(error, fallback);
  const traceSuffix = [
    correlationId ? `correlationId: ${correlationId}` : '',
    parentCorrelationId ? `parentCorrelationId: ${parentCorrelationId}` : '',
  ].filter(Boolean).join(' | ');

  return traceSuffix ? `${baseMessage} (${traceSuffix})` : baseMessage;
};

const normalizeAIResponse = (response) => {
  if (typeof response === 'string') return response;
  if (isAiDisabledResponse(response)) {
    return response?.message || response?.summary || response?.response || 'IA no configurada: configura un backend seguro para usar el asistente.';
  }
  return response?.response || response?.message || response?.summary || 'No se recibió una respuesta válida de la IA.';
};

let pendingConversationSequence = 0;

const createPendingConversationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = crypto.getRandomValues(new Uint32Array(4));
    return `pending-${Array.from(values, value => value.toString(16).padStart(8, '0')).join('')}`;
  }

  pendingConversationSequence += 1;
  return `pending-seq-${pendingConversationSequence}`;
};

export default function AIAssistant() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [filterDocType, setFilterDocType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const chatEndRef = useRef(null);
  const loadingRef = useRef(false);
  const isMountedRef = useRef(false);
  const hasHydratedSavedConversationsRef = useRef(false);

  const { documents, transactions } = useCompanyData(activeCompany);
  const { data: savedConvos = [] } = useCompanyAiConversations(activeCompany);

  const analyzedDocuments = useMemo(() => (
    documents.filter((document) => document.status === 'analyzed')
  ), [documents]);

  const contextDocuments = useMemo(() => (
    analyzedDocuments
      .filter((document) => filterDocType === 'all' || document.docType === filterDocType)
      .slice(0, MAX_CONTEXT_DOCUMENTS)
  ), [analyzedDocuments, filterDocType]);

  const financialSummary = useMemo(() => transactions.reduce((summary, transaction) => {
    const transactionAmount = Number(transaction.amount || 0);

    if (transaction.type === 'ingreso') {
      return { ...summary, totalIncome: summary.totalIncome + transactionAmount };
    }

    if (transaction.type === 'gasto') {
      return { ...summary, totalExpenses: summary.totalExpenses + transactionAmount };
    }

    return summary;
  }, { totalIncome: 0, totalExpenses: 0, transactionCount: transactions.length }), [transactions]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      loadingRef.current = false;
    };
  }, []);

  useEffect(() => {
    hasHydratedSavedConversationsRef.current = false;
    setConversations([]);
  }, [activeCompany?.id]);

  useEffect(() => {
    if (!activeCompany?.id || hasHydratedSavedConversationsRef.current) return;

    const companySavedConvos = savedConvos.filter(c => c.companyId === activeCompany.id);
    if (companySavedConvos.length === 0) return;

    hasHydratedSavedConversationsRef.current = true;
    if (!isMountedRef.current) return;

    setConversations(companySavedConvos.map(c => ({
      id: c.id,
      query: c.query,
      response: c.response,
      docs: c.context_documents,
    })));
  }, [activeCompany?.id, savedConvos]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  const handleSubmit = useCallback(async (suggestedQuery) => {
    const userQuery = suggestedQuery || query;
    if (!userQuery.trim() || loadingRef.current) return;

    loadingRef.current = true;
    setQuery('');
    setLoading(true);

    const selectedDocumentIds = contextDocuments.map((document) => document.id);
    const parentCorrelationId = createCorrelationId('ai_page');
    const correlationId = createCorrelationId('ai');
    const pendingId = createPendingConversationId();
    const pendingConvo = { id: pendingId, query: userQuery, response: null, docs: selectedDocumentIds };
    if (isMountedRef.current) {
      setConversations(prev => [...prev, pendingConvo]);
    }

    const updateConversation = (response) => {
      if (!isMountedRef.current) return;

      setConversations(prev => prev.map(convo => (
        convo.id === pendingId
          ? { ...convo, response }
          : convo
      )));
    };

    const saveConversation = async ({ response, status = 'completed', errorMessage = null, estimatedCostUsd = 0, usageLog = null }) => {
      await firebase.entities.AIConversation.create({
        companyId: activeCompany.id,
        userEmail: user?.email || '',
        query: userQuery,
        response,
        context_documents: selectedDocumentIds,
        filters_used: { docType: filterDocType },
        status,
        estimatedCostUsd,
        ...(usageLog ? { tokens: usageLog.tokens, model: usageLog.model, costo: usageLog.costo, costUsd: usageLog.costUsd, costLogTimestamp: usageLog.costLogTimestamp } : {}),
        requiresSupervisorApproval: status === 'pendingApproval',
        errorMessage,
        documentIds: selectedDocumentIds,
        correlationId,
        parentCorrelationId,
      });
    };

    try {
      const documentContext = contextDocuments.map((document) => (
        `[${document.docType || 'doc'}] ${document.title} | Total: $${document.total || 0} | Fecha: ${document.docDate || 'N/A'} | RFC: ${document.rfc_emisor || 'N/A'} | Resumen: ${document.ai_summary || 'Sin resumen'}`
      )).join('\n');

      const requestPrompt = `Eres GEMAILLA AI, un asistente financiero experto para empresas mexicanas. Responde con datos reales basados en el contexto.

Empresa: ${activeCompany.name}
RFC: ${activeCompany.rfc || 'N/A'}

DOCUMENTOS ANALIZADOS:
${documentContext || 'Sin documentos analizados aún.'}

RESUMEN FINANCIERO:
- Ingresos totales: $${financialSummary.totalIncome.toLocaleString()}
- Gastos totales: $${financialSummary.totalExpenses.toLocaleString()}
- Balance: $${(financialSummary.totalIncome - financialSummary.totalExpenses).toLocaleString()}
- Transacciones: ${financialSummary.transactionCount}

PREGUNTA DEL USUARIO:
${userQuery}

Responde de forma profesional, concisa y con datos específicos. Usa formato markdown para mejor legibilidad.`;
      const estimatedCostUsd = estimateRequestCostUsd(requestPrompt, documentContext);

      if (estimatedCostUsd > HIGH_COST_APPROVAL_THRESHOLD_USD) {
        const approvalMessage = 'Solicitud pendiente de aprobación: el costo estimado supera $0.25 USD y requiere autorización de un supervisor.';
        updateConversation(approvalMessage);
        await saveConversation({ response: approvalMessage, status: 'pendingApproval', estimatedCostUsd });
        return;
      }

      const aiResponse = await askLLM({
        companyId: activeCompany.id,
        prompt: requestPrompt,
        documentIds: selectedDocumentIds,
        correlationId,
        parentCorrelationId,
      });
      const response = normalizeAIResponse(aiResponse);
      updateConversation(response);

      await saveConversation({
        response,
        estimatedCostUsd,
        usageLog: {
          tokens: aiResponse?.tokens,
          model: aiResponse?.model,
          costo: aiResponse?.costo,
          costUsd: aiResponse?.costUsd,
          costLogTimestamp: aiResponse?.costLogTimestamp,
        },
      });

      await logAction({
        companyId: activeCompany.id,
        userEmail: user?.email,
        userName: user?.fullName,
        action: 'ai_query',
        entityType: 'AIConversation',
        details: `Consulta IA completada (longitud: ${userQuery.length}, documentos: ${selectedDocumentIds.length})`,
        correlationId: aiResponse?.correlationId || correlationId,
        parentCorrelationId,
      });
    } catch (error) {
      const errorMessage = buildActionableErrorMessage(error, 'Verifica la configuración del backend seguro y vuelve a intentar.', correlationId, parentCorrelationId);
      const response = `No se pudo completar la consulta de IA. ${errorMessage}`;
      updateConversation(response);

      try {
        await saveConversation({ response, status: 'error', errorMessage });
        await logAction({
          companyId: activeCompany.id,
          userEmail: user?.email,
          userName: user?.fullName,
          action: 'ai_query_error',
          entityType: 'AIConversation',
          details: `Consulta IA fallida (longitud: ${userQuery.length}, documentos: ${selectedDocumentIds.length}) — ${errorMessage}`,
          correlationId,
          parentCorrelationId,
        });
      } catch (persistenceError) {
        console.error('Error persisting failed AI conversation:', persistenceError);
      }
    } finally {
      loadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [activeCompany, contextDocuments, filterDocType, financialSummary, query, user]);

  const { canAccessAI, loading: subLoading } = useSubscription();

  if (!activeCompany) return <EmptyState icon={Brain} title="Selecciona una empresa" description="Necesitas una empresa activa." />;

  if (!subLoading && !canAccessAI) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="IA Asistente" description="Consulta inteligente sobre tus documentos y finanzas." />
        <PlanGate requiredPlan="enterprise" featureName="Asistente de IA Personalizado">
          <div />
        </PlanGate>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader title="IA Asistente" description="Consulta inteligente sobre tus documentos y finanzas." />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={filterDocType} onValueChange={setFilterDocType}>
          <SelectTrigger className="w-44 bg-card border-border">
            <FileText className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtro documentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los documentos</SelectItem>
            <SelectItem value="factura">Facturas</SelectItem>
            <SelectItem value="recibo">Recibos</SelectItem>
            <SelectItem value="contrato">Contratos</SelectItem>
            <SelectItem value="nómina">Nóminas</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" />
          {analyzedDocuments.length} documentos indexados
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 mb-4 space-y-4">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Brain className="w-12 h-12 text-primary/30 mb-4" />
            <p className="text-muted-foreground text-sm mb-6">Pregunta lo que necesites sobre tu empresa</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {suggestedQueries.map((suggestedQuery) => (
                <button key={suggestedQuery} onClick={() => handleSubmit(suggestedQuery)}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors text-sm text-muted-foreground hover:text-foreground">
                  {suggestedQuery}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {conversations.map((c, i) => (
            <motion.div key={c.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* User message */}
              <div className="flex justify-end mb-3">
                <div className="max-w-[80%] p-3 rounded-xl bg-primary text-primary-foreground text-sm">
                  {c.query}
                </div>
              </div>
              {/* AI response */}
              {c.response ? (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[80%] p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">GEMAILLA AI</span>
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground">
                      <ReactMarkdown>{c.response}</ReactMarkdown>
                    </div>
                    {c.docs?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
                        Basado en {c.docs.length} documentos
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-start mb-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-3">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Escribe tu consulta..."
          className="flex-1 bg-card border-border"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !query.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
