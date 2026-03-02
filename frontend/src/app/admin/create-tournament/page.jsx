'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Reusable component for form sections
const FormSection = ({ title, children, className = '' }) => (
  <div className={`bg-navy-800 rounded-xl p-6 border border-navy-600 ${className}`}>
    <h3 className="font-semibold text-gold mb-4">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

// --- New Component for managing a single Division --- 
const DivisionCard = ({ division, onUpdate, onRemove }) => {
  const [newWeight, setNewWeight] = useState('');

  const handleAddWeight = () => {
    if (newWeight && !division.weights.includes(newWeight)) {
      onUpdate(division.id, { ...division, weights: [...division.weights, newWeight] });
      setNewWeight('');
    }
  };

  const handleRemoveWeight = (weightToRemove) => {
    onUpdate(division.id, { ...division, weights: division.weights.filter(w => w !== weightToRemove) });
  };

  const handleInputChange = (e) => {
    onUpdate(division.id, { ...division, [e.target.name]: e.target.value });
  }

  return (
    <div className="bg-navy-700/50 p-4 rounded-lg border border-navy-600 space-y-3">
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-lg text-gold">Жаңа дивизион</h4>
        <button type="button" onClick={() => onRemove(division.id)} className="text-red-500 hover:text-red-400 font-bold text-2xl leading-none">&times;</button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
            <label className="text-xs text-gray-400">Жынысы</label>
            <select name="gender" value={division.gender} onChange={handleInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none">
                <option value="Ерлер">Ерлер</option>
                <option value="Әйелдер">Әйелдер</option>
            </select>
        </div>
        <div>
            <label className="text-xs text-gray-400">Жас тобы</label>
            <input name="ageGroup" value={division.ageGroup} onChange={handleInputChange} placeholder="U14 (2010-2011)" className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none" />
        </div>
        <div>
            <label className="text-xs text-gray-400">Белдесу (мин)</label>
            <input name="duration" type="number" value={division.duration} onChange={handleInputChange} placeholder="3" className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400">Салмақ дәрежелері</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {division.weights.map(w => (
            <span key={w} className="bg-navy-900 px-2 py-1 rounded-md text-sm flex items-center gap-2">
              {w}
              <button type="button" onClick={() => handleRemoveWeight(w)} className="text-gray-500 hover:text-white">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
            <input value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="-55 кг" className="flex-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none" />
            <button type="button" onClick={handleAddWeight} className="px-4 bg-gold text-navy-900 font-bold rounded-md">+</button>
        </div>
      </div>
    </div>
  );
};


export default function CreateTournamentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [tournamentData, setTournamentData] = useState({
    name: '',
    date: '',
    location: '',
    tatamiCount: 1,
    // "Положение" fields
    goals: '',
    participants: '',
    program: '',
    awarding: '',
    financing: '',
  });
  const [divisions, setDivisions] = useState([]);

  const handleInputChange = (e) => {
    setTournamentData({ ...tournamentData, [e.target.id]: e.target.value });
  };

  // --- Division Management ---
  const addDivision = () => {
    const newDivision = {
        id: Date.now(), // Unique client-side ID
        gender: 'Ерлер',
        ageGroup: '',
        duration: 3,
        weights: []
    };
    setDivisions([...divisions, newDivision]);
  };

  const updateDivision = (id, updatedData) => {
    setDivisions(divisions.map(d => d.id === id ? updatedData : d));
  };

  const removeDivision = (id) => {
    setDivisions(divisions.filter(d => d.id !== id));
  };

  // --- Form Submission ---
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!tournamentData.name || !tournamentData.date || divisions.length === 0) {
      alert("Турнир атауын, күнін толтырып, кем дегенде бір дивизион қосыңыз.");
      return;
    }
    setIsLoading(true);

    try {
        // Clean up client-side IDs from divisions before saving
        const divisionsToSave = divisions.map(({ id, ...rest }) => rest);

        await addDoc(collection(db, "tournaments"), {
            ...tournamentData,
            divisions: divisionsToSave,
            createdAt: new Date(),
        });
      
        alert('Турнир сәтті құрылды!');
        router.push(`/admin/tournaments`);

    } catch (error) {
      console.error("Турнир құру қатесі:", error);
      alert("Турнирді сақтау кезінде қате пайда болды.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreateTournament} className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <span className="text-gold">🏆</span> Жаңа турнир құру
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <FormSection title="Негізгі ақпарат" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1" htmlFor="name">Турнир атауы</label>
              <input type="text" id="name" placeholder="Дзюдодан қала кубогы 2024" value={tournamentData.name} onChange={handleInputChange} required className="w-full bg-navy-700 p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="date">Күні</label>
              <input type="date" id="date" value={tournamentData.date} onChange={handleInputChange} required className="w-full bg-navy-700 p-2 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="tatamiCount">Татами саны</label>
              <select id="tatamiCount" value={tournamentData.tatamiCount} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg">
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} татами</option>)}
              </select>
            </div>
             <div className="md:col-span-4">
              <label className="block text-sm text-gray-400 mb-1" htmlFor="location">Өтетін орны</label>
              <input type="text" id="location" placeholder="Спорт кешені, Абай даңғылы 50" value={tournamentData.location} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" />
            </div>
          </div>
        </FormSection>

        <div className="lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gold">Турнир дивизиондары</h3>
            {divisions.map(div => (
                <DivisionCard key={div.id} division={div} onUpdate={updateDivision} onRemove={removeDivision} />
            ))}
            <button type="button" onClick={addDivision} className="w-full py-3 border-2 border-dashed border-navy-600 hover:bg-navy-700 rounded-lg transition-colors">
                + Жаңа дивизион қосу
            </button>
        </div>

        <FormSection title="Положение: Мақсаттар мен міндеттер">
          <textarea id="goals" rows="5" value={tournamentData.goals} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" placeholder="Жарыстың негізгі мақсаттары..."></textarea>
        </FormSection>

        <FormSection title="Положение: Қатысушылар мен талаптар">
           <textarea id="participants" rows="5" value={tournamentData.participants} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" placeholder="Жарысқа жіберу талаптары..."></textarea>
        </FormSection>

        <FormSection title="Положение: Бағдарлама және марапаттау">
            <textarea id="program" rows="5" value={tournamentData.program} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" placeholder="Күні, уақыты, өлшену, белдесулердің басталуы..."></textarea>
            <textarea id="awarding" rows="5" value={tournamentData.awarding} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" placeholder="Жеңімпаздар мен жүлдегерлерді марапаттау тәртібі..."></textarea>
        </FormSection>

        <FormSection title="Положение: Қаржыландыру">
            <textarea id="financing" rows="5" value={tournamentData.financing} onChange={handleInputChange} className="w-full bg-navy-700 p-2 rounded-lg" placeholder="Шығындар, стартовый взнос..."></textarea>
        </FormSection>

      </div>

      <div className="mt-8 text-right">
        <button type="submit" disabled={isLoading} className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg">
          {isLoading ? 'Сақталуда...' : '🚀 Турнирді құру'}
        </button>
      </div>
    </form>
  );
}
