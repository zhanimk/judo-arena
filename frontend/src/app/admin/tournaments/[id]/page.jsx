'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { generateDocument } from '../../../../lib/generatePdf';

const FormSection = ({ title, children, className = '' }) => (
  <div className={`bg-navy-800 rounded-xl p-6 border border-navy-600 ${className}`}>
    <h3 className="font-semibold text-gold mb-4">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

// --- Component for managing a single Division on the EDIT page --- 
const DivisionEditCard = ({ division, onUpdate, onRemove }) => {
  const [newWeight, setNewWeight] = useState('');

  const handleAddWeight = () => {
    if (newWeight && !division.weights.includes(newWeight)) {
      onUpdate({ ...division, weights: [...division.weights, newWeight].sort() }); // Keep weights sorted
      setNewWeight('');
    }
  };

  const handleRemoveWeight = (weightToRemove) => {
    onUpdate({ ...division, weights: division.weights.filter(w => w !== weightToRemove) });
  };

  const handleInputChange = (e) => {
    onUpdate({ ...division, [e.target.name]: e.target.value });
  }

  return (
    <div className="bg-navy-700/50 p-4 rounded-lg border border-navy-600 space-y-3">
      <div className="flex justify-between items-start">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <button type="button" onClick={onRemove} className="ml-3 text-red-500 hover:text-red-400 font-bold text-2xl leading-none">&times;</button>
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


export default function TournamentEditPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [tournamentData, setTournamentData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  
  const [newAthlete, setNewAthlete] = useState({ name: '', yob: '', club: '', category: '' });

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');

  // --- Data Fetching ---
  useEffect(() => {
    if (!id) return;
    const fetchTournamentAndAthletes = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'tournaments', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError('Бұл ID-мен турнир табылмады.'); setLoading(false); return;
        }
        const data = { id: docSnap.id, ...docSnap.data() };
        // Add client-side ID to divisions for easy management
        data.divisions = (data.divisions || []).map((div, index) => ({ ...div, clientId: index }));
        setTournamentData(data);

        const athletesRef = collection(db, 'tournaments', id, 'athletes');
        const athletesSnapshot = await getDocs(athletesRef);
        setAthletes(athletesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Деректерді жүктеу қатесі:", err);
        setError('Деректерді жүктеу кезінде қате пайда болды.');
      } finally {
        setLoading(false);
      }
    };
    fetchTournamentAndAthletes();
  }, [id]);

  // --- Tournament & Division Management ---
  const handleTournamentInputChange = (e) => {
    setTournamentData({ ...tournamentData, [e.target.id]: e.target.value });
  };

  const addDivision = () => {
    const newDivision = { clientId: Date.now(), gender: 'Ерлер', ageGroup: '', duration: 3, weights: [] };
    setTournamentData({ ...tournamentData, divisions: [...tournamentData.divisions, newDivision] });
  };

  const updateDivision = (clientId, updatedData) => {
    setTournamentData({ ...tournamentData, divisions: tournamentData.divisions.map(d => d.clientId === clientId ? updatedData : d) });
  };

  const removeDivision = (clientId) => {
    setTournamentData({ ...tournamentData, divisions: tournamentData.divisions.filter(d => d.clientId !== clientId) });
  };

  const handleSaveChanges = async () => {
    setIsProcessing(true);
    try {
      const { id, ...dataToSave } = tournamentData;
      // Remove client-side IDs before saving to Firestore
      dataToSave.divisions = dataToSave.divisions.map(({ clientId, ...div }) => div);

      await updateDoc(doc(db, 'tournaments', id), dataToSave);
      alert('Турнир сәтті жаңартылды!');
    } catch (error) {
      console.error("Турнирді жаңарту қатесі:", error);
      alert("Турнирді жаңарту кезінде қате пайда болды.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Athlete Management ---
  const allCategories = useMemo(() => {
    if (!tournamentData?.divisions) return [];
    return tournamentData.divisions.flatMap(div => 
      div.weights.map(w => ({ 
        value: `${div.gender}|${div.ageGroup}|${w}`,
        label: `${div.gender} / ${div.ageGroup} / ${w}`
      }))
    );
  }, [tournamentData]);

  useEffect(() => {
      // Set default category for new athlete when categories load
      if(allCategories.length > 0 && !newAthlete.category) {
          setNewAthlete(prev => ({...prev, category: allCategories[0].value}))
      }
  }, [allCategories, newAthlete.category])

  const handleAthleteInputChange = (e) => {
    setNewAthlete({ ...newAthlete, [e.target.name]: e.target.value });
  };

  const handleAddAthlete = async (e) => {
    e.preventDefault();
    if (!newAthlete.name || !newAthlete.yob || !newAthlete.category) {
      alert("Барлық өрістерді толтырыңыз."); return;
    }
    const [gender, ageGroup, weight] = newAthlete.category.split('|');
    const athleteToSave = { 
        name: newAthlete.name, 
        yob: newAthlete.yob, 
        club: newAthlete.club, 
        gender, ageGroup, weight 
    };
    try {
      const docRef = await addDoc(collection(db, 'tournaments', id, 'athletes'), athleteToSave);
      setAthletes([...athletes, { id: docRef.id, ...athleteToSave }]);
      setNewAthlete({ name: '', yob: '', club: '', category: allCategories[0].value }); // Reset form
    } catch(error) {
      console.error("Спортшыны қосу қатесі:", error); alert("Спортшыны қосу кезінде қате пайда болды.");
    }
  };

  const handleRemoveAthlete = async (athleteId) => {
    // Using a proper confirmation modal is better, but for simplicity we use confirm()
    if (!confirm("Спортшыны жоюға сенімдісіз бе?")) return;
    try {
      await deleteDoc(doc(db, 'tournaments', id, 'athletes', athleteId));
      setAthletes(athletes.filter(athlete => athlete.id !== athleteId));
    } catch(error) {
      console.error("Спортшыны жою қатесі:", error); alert("Спортшыны жою кезінде қате пайда болды.");
    }
  };
  
  // --- PDF Generation ---
  const handleGeneratePdf = () => {
      if (!tournamentData) return;
      generateDocument(tournamentData);
  }

  if (loading) return <div className="p-6 text-center">Деректер жүктелуде...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!tournamentData) return null;

  return (
    <div className="p-6">
        <div className="flex justify-between items-start mb-6">
           <div>
                <h1 className="text-2xl font-bold text-gold">{tournamentData.name}</h1>
                <p className="text-gray-400">Турнирді басқару</p>
            </div>
            <div className="flex items-center gap-2">
                <button type="button" onClick={handleGeneratePdf} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500">PDF</button>
                <button onClick={handleSaveChanges} disabled={isProcessing} className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 disabled:opacity-50">
                  {isProcessing ? 'Сақталуда...' : 'Сақтау'}
                </button>
            </div>
        </div>

        <div className="mb-6 border-b border-navy-600">
            <nav className="flex gap-4">
                <button type="button" onClick={() => setActiveTab('settings')} className={`py-2 px-4 font-semibold border-b-2 ${activeTab === 'settings' ? 'border-gold text-gold' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    Баптаулар
                </button>
                <button type="button" onClick={() => setActiveTab('athletes')} className={`py-2 px-4 font-semibold border-b-2 ${activeTab === 'athletes' ? 'border-gold text-gold' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    Спортшылар ({athletes.length})
                </button>
                <button type="button" onClick={() => setActiveTab('draw')} className={`py-2 px-4 font-semibold border-b-2 ${activeTab === 'draw' ? 'border-gold text-gold' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    Турнир кестесі
                </button>
            </nav>
        </div>

        {/* --- SETTINGS TAB --- */}
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FormSection title="Негізгі ақпарат" className="lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                         <div className="md:col-span-2">
                           <label className="text-sm text-gray-400">Турнир атауы</label>
                           <input id="name" value={tournamentData.name} onChange={handleTournamentInputChange} className="w-full mt-1 bg-navy-700 p-2 rounded-lg"/>
                         </div>
                          <div>
                           <label className="text-sm text-gray-400">Күні</label>
                           <input id="date" type="date" value={tournamentData.date} onChange={handleTournamentInputChange} className="w-full mt-1 bg-navy-700 p-2 rounded-lg"/>
                         </div>
                    </div>
                </FormSection>

                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-semibold text-gold">Турнир дивизиондары</h3>
                    {(tournamentData.divisions || []).map(div => (
                        <DivisionEditCard key={div.clientId} division={div} onUpdate={(updated) => updateDivision(div.clientId, updated)} onRemove={() => removeDivision(div.clientId)} />
                    ))}
                    <button type="button" onClick={addDivision} className="w-full py-3 border-2 border-dashed border-navy-600 hover:bg-navy-700 rounded-lg transition-colors">
                        + Жаңа дивизион қосу
                    </button>
                </div>
            </div>
        </div>

        {/* --- ATHLETES TAB --- */}
        <div className={activeTab === 'athletes' ? 'block' : 'hidden'}>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <FormSection title="Жаңа спортшыны тіркеу">
                        <form onSubmit={handleAddAthlete} className="space-y-4">
                             <div>
                                <label className="text-sm text-gray-400">Категория</label>
                                <select name="category" value={newAthlete.category} onChange={handleAthleteInputChange} required className="w-full bg-navy-900 border border-navy-600 rounded-lg mt-1 px-3 py-2 focus:border-gold focus:outline-none">
                                    {allCategories.length > 0 ? allCategories.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    )) : <option disabled value="">Алдымен дивизион қосыңыз</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Аты-жөні</label>
                                <input name="name" value={newAthlete.name} onChange={handleAthleteInputChange} placeholder="Әлихан Смаилов" required className="w-full bg-navy-900 border border-navy-600 rounded-lg mt-1 px-3 py-2 focus:border-gold focus:outline-none"/>
                            </div>
                             <div>
                                <label className="text-sm text-gray-400">Туған жылы</label>
                                <input name="yob" type="number" value={newAthlete.yob} onChange={handleAthleteInputChange} placeholder="2010" required className="w-full bg-navy-900 border border-navy-600 rounded-lg mt-1 px-3 py-2 focus:border-gold focus:outline-none"/>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Клуб / Команда</label>
                                <input name="club" value={newAthlete.club} onChange={handleAthleteInputChange} placeholder="Астана дзюдо клубы" className="w-full bg-navy-900 border border-navy-600 rounded-lg mt-1 px-3 py-2 focus:border-gold focus:outline-none"/>
                            </div>
                            <button type="submit" className="w-full px-4 py-2 bg-gold text-navy-900 font-bold rounded-lg hover:opacity-90 transition-opacity">+ Спортшыны тіркеу</button>
                        </form>
                    </FormSection>
                </div>
                <div className="md:col-span-2">
                     <div className="bg-navy-800 rounded-xl p-6 border border-navy-600">
                        <h3 className="font-semibold text-gold mb-4">Тіркелген спортшылар ({athletes.length})</h3>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {athletes.length > 0 ? athletes.map(athlete => (
                                <div key={athlete.id} className="flex justify-between items-center bg-navy-700 p-3 rounded-lg">
                                    <div>
                                        <p className="font-bold">{athlete.name} <span className="text-sm font-normal text-gray-400">({athlete.yob})</span></p>
                                        <p className="text-sm text-gold">{`${athlete.gender} / ${athlete.ageGroup} / ${athlete.weight}`} <span className="text-gray-400">| {athlete.club || 'Клуб көрсетілмеген'}</span></p>
                                    </div>
                                    <button onClick={() => handleRemoveAthlete(athlete.id)} className="text-red-500 hover:text-red-400 font-bold text-xl">×</button>
                                </div>
                            )) : (
                                <p className="text-gray-400 text-center py-8">Бұл турнирге әлі ешкім тіркелмеген.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- DRAW TAB --- */}
        <div className={activeTab === 'draw' ? 'block' : 'hidden'}>
            <FormSection title="Турнир кестесін құру" className="text-center">
                <p className="text-gray-400">Бұл функция әзірленуде.</p>
            </FormSection>
        </div>
    </div>
  );
}
