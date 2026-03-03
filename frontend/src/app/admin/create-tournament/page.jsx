import CreateTournamentForm from './CreateTournamentForm';

export default function CreateTournamentPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-3 p-6">
        <span className="text-gold">🏆</span> Жаңа турнир құру
      </h1>
      <CreateTournamentForm />
    </div>
  );
}
