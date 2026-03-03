'use client';

import AthleteRegistrationForm from '../../../athletes/AthleteRegistrationForm';

const FormSection = ({ title, children, className = '' }) => (
    <div className={`bg-navy-800 rounded-xl p-6 border border-navy-600 ${className}`}>
        {title && <h3 className="font-semibold text-gold mb-4">{title}</h3>}
        <div className="space-y-4">{children}</div>
    </div>
);

const AthletesTab = ({ tournamentId, divisions, athletes, groupedAthletes, onAthleteAdded, showFeedback, openEditModal, openDeleteModal }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <AthleteRegistrationForm 
                    tournamentId={tournamentId}
                    divisions={divisions}
                    onAthleteAdded={onAthleteAdded}
                    showFeedback={showFeedback}
                />
            </div>
            <div className="md:col-span-2">
                <FormSection title={`Тіркелген спортшылар (${athletes.length})`}>
                    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                        {Object.keys(groupedAthletes).length > 0 ? (
                            Object.keys(groupedAthletes).map(divisionKey => (
                                <div key={divisionKey} className="bg-navy-900/50 rounded-lg">
                                    <h4 className="text-gold font-bold p-3 border-b border-navy-600 sticky top-0 bg-navy-900/80 backdrop-blur-sm">{divisionKey}</h4>
                                    <div className="p-3 space-y-3">
                                        {Object.keys(groupedAthletes[divisionKey]).sort((a,b) => parseFloat(a.replace(/\+|-/g, '')) - parseFloat(b.replace(/\+|-/g, ''))).map(weight => (
                                            (groupedAthletes[divisionKey][weight].length > 0) && (
                                                <div key={weight}>
                                                    <h5 className="text-gray-300 font-semibold mb-2">Салмақ: {weight} ({groupedAthletes[divisionKey][weight].length} спортшы)</h5>
                                                    <div className="space-y-2">
                                                        {groupedAthletes[divisionKey][weight].map(athlete => (
                                                            <div key={athlete.id} className="flex justify-between items-center bg-navy-700/80 p-3 rounded-lg border border-navy-600">
                                                                <div>
                                                                    <p className="font-bold">{athlete.name} <span className="text-sm font-normal text-gray-400">({athlete.yob})</span></p>
                                                                    <p className="text-sm text-gray-400">{athlete.club || 'Клуб көрсетілмеген'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <button onClick={() => openEditModal(athlete)} className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors">Өзгерту</button>
                                                                    <button onClick={() => openDeleteModal(athlete)} className="text-red-500 hover:text-red-400 font-bold text-xl transition-colors">×</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                        {Object.values(groupedAthletes[divisionKey]).every(arr => arr.length === 0) && (
                                            <p className="text-gray-500 text-center py-4">Бұл дивизионда спортшылар жоқ.</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-center py-8">Бұл турнирге әлі ешкім тіркелмеген.</p>
                        )}
                    </div>
                </FormSection>
            </div>
        </div>
    );
};

export default AthletesTab;
