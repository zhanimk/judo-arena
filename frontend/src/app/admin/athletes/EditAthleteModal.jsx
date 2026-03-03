'use client';

import { useState, useEffect } from 'react';

export default function EditAthleteModal({ isOpen, onClose, onSave, athlete }) {
  const [formData, setFormData] = useState({ name: '', yob: '', club: '' });

  useEffect(() => {
    if (athlete) {
      setFormData({
        name: athlete.name || '',
        yob: athlete.yob || '',
        club: athlete.club || '',
      });
    }
  }, [athlete]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave(athlete.id, formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-navy-800 rounded-xl p-6 border border-navy-600 w-full max-w-md">
        <h3 className="font-semibold text-gold mb-4">Спортшыны өзгерту</h3>
        <form onSubmit={handleSave}>
          <div className="space-y-4">
            <div>
                <label className="text-sm text-gray-400">Аты-жөні</label>
                <input name="name" value={formData.name} onChange={handleInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
            </div>
            <div>
                <label className="text-sm text-gray-400">Туған жылы</label>
                <input name="yob" type="number" value={formData.yob} onChange={handleInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
            </div>
            <div>
                <label className="text-sm text-gray-400">Клуб / Команда</label>
                <input name="club" value={formData.club} onChange={handleInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500">
              Болдырмау
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500">
              Сақтау
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
