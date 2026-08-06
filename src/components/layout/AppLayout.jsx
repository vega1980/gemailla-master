import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import DesktopHeader from './DesktopHeader';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';

const pageVariants = {
  initial: { opacity: 0, x: 16 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -16 },
};
const pageTransition = { duration: 0.22, ease: 'easeInOut' };

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="app-shell flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        </div>
        {/* Mobile Header + Modules Bar */}
        <MobileHeader />
        <main
          className={`min-h-screen flex-1 pt-16 transition-all duration-300 md:pt-0 ${sidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[272px]'}`}
          style={{
            background: 'transparent',
            paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
          }}
        >
          <DesktopHeader />
          <div className="mx-auto max-w-[1700px] p-4 md:p-6 lg:p-8">
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
        {/* Mobile Bottom Navigation */}
        <BottomNav />
    </div>
  );
}
