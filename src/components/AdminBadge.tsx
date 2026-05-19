import { ShieldCheck } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center" ref={badgeRef}>
      <button 
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
        className="text-amber-500 hover:text-amber-600 transition-colors ml-1 focus:outline-none"
      >
        <ShieldCheck className="w-[18px] h-[18px]" fill="currentColor" stroke="white" strokeWidth={1.5} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <p className="text-white text-[13px] font-semibold leading-snug text-center">Официальный Администратор сети</p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 rotate-45 border-r border-b border-zinc-800"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
