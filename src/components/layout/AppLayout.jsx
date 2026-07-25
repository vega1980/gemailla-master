import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 },
};
const pageTransition = { duration: 0.2, ease: 'easeOut' };

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="gemailla-shell flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      </div>

      <MobileHeader />

      <main
        className={`relative min-h-screen flex-1 transition-all duration-300 pt-14 md:pt-0 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-72'}`}
        style={{
          background: 'transparent',
          paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className="hidden h-px w-full md:block"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(39,224,222,0.62), rgba(224,176,67,0.78), rgba(39,224,222,0.62), transparent)',
            boxShadow: '0 0 18px rgba(39,224,222,0.28)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-[1680px] p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
