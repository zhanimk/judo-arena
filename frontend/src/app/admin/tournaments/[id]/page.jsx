'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { generateDocument } from '../../../../lib/generatePdf';

import MainTab from './components/MainTab';
import RegulationsTab from './components/RegulationsTab';
import AthletesTab from './components/AthletesTab';
import GridsTab from './components/GridsTab';

import ConfirmModal from '../../../../components/ConfirmModal';
import EditAthleteModal from '../../athletes/EditAthleteModal';

// These two components are defined here because they are used by MainTab but their state is managed here.
export const FormSection = ({ title, children, className = '' }) => (
  <div className={`bg-navy-800 rounded-xl p-6 border border-navy-600 ${className}`}>
    {title && <h3 className="font-semibold text-gold mb-4">{title}</h3>}
    <div className="space-y-4">{children}</div>
  </div>
);

export const DivisionEditCard = ({ division, onUpdate, onRemove }) => {
  const [newWeights, setNewWeights] = useState('');
  const handleAddWeights = () => {
    const weightsToAdd = newWeights.split(/\s+|,/g).map(w => w.trim()).filter(w => w.length > 0 && !division.weights.includes(w));
    if (weightsToAdd.length > 0) {
      const sortedWeights = [...division.weights, ...weightsToAdd].sort((a, b) => {
          const numA = parseFloat(a.replace(/\+|-/g, ''));
          const numB = parseFloat(b.replace(/\+|-/g, ''));
          return numA - numB;
      });
      onUpdate({ ...division, weights: sortedWeights });
      setNewWeights('');
    }
  };
  const handleRemoveWeight = (weightToRemove) => {
    onUpdate({ ...division, weights: division.weights.filter(w => w !== weightToRemove) });
  };
  const handleInputChange = (e) => {
    onUpdate({ ...division, [e.target.name]: e.target.value });
  };
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
                    <input name="ageGroup" value={division.ageGroup} onChange={handleInputChange} placeholder="Мысалы: 2010-2011 ж.т." className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none" />
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
                <input value={newWeights} onChange={(e) => setNewWeights(e.target.value)} placeholder="-55 -60 +66 (бос орын арқылы)" className="flex-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                <button type="button" onClick={handleAddWeights} className="px-4 bg-gold text-navy-900 font-bold rounded-md">+ Қосу</button>
            </div>
        </div>
    </div>
  );
};

const TabButton = ({ active, onClick, children }) => (
    <button 
        onClick={onClick} 
        className={`px-4 py-2 font-semibold transition-colors duration-200 ${active ? 'bg-gold text-navy-900' : 'text-gray-300 hover:bg-navy-700'} rounded-md`}>
        {children}
    </button>
);

const groupAthletesByDivision = (athletes, divisions) => {
    const grouped = {};
    divisions.forEach(div => {
        const divKey = `${div.gender} / ${div.ageGroup}`;
        if (!grouped[divKey]) grouped[divKey] = {};
        div.weights.forEach(weight => {
            if (!grouped[divKey][weight]) grouped[divKey][weight] = [];
        });
    });
    athletes.forEach(athlete => {
        const divKey = `${athlete.gender} / ${athlete.ageGroup}`;
        if (grouped[divKey] && grouped[divKey][athlete.weight] !== undefined) {
             grouped[divKey][athlete.weight].push(athlete);
        }
    });
    for (const divKey in grouped) {
        for (const weight in grouped[divKey]) {
            grouped[divKey][weight].sort((a, b) => a.name.localeCompare(b.name));
        }
    }
    return grouped;
};


