import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';

const pageVariants = {
  initial: { opacity: 0, x: 16 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -16 },
};

const pageTransition = {
  duration: 0.22,
  ease: 'easeInOut',
};

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-[#09090B]">
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      <MobileHeader />

      <main
        className={`min-h-screen flex-1 bg-[#09090B] pb-[calc(56px+env(safe-area-inset-bottom))] pt-14 transition-all duration-300 md:pt-0 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        <div
          className="hidden h-px w-full md:block"
          style={{ background: 'rgba(243,229,171,0.10)' }}
        />

        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
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
