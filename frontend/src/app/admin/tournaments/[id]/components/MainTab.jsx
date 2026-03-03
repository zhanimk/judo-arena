'use client';

import { FormSection, DivisionEditCard } from '../page'; // Assuming these are made available from the main page

const MainTab = ({ tournamentData, handleTournamentInputChange, addDivision, updateDivision, removeDivision }) => {
    if (!tournamentData) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FormSection title="Турнир туралы ақпарат">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="text-sm text-gray-400">Турнир атауы</label>
                        <input id="name" type="text" value={tournamentData.name} onChange={handleTournamentInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                    </div>
                    <div>
                        <label htmlFor="date" className="text-sm text-gray-400">Өткізілетін күні</label>
                        <input id="date" type="date" value={tournamentData.date} onChange={handleTournamentInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="location" className="text-sm text-gray-400">Өткізілетін орны</label>
                        <input id="location" type="text" value={tournamentData.location} onChange={handleTournamentInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                    </div>
                </div>
            </FormSection>

            <FormSection title="Дивизиондар">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {(tournamentData.divisions || []).map((division) => (
                        <DivisionEditCard
                            key={division.clientId}
                            division={division}
                            onUpdate={(updated) => updateDivision(division.clientId, updated)}
                            onRemove={() => removeDivision(division.clientId)}
                        />
                    ))}
                </div>
                <button type="button" onClick={addDivision} className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500">+ Жаңа дивизион қосу</button>
            </FormSection>
        </div>
    );
};

export default MainTab;