export default function TournamentEditPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('main');
  const [tournamentData, setTournamentData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [groupedAthletes, setGroupedAthletes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [athleteToDelete, setAthleteToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [athleteToEdit, setAthleteToEdit] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    const fetchTournamentAndAthletes = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'tournaments', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
             if(isMounted) setError('Бұл ID-мен турнир табылмады.'); 
             return;
        }
        
        const data = { id: docSnap.id, ...docSnap.data() };
        data.divisions = (data.divisions || []).map((div, index) => ({ ...div, clientId: `div-${index}` }));
        if(isMounted) setTournamentData(data);

        const athletesRef = collection(db, 'tournaments', id, 'athletes');
        const athletesSnapshot = await getDocs(athletesRef);
        const athletesList = athletesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(isMounted) setAthletes(athletesList);

      } catch (err) {
        console.error("Деректерді жүктеу қатесі:", err);
        if(isMounted) setError('Деректерді жүктеу кезінде қате пайда болды.');
      } finally {
        if(isMounted) {
            setLoading(false);
            setHasUnsavedChanges(false);
        }
      }
    };
    fetchTournamentAndAthletes();
    return () => { isMounted = false };
  }, [id]);

  useEffect(() => {
    if (tournamentData && tournamentData.divisions) {
        setGroupedAthletes(groupAthletesByDivision(athletes, tournamentData.divisions));
    } else {
        setGroupedAthletes({});
    }
}, [athletes, tournamentData]);

  const showFeedback = (type, text) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
  };

  const handleTournamentInputChange = (e) => {
    setTournamentData({ ...tournamentData, [e.target.id]: e.target.value });
    setHasUnsavedChanges(true);
  };
  const addDivision = () => {
    const newDivision = { clientId: `div-${Date.now()}`, gender: 'Ерлер', ageGroup: '', duration: 3, weights: [] };
    setTournamentData({ ...tournamentData, divisions: [...tournamentData.divisions, newDivision] });
    setHasUnsavedChanges(true);
  };
  const updateDivision = (clientId, updatedData) => {
    setTournamentData({ ...tournamentData, divisions: tournamentData.divisions.map(d => d.clientId === clientId ? updatedData : d) });
    setHasUnsavedChanges(true);
  };
  const removeDivision = (clientId) => {
    setTournamentData({ ...tournamentData, divisions: tournamentData.divisions.filter(d => d.clientId !== clientId) });
    setHasUnsavedChanges(true);
  };
  const handleSaveChanges = async () => {
    setIsProcessing(true);
    try {
      const { id, ...dataToSave } = tournamentData;
      // Clean data before saving
      dataToSave.divisions = dataToSave.divisions.map(({ clientId, ...div }) => div);
      if (dataToSave.grids) {
        // Ensure grids are serializable
        dataToSave.grids = JSON.parse(JSON.stringify(dataToSave.grids));
      }

      await updateDoc(doc(db, 'tournaments', id), dataToSave);
      showFeedback('success', 'Өзгерістер сақталды!');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Турнирді жаңарту қатесі:", error);
      showFeedback('error', "Сақтау кезінде қате пайда болды.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAthleteAdded = (newAthlete) => {
      setAthletes(prev => [...prev, newAthlete]);
  };

  const handleUpdateAthlete = async (athleteId, updatedData) => {
    try {
      const athleteRef = doc(db, 'tournaments', id, 'athletes', athleteId);
      await updateDoc(athleteRef, updatedData);
      setAthletes(athletes.map(a => a.id === athleteId ? { ...a, ...updatedData } : a));
      showFeedback('success', 'Спортшы сәтті жаңартылды!');
    } catch (error) {
      console.error("Спортшыны жаңарту қатесі:", error);
      showFeedback('error', 'Спортшыны жаңарту кезінде қате пайда болды.');
    } finally {
      closeEditModal();
    }
  };

  const handleConfirmDeleteAthlete = async () => {
    if (!athleteToDelete) return;
    try {
      await deleteDoc(doc(db, 'tournaments', id, 'athletes', athleteToDelete.id));
      setAthletes(athletes.filter(athlete => athlete.id !== athleteToDelete.id));
      showFeedback('success', 'Спортшы сәтті жойылды.');
    } catch (error) {
      console.error("Спортшыны жою қатесі:", error);
      showFeedback('error', "Спортшыны жою кезінде қате пайда болды.");
    } finally {
      closeDeleteModal();
    }
  };

    const handleGenerateGrids = () => {
        if (!groupedAthletes) {
            showFeedback('error', 'Спортшылар жүктелмеді.');
            return;
        }

        const newGrids = {};
        for (const divisionKey in groupedAthletes) {
            newGrids[divisionKey] = {};
            for (const weightKey in groupedAthletes[divisionKey]) {
                let athletesInCategory = [...groupedAthletes[divisionKey][weightKey]]; // Make a copy
                const matches = [];
                
                // Handle bye if odd number of athletes
                if (athletesInCategory.length % 2 !== 0) {
                    // For simplicity, the last athlete gets a bye. Could be randomized.
                    const byeAthlete = athletesInCategory.pop();
                    matches.push({
                        round: 1,
                        white: byeAthlete,
                        red: { id: 'BYE', name: '— BYE —' },
                        winner: byeAthlete, // Automatically wins
                    });
                }

                // Create pairs for the first round
                for (let i = 0; i < athletesInCategory.length; i += 2) {
                    matches.push({
                        round: 1,
                        white: athletesInCategory[i],
                        red: athletesInCategory[i+1],
                        winner: null,
                    });
                }
                newGrids[divisionKey][weightKey] = { status: 'pending', champion: null, matches };
            }
        }

        setTournamentData(prev => ({ ...prev, grids: newGrids }));
        setHasUnsavedChanges(true);
        showFeedback('success', 'Сеткалар генерацияланды! Сақтауды ұмытпаңыз.');
    };

    const handleSetWinner = (divisionKey, weightKey, matchIndex, winnerSide) => {
        setTournamentData(prev => {
            const newTournamentData = JSON.parse(JSON.stringify(prev));
            const match = newTournamentData.grids[divisionKey][weightKey].matches[matchIndex];
            const winnerAthlete = match[winnerSide];

            if (match.winner && match.winner.id === winnerAthlete.id) {
                match.winner = null; // Unset winner
            } else {
                match.winner = winnerAthlete; // Set winner
            }

            setHasUnsavedChanges(true);
            return newTournamentData;
        });
    };

    const handleAdvanceWinners = () => {
        setTournamentData(prev => {
            const newTournamentData = JSON.parse(JSON.stringify(prev));
            let anyGridAdvanced = false;

            for (const divisionKey in newTournamentData.grids) {
                for (const weightKey in newTournamentData.grids[divisionKey]) {
                    const grid = newTournamentData.grids[divisionKey][weightKey];
                    if (grid.status === 'finished' || !grid.matches || grid.matches.length === 0) continue;

                    const maxRound = Math.max(...grid.matches.map(m => m.round));
                    const lastRoundMatches = grid.matches.filter(m => m.round === maxRound);
                    
                    if (lastRoundMatches.length > 0 && lastRoundMatches.every(m => m.winner)) {
                        const winners = lastRoundMatches.map(m => m.winner);
                        if (winners.length === 1) {
                            grid.status = 'finished';
                            grid.champion = winners[0];
                            anyGridAdvanced = true;
                        } else if (winners.length > 1) {
                            const nextRoundMatches = [];
                            let currentWinners = [...winners];

                            if (currentWinners.length % 2 !== 0) {
                                const byeWinner = currentWinners.pop();
                                nextRoundMatches.push({
                                    round: maxRound + 1,
                                    white: byeWinner,
                                    red: { id: 'BYE', name: '— BYE —' },
                                    winner: byeWinner,
                                });
                            }

                            for (let i = 0; i < currentWinners.length; i += 2) {
                                nextRoundMatches.push({
                                    round: maxRound + 1,
                                    white: currentWinners[i],
                                    red: currentWinners[i+1],
                                    winner: null,
                                });
                            }
                            grid.matches.push(...nextRoundMatches);
                            anyGridAdvanced = true;
                        }
                    }
                }
            }

            if (anyGridAdvanced) {
                showFeedback('success', 'Келесі раунд генерацияланды! Сақтауды ұмытпаңыз.');
                setHasUnsavedChanges(true);
            } else {
                showFeedback('info', 'Келесі раундты генерациялау үшін алдымен барлық ағымдағы матчтардың жеңімпаздарын көрсетіңіз.');
            }
            return newTournamentData;
        });
    };

  const openDeleteModal = (athlete) => { setAthleteToDelete(athlete); setIsDeleteModalOpen(true); };
  const closeDeleteModal = () => { setAthleteToDelete(null); setIsDeleteModalOpen(false); };
  const openEditModal = (athlete) => { setAthleteToEdit(athlete); setIsEditModalOpen(true); };
  const closeEditModal = () => { setAthleteToEdit(null); setIsEditModalOpen(false); };
  
  const handleGeneratePdf = () => {
    if (hasUnsavedChanges) {
        alert('PDF құру алдында өзгерістерді сақтаңыз.');
        return;
    }
    generateDocument(tournamentData, athletes);
  };

  if (loading) return <div className="p-6 text-center">Деректер жүктелуде...</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!tournamentData) return null;

  const SaveButton = () => {
      const baseClasses = "px-5 py-2 text-white font-semibold rounded-lg disabled:opacity-50 transition-all flex items-center gap-2";
      if (hasUnsavedChanges) {
          return (
              <button onClick={handleSaveChanges} disabled={isProcessing} className={`${baseClasses} bg-yellow-500 hover:bg-yellow-400 animate-pulse`}>
                <span className="text-lg">💾</span> {isProcessing ? 'Сақталуда...' : 'Сақтау керек'}
              </button>
          );
      }
      return (
          <button disabled className={`${baseClasses} bg-green-600`}>
            <span className="text-lg">✅</span> Сақталды
          </button>
      );
  }

  return (
    <>
      <div className="p-6">
          <div className="flex justify-between items-start mb-6">
              <div>
                  <h1 className="text-2xl font-bold text-gold">{tournamentData.name}</h1>
                  <p className="text-gray-400">Турнирді басқару</p>
              </div>
              <div className="flex items-center gap-4">
                  {feedbackMessage.text && (
                      <div className={`px-4 py-2 rounded-lg text-white ${feedbackMessage.type === 'success' ? 'bg-green-600' : 'bg-red-500'} transition-opacity`}>
                          {feedbackMessage.text}
                      </div>
                  )}
                  <button type="button" onClick={handleGeneratePdf} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 flex items-center gap-2"><span className="text-lg">📄</span> PDF</button>
                  <SaveButton />
              </div>
          </div>

        <div className="mb-6 border-b border-navy-600">
            <div className="flex items-center gap-2">
                <TabButton active={activeTab === 'main'} onClick={() => setActiveTab('main')}>Негізгі</TabButton>
                <TabButton active={activeTab === 'regulations'} onClick={() => setActiveTab('regulations')}>Положение</TabButton>
                <TabButton active={activeTab === 'athletes'} onClick={() => setActiveTab('athletes')}>Спортшылар</TabButton>
                <TabButton active={activeTab === 'grids'} onClick={() => setActiveTab('grids')}>Сеткалар</TabButton>
                <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')}>Табло</TabButton>
            </div>
        </div>

        <div className="space-y-8">
            {activeTab === 'main' && 
                <MainTab 
                    tournamentData={tournamentData}
                    handleTournamentInputChange={handleTournamentInputChange}
                    addDivision={addDivision}
                    updateDivision={updateDivision}
                    removeDivision={removeDivision}
                />
            }
            {activeTab === 'regulations' && 
                <RegulationsTab 
                    tournamentData={tournamentData} 
                    handleTournamentInputChange={handleTournamentInputChange} 
                />
            }
            {activeTab === 'athletes' && 
                <AthletesTab 
                    tournamentId={id}
                    divisions={tournamentData.divisions}
                    athletes={athletes}
                    groupedAthletes={groupedAthletes}
                    onAthleteAdded={handleAthleteAdded}
                    showFeedback={showFeedback}
                    openEditModal={openEditModal}
                    openDeleteModal={openDeleteModal}
                />
            }
            {activeTab === 'grids' && 
                <GridsTab 
                    tournamentData={tournamentData}
                    handleGenerateGrids={handleGenerateGrids}
                    handleAdvanceWinners={handleAdvanceWinners}
                    handleSetWinner={handleSetWinner}
                />
            }
            {activeTab === 'live' && (
                 <div className="text-center py-16 bg-navy-800 rounded-lg border border-navy-600">
                    <h3 className="text-2xl font-bold text-gold">Бұл мүмкіндік әзірленуде</h3>
                    <p className="text-gray-400 mt-2">Жақында бұл жерде таблоны басқаруға болады.</p>
                </div>
            )}
        </div>
      </div>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={handleConfirmDeleteAthlete} title="Спортшыны жоюды растау">
        {athleteToDelete && <p>Сенімдісіз бе? <span className="font-bold text-gold">{`"${athleteToDelete.name}"`}</span> спортшысын жойғыңыз келе ме?</p>}
      </ConfirmModal>

      <EditAthleteModal isOpen={isEditModalOpen} onClose={closeEditModal} onSave={handleUpdateAthlete} athlete={athleteToEdit} />
    </>
  );
}
