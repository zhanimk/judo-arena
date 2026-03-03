'use client';

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  const handleJudgeLogin = () => {
    router.push('/judge/tatami-1'); 
  };

  const openScoreboard = () => {
    router.push('/live'); 
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 -mt-16">
      <div className="bg-navy-800 rounded-2xl p-8 w-full max-w-md card-glow border border-navy-600">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            🔷
          </div>
          <h1 id="appTitle" className="text-3xl font-bold text-cyan-400 mb-2">PROTOZH</h1>
          <p className="text-gray-400">Турнир Басқарушы Жүйесі</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => router.push('/login')} className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-3">
            <span className="text-2xl">🔐</span> <span>Әкімші ретінде кіру</span>
          </button>
          <button onClick={handleJudgeLogin} className="w-full py-4 bg-gradient-to-r from-navy-600 to-navy-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-navy-500/30 transition-all border border-navy-400 flex items-center justify-center gap-3">
            <span className="text-2xl">👨‍⚖️</span> <span>Сұдья ретінде кіру</span>
          </button>
          <button onClick={openScoreboard} className="w-full py-3 bg-transparent text-gray-400 hover:text-cyan-400 font-medium rounded-xl transition-all flex items-center justify-center gap-2">
            <span>📺</span> <span>Ашық табло</span>
          </button>
        </div>
      </div>
    </div>
  );
}
