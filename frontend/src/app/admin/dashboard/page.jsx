'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// --- Stat Card Component ---
const StatCard = ({ icon, value, label, color }) => (
  <div className={`bg-navy-800 border border-navy-700 p-6 rounded-2xl flex items-center gap-6 shadow-lg`}>
    <div className={`text-5xl ${color}`}>{icon}</div>
    <div>
      <p className="text-4xl font-bold">{value}</p>
      <p className="text-gray-400 font-medium">{label}</p>
    </div>
  </div>
);

export default function DashboardPage() {
  const [latestTournament, setLatestTournament] = useState(null);
  const [otherTournaments, setOtherTournaments] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all tournaments, ordered by date
        const tournamentsQuery = query(collection(db, 'tournaments'), orderBy('date', 'desc'));
        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        const allTournaments = tournamentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (allTournaments.length > 0) {
          const [latest, ...others] = allTournaments;
          setLatestTournament(latest);
          setOtherTournaments(others);

          // Fetch athletes for the latest tournament
          const athletesQuery = collection(db, 'tournaments', latest.id, 'athletes');
          const athletesSnapshot = await getDocs(athletesQuery);
          const athletesList = athletesSnapshot.docs.map(doc => doc.data());
          setAthletes(athletesList);
        } else {
          // No tournaments exist
           setLatestTournament(null);
           setOtherTournaments([]);
           setAthletes([]);
        }

      } catch (err) {
        console.error("Деректерді жүктеу кезінде қате:", err);
        setError('Деректерді жүктеу мүмкін болмады.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Memoized Statistics Calculation ---
  const stats = useMemo(() => {
    if (!latestTournament) { // Simplified check
      return { athleteCount: 0, clubCount: 0, categoryCount: 0 };
    }

    const uniqueClubs = new Set(athletes.map(a => a.club).filter(Boolean));
    
    // FIX: Safely reduce divisions, defaulting to an empty array
    const categoryCount = (latestTournament.divisions || []).reduce((acc, div) => acc + (div.weights?.length || 0), 0);

    return {
      athleteCount: athletes.length,
      clubCount: uniqueClubs.size,
      categoryCount: categoryCount,
    };
  }, [athletes, latestTournament]);


  if (loading) {
    return <div className="p-6 text-center">Басты бет жүктелуде...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6">
      {/* --- Header removed for cleaner look --- */}
      
      {/* --- Latest Tournament Dashboard --- */}
      {latestTournament ? (
        <div className="bg-navy-800/50 border border-navy-700 rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-sm text-cyan-400 font-bold">Соңғы турнир</p>
                <h2 className="text-3xl font-bold text-gold">{latestTournament.name}</h2>
                <p className="text-gray-400">{latestTournament.date}</p>
            </div>
            <Link href={`/admin/tournaments/${latestTournament.id}`} className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-500 transition-colors font-semibold flex items-center gap-2">
                <span className="text-xl">🛠️</span> Басқару
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <StatCard icon="👥" value={stats.athleteCount} label="Қатысушылар" color="text-cyan-400" />
            <StatCard icon="⚔️" value={stats.clubCount} label="Клубтар" color="text-green-400" />
            <StatCard icon="⚖️" value={stats.categoryCount} label="Категориялар" color="text-yellow-400" />
          </div>
        </div>
      ) : (
         <div className="text-center py-16 bg-navy-800/50 rounded-2xl border border-navy-700 mb-8">
          <h2 className="text-3xl font-bold mb-2">Турнирлер жоқ</h2>
          <p className="text-gray-400 mb-6">Сіз әлі ешқандай турнир құрмадыңыз.</p>
           <Link href="/admin/create-tournament" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all inline-flex items-center gap-2">
            <span className="text-xl">✨</span> Бірінші турнирді құру
          </Link>
        </div>
      )}

      {/* --- Other Tournaments List --- */}
      {otherTournaments.length > 0 && (
          <div className="mt-10">
             <h3 className="text-xl font-bold mb-4 text-gray-300">Өткен турнирлер</h3>
             <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-navy-700/50">
                    <tr>
                        <th className="p-4">Атауы</th>
                        <th className="p-4">Күні</th>
                        <th className="p-4">Орны</th>
                        <th className="p-4"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {otherTournaments.map(t => (
                        <tr key={t.id} className="border-t border-navy-700 hover:bg-navy-700/50">
                        <td className="p-4 font-semibold text-gold">{t.name}</td>
                        <td className="p-4 text-gray-300">{t.date}</td>
                        <td className="p-4 text-gray-300">{t.location}</td>
                        <td className="p-4 text-right">
                            <Link href={`/admin/tournaments/${t.id}`} className="bg-navy-600 text-white px-4 py-2 rounded-lg hover:bg-navy-500 transition-colors text-sm font-semibold">
                            Басқару
                            </Link>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
             </div>
          </div>
      )}
    </div>
  );
}
