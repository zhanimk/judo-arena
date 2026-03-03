import Link from 'next/link';
import TournamentsView from './TournamentsView';

export default function TournamentsPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gold">Барлық турнирлер</h1>
        <Link href="/admin/create-tournament" className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors">
          + Жаңа турнир құру
        </Link>
      </div>
      <TournamentsView />
    </div>
  );
}
