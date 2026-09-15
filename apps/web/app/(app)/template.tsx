"use client";

import { motion } from "framer-motion";

// Re-mounts on every route change in the (app) group → gives each screen a
// gentle fade-rise entrance as the user moves between tabs.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
