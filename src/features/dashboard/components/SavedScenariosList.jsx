import React from 'react';
import { Eye, EyeOff, Trash2, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function SavedScenariosList({ scenarios, visibleIds, onToggleVisible, onDelete }) {
  if (scenarios.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <BookmarkCheck className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Escenarios Guardados
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{scenarios.length} guardado{scenarios.length !== 1 ? 's' : ''}</span>
      </div>
      <AnimatePresence>
        {scenarios.map(sc => {
          const isVisible = visibleIds.includes(sc.id);
          const totalBalance = sc.data.reduce((s, d) => s + d.balance_sc, 0);
          return (
            <motion.div
              key={sc.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                isVisible ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
              }`}
            >
              {/* Color swatch */}
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20"
                style={{ background: sc.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{sc.name}</p>
                <p className={`text-[11px] font-medium ${totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Balance 3m: {totalBalance >= 0 ? '+' : ''}${totalBalance.toLocaleString('es-MX')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  className="w-7 h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleVisible(sc.id)}
                  title={isVisible ? 'Ocultar en gráfico' : 'Mostrar en gráfico'}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="w-7 h-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(sc.id)}
                  title="Eliminar escenario"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}