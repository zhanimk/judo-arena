import './globals.css';

export const metadata = {
  title: 'Дзюдо Турнир Жүйесі', // Обновил заголовок
  description: 'Турнир Басқарушы Жүйесі',
};

export default function RootLayout({ children }) {
  return (
    <html lang="kk" className="h-full" suppressHydrationWarning={true}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full bg-navy-900 text-white font-exo overflow-auto">
        {children}
      </body>
    </html>
  );
}
