'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const FormSection = ({ title, children }) => (
    <div className="bg-navy-800 rounded-xl p-6 border border-navy-600 h-full">
      <h3 className="font-semibold text-gold mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );

export default function AthleteRegistrationForm({ tournamentId, divisions, onAthleteAdded, showFeedback }) {
    const [newAthlete, setNewAthlete] = useState({ name: '', yob: '', club: '', division: '', weight: '' });

    const allDivisions = useMemo(() => {
        if (!divisions) return [];
        return divisions
            .filter(div => div.ageGroup && div.weights?.length > 0)
            .map(div => ({
                value: `${div.gender}|${div.ageGroup}`,
                label: `${div.gender} / ${div.ageGroup}`
            }));
    }, [divisions]);

    const availableWeights = useMemo(() => {
        if (!newAthlete.division || !divisions) return [];
        const [gender, ageGroup] = newAthlete.division.split('|');
        const selectedDivision = divisions.find(
            div => div.gender === gender && div.ageGroup === ageGroup
        );
        return selectedDivision?.weights || [];
    }, [newAthlete.division, divisions]);

    useEffect(() => {
        if (allDivisions.length > 0 && !allDivisions.some(d => d.value === newAthlete.division)) {
            setNewAthlete(prev => ({ ...prev, division: allDivisions[0].value, weight: '' }));
        }
    }, [allDivisions, newAthlete.division]);

    useEffect(() => {
        if (availableWeights.length > 0 && !availableWeights.includes(newAthlete.weight)) {
            setNewAthlete(prev => ({ ...prev, weight: availableWeights[0] }));
        } else if (availableWeights.length === 0) {
            setNewAthlete(prev => ({ ...prev, weight: '' }));
        }
    }, [newAthlete.division, availableWeights, newAthlete.weight]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewAthlete(prev => ({ ...prev, [name]: value }));
    };

    const handleAddAthlete = async (e) => {
        e.preventDefault();
        if (!newAthlete.name || !newAthlete.yob || !newAthlete.division || !newAthlete.weight) {
            showFeedback('error', "Барлық өрістерді толтырыңыз.");
            return;
        }

        const [gender, ageGroup] = newAthlete.division.split('|');
        const athleteToSave = { 
            name: newAthlete.name, 
            yob: newAthlete.yob, 
            club: newAthlete.club, 
            gender, 
            ageGroup, 
            weight: newAthlete.weight 
        };

        try {
            const docRef = await addDoc(collection(db, 'tournaments', tournamentId, 'athletes'), athleteToSave);
            onAthleteAdded({ id: docRef.id, ...athleteToSave });
            showFeedback('success', 'Спортшы сәтті тіркелді!');
            setNewAthlete(prev => ({ ...prev, name: '', yob: '', club: '' }));
        } catch (error) {
            console.error("Спортшыны қосу қатесі:", error);
            showFeedback('error', "Спортшыны қосу кезінде қате пайда болды.");
        }
    };

    return (
        <FormSection title="Жаңа спортшыны тіркеу">
            <form onSubmit={handleAddAthlete} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400">Дивизион</label>
                        <select name="division" value={newAthlete.division} onChange={handleInputChange} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none">
                           {allDivisions.length === 0 && <option>Алдымен дивизион қосыңыз</option>}
                           {allDivisions.map(div => <option key={div.value} value={div.value}>{div.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Салмақ</label>
                        <select name="weight" value={newAthlete.weight} onChange={handleInputChange} disabled={availableWeights.length === 0} className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                            {availableWeights.length === 0 && <option>Салмақ жоқ</option>}
                            {availableWeights.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Аты-жөні</label>
                    <input name="name" value={newAthlete.name} onChange={handleInputChange} placeholder="Мысалы: Ибрагимов Әли" className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400">Туған жылы</label>
                        <input name="yob" type="number" value={newAthlete.yob} onChange={handleInputChange} placeholder="2010" className="w-full mt-1 bg-navy-900 p-2 rounded-md border-navy-500 focus:border-gold focus:outline-none"/>
                    </div>
                    <div>
                        <label className="text-sm text-gray-400">Клуб</label>
                        <input name="club" value={newAthlete.club} onChange={handleInputChange} placeholder="Qazaqstan" className="w-full mt-1 bg-navy-900 p-2 rounded-md border border-navy-500 focus:border-gold focus:outline-none"/>
                    </div>
                </div>
                <button type="submit" disabled={allDivisions.length === 0} className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed">+ Спортшыны тіркеу</button>
            </form>
        </FormSection>
    );
}
