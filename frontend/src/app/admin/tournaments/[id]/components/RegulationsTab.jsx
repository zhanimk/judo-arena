'use client';

const FormSection = ({ title, children, className = '' }) => (
    <div className={`bg-navy-800 rounded-xl p-6 border border-navy-600 ${className}`}>
        {title && <h3 className="font-semibold text-gold mb-4">{title}</h3>}
        <div className="space-y-4">{children}</div>
    </div>
);

const RegulationsTab = ({ tournamentData, handleTournamentInputChange }) => {
    if (!tournamentData) return null;

    return (
        <FormSection className="lg:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FormSection title="Мақсаттар мен міндеттер">
                    <textarea id="goals" rows="5" value={tournamentData.goals || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"></textarea>
                </FormSection>
                <FormSection title="Қатысушылар мен талаптар">
                    <textarea id="participants" rows="5" value={tournamentData.participants || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"></textarea>
                </FormSection>
                <FormSection title="Бағдарлама және ережелер">
                    <textarea id="program" rows="5" value={tournamentData.program || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"></textarea>
                </FormSection>
                <FormSection title="Марапаттау">
                    <textarea id="awarding" rows="5" value={tournamentData.awarding || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"></textarea>
                </FormSection>
                <FormSection title="Қаржыландыру" className="lg:col-span-2">
                    <textarea id="financing" rows="5" value={tournamentData.financing || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"></textarea>
                </FormSection>
                <FormSection title="Қолтаңбалар (PDF үшін)" className="lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1" htmlFor="presidentTitle">Бекітушінің лауазымы</label>
                        <input type="text" id="presidentTitle" value={tournamentData.presidentTitle || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-700 p-2 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1" htmlFor="presidentName">Бекітушінің аты-жөні</label>
                        <input type="text" id="presidentName" placeholder="Мысалы: Н. Сабитов" value={tournamentData.presidentName || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-700 p-2 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1" htmlFor="secretaryTitle">Келісушінің лауазымы</label>
                        <input type="text" id="secretaryTitle" value={tournamentData.secretaryTitle || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-700 p-2 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1" htmlFor="secretaryName">Келісушінің аты-жөні</label>
                        <input type="text" id="secretaryName" placeholder="Мысалы: Ж. Қоныспаев" value={tournamentData.secretaryName || ''} onChange={handleTournamentInputChange} className="w-full bg-navy-700 p-2 rounded-lg" />
                    </div>
                    </div>
                </FormSection>
            </div>
        </FormSection>
    );
};

export default RegulationsTab;
