'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import ConfirmModal from '../../../components/ConfirmModal'; // Import the modal component

export default function TournamentsListPage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the confirmation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'tournaments'));
        const tournamentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tournamentsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setTournaments(tournamentsData);
      } catch (err) {
        console.error("Firestore-дан оқу кезінде қате:", err);
        setError("Турнирлер тізімін жүктеу мүмкін болмады.");
      }
      setLoading(false);
    };
    fetchTournaments();
  }, []);

  // Opens the confirmation modal
  const handleOpenDeleteModal = (id, name) => {
    setTournamentToDelete({ id, name });
    setIsModalOpen(true);
  };

  // Closes the confirmation modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTournamentToDelete(null);
  };

  // The actual deletion logic, triggered by the modal
  const handleConfirmDelete = async () => {
    if (!tournamentToDelete) return;

    setIsDeleting(true);
    try {
      const { id } = tournamentToDelete;
      const batch = writeBatch(db);

      const athletesRef = collection(db, 'tournaments', id, 'athletes');
      const athletesSnapshot = await getDocs(athletesRef);
      athletesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      const tournamentRef = doc(db, 'tournaments', id);
      batch.delete(tournamentRef);

      await batch.commit();

      setTournaments(tournaments.filter(t => t.id !== id));
      alert('Турнир сәтті жойылды.');

    } catch (error) {
      console.error("Турнирді жою қатесі:", error);
      alert("Турнирді жою кезінде қате пайда болды.");
    } finally {
      setIsDeleting(false);
      handleCloseModal();
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Турнирлер жүктелуде...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gold">Барлық турнирлер</h1>
          <Link href="/admin/create-tournament" className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors">
            + Жаңа турнир құру
          </Link>
        </div>

        <div className="bg-navy-800 rounded-xl border border-navy-600">
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-navy-600">
                    <th className="p-4 font-semibold">Атауы</th>
                    <th className="p-4 font-semibold">Күні</th>
                    <th className="p-4 font-semibold">Орны</th>
                    <th className="p-4 font-semibold text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-gray-400">Турнирлер әлі құрылмаған.</td>
                    </tr>
                  ) : (
                    tournaments.map(tournament => (
                      <tr key={tournament.id} className="border-b border-navy-700 hover:bg-navy-700/50 transition-colors">
                        <td className="p-4 text-gold font-medium">{tournament.name}</td>
                        <td className="p-4">{tournament.date}</td>
                        <td className="p-4 text-gray-300">{tournament.location}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                              <Link href={`/admin/tournaments/${tournament.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors font-semibold">
                                Басқару
                              </Link>
                              <button 
                                  onClick={() => handleOpenDeleteModal(tournament.id, tournament.name)} 
                                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 transition-colors font-semibold">
                                  Жою
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
        title="Жоюды растау"
      >
        {tournamentToDelete && 
          <p>Сенімдісіз бе? <span className="font-bold text-gold">{`"${tournamentToDelete.name}"`}</span> турнирін және оған қатысты барлық деректерді толығымен жойғыңыз келе ме? Бұл әрекетті қайтару мүмкін емес.</p>
        }
      </ConfirmModal>
    </>
  );
}
