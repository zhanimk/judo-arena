'use client';

import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const loginAs = (role) => {
    // Позже мы добавим настоящую логику входа.
    // А пока — просто перенаправляем на нужную страницу.
    if (role === 'admin') {
      router.push('/admin/dashboard');
    } else {
      // Маршрут для судьи, который мы создадим позже
      router.push('/judge/tatami-1'); 
    }
  };

  const openScoreboard = () => {
    // Маршрут для публичного табло
    router.push('/live'); 
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 -mt-16">
      <div className="bg-navy-800 rounded-2xl p-8 w-full max-w-md card-glow border border-navy-600">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            🥋
          </div>
          <h1 id="appTitle" className="text-3xl font-bold text-gold mb-2">ДЗЮДО ТУРНИР</h1>
          <p className="text-gray-400">Турнир Басқарушы Жүйесі</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => loginAs('admin')} className="w-full py-4 bg-gradient-to-r from-gold to-yellow-500 text-navy-900 font-bold rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all flex items-center justify-center gap-3">
            <span className="text-2xl">🔐</span> <span>Әкімші ретінде кіру</span>
          </button>
          <button onClick={() => loginAs('judge')} className="w-full py-4 bg-gradient-to-r from-navy-600 to-navy-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-navy-500/30 transition-all border border-navy-400 flex items-center justify-center gap-3">
            <span className="text-2xl">👨‍⚖️</span> <span>Сұдья ретінде кіру</span>
          </button>
          <button onClick={() => openScoreboard()} className="w-full py-3 bg-transparent text-gray-400 hover:text-gold font-medium rounded-xl transition-all flex items-center justify-center gap-2">
            <span>📺</span> <span>Ашық табло</span>
          </button>
        </div>
      </div>
    </div>
  );
}
