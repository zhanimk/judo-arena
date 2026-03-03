'use client';

const GridsTab = ({ tournamentData, handleGenerateGrids, handleAdvanceWinners, handleSetWinner }) => {
    return (
        <div>
            <div className="flex justify-center items-center gap-4 mb-6 p-4 bg-navy-900/50 rounded-lg">
                <button onClick={handleGenerateGrids} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-5 rounded-lg shadow-lg transition-transform transform hover:scale-105">
                    Сеткаларды Басынан Генерациялау
                </button>
                <button onClick={handleAdvanceWinners} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg shadow-lg transition-transform transform hover:scale-105">
                    Келесі Раундты Генерациялау
                </button>
            </div>
            
            {tournamentData.grids && Object.keys(tournamentData.grids).length > 0 ? (
                <div className="space-y-8">
                    {Object.keys(tournamentData.grids).map(divisionKey => (
                        <div key={divisionKey} className="bg-navy-800 rounded-xl border border-navy-600">
                            <h3 className="text-gold font-bold p-4 text-xl border-b border-navy-700">{divisionKey}</h3>
                            <div className="p-4 space-y-6">
                                {Object.keys(tournamentData.grids[divisionKey]).map(weightKey => {
                                    const grid = tournamentData.grids[divisionKey][weightKey];
                                    const matchesByRound = (grid.matches || []).reduce((acc, match, index) => {
                                        (acc[match.round] = acc[match.round] || []).push({ ...match, originalIndex: index });
                                        return acc;
                                    }, {});

                                    if (!grid.matches || grid.matches.length === 0) return null;

                                    return (
                                        <div key={weightKey} className="bg-navy-900/50 p-4 rounded-lg">
                                            <h4 className="font-semibold text-white mb-4 text-lg text-center">Салмақ: {weightKey}</h4>
                                            
                                            {grid.status === 'finished' && grid.champion && (
                                                    <div className="text-center py-4 mb-4 bg-gold rounded-lg">
                                                    <p className="font-bold text-navy-900 text-lg">🏆 Чемпион: {grid.champion.name}</p>
                                                    </div>
                                            )}

                                            <div className="flex space-x-4 overflow-x-auto pb-4">
                                                {Object.keys(matchesByRound).map(round => (
                                                    <div key={round} className="min-w-[250px]">
                                                        <h5 className="text-center font-bold text-gold mb-3">Раунд {round}</h5>
                                                        <div className="space-y-3">
                                                            {matchesByRound[round].map(match => (
                                                                <div key={match.originalIndex} className="bg-navy-700/80 p-2 rounded-lg text-sm relative border border-transparent focus-within:border-gold">
                                                                    <div 
                                                                        className={`p-2 rounded cursor-pointer transition-all duration-150 ${match.winner && match.winner.id === match.white.id ? 'bg-gold text-navy-900 font-bold' : (match.winner ? 'opacity-40' : 'hover:bg-navy-600')}`}
                                                                        onClick={() => handleSetWinner(divisionKey, weightKey, match.originalIndex, 'white')}
                                                                    >
                                                                        {match.white.name}
                                                                    </div>
                                                                    <div className="text-center text-gray-400 text-xs my-1">vs</div>
                                                                    <div 
                                                                        className={`p-2 rounded cursor-pointer transition-all duration-150 ${match.red.id === 'BYE' ? 'text-center text-gray-500' : ''} ${match.winner && match.winner.id === match.red.id ? 'bg-gold text-navy-900 font-bold' : (match.winner ? 'opacity-40' : 'hover:bg-navy-600')}`}
                                                                        onClick={() => match.red.id !== 'BYE' && handleSetWinner(divisionKey, weightKey, match.originalIndex, 'red')}
                                                                    >
                                                                        {match.red.name}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-navy-800 rounded-lg border border-navy-600">
                    <h3 className="text-xl font-bold text-gold">Сеткалар әлі генерацияланбады</h3>
                    <p className="text-gray-400 mt-2">Жоғарыдағы батырманы басып, бірінші раунд жұптарын жасаңыз.</p>
                </div>
            )}
        </div>
    );
};

export default GridsTab;
