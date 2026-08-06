import React from 'react';

export default function PageHeader({ title, description, actions }) {
  return (
    <div className={`enterprise-panel relative mb-7 flex flex-col justify-between gap-4 overflow-hidden rounded-2xl px-6 py-5 sm:flex-row sm:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none ${actions ? 'md:justify-end' : 'md:hidden'}`}>
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-cyan-600 to-amber-400 md:hidden" aria-hidden="true" />
      <div className="md:hidden">
        <h2 className="font-display text-2xl font-bold text-[#12344f]">{title}</h2>
        {description && <p className="mt-1 text-sm tracking-wide text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
