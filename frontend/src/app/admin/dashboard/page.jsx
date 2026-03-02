'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function DashboardPage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const tournamentsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTournaments(tournamentsList);
      } catch (error) {
        console.error("Турнирлерді жүктеу кезінде қате:", error);
      }
      setLoading(false);
    };

    fetchTournaments();
  }, []);

  if (loading) {
    return <div className="p-6 text-center">Турнирлер жүктелуде...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span className="text-gold">🏆</span> Барлық турнирлер
        </h1>
        <Link href="/admin/create-tournament" className="px-4 py-2 bg-gold text-navy-900 font-bold rounded-lg hover:bg-yellow-400 transition-colors">
          + Жаңа турнир құру
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-10 bg-navy-800 rounded-lg">
          <p className="text-gray-400">Әзірге турнирлер жоқ.</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-navy-700">
              <tr>
                <th className="p-4">Атауы</th>
                <th className="p-4">Күні</th>
                <th className="p-4">Орны</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map(t => (
                <tr key={t.id} className="border-t border-navy-600 hover:bg-navy-700/50">
                  <td className="p-4 font-semibold text-gold">{t.name}</td>
                  <td className="p-4 text-gray-300">{t.date}</td>
                  <td className="p-4 text-gray-300">{t.location}</td>
                  <td className="p-4 text-right">
                    <Link href={`/admin/tournaments/${t.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500">
                      Басқару
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
