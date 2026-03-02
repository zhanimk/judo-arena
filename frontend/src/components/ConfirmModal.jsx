'use client';

import { Fragment } from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="relative bg-navy-800 rounded-xl border border-navy-600 shadow-xl w-full max-w-md p-6" 
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <h2 className="text-xl font-bold text-gold mb-4">{title}</h2>
        <div className="text-gray-300 mb-6">
          {children}
        </div>
        <div className="flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-navy-600 text-white font-semibold rounded-lg hover:bg-navy-500 transition-colors"
          >
            Болдырмау
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors"
          >
            Иә, жою
          </button>
        </div>
      </div>
    </div>
  );
}
