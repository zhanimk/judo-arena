import './globals.css';

export const metadata = {
  title: 'PROTOZH',
  description: 'Турнир Басқарушы Жүйесі',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><polygon points=\'50 0, 100 50, 50 100, 0 50\' fill=\'%2322d3ee\'/></svg>",
  },
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
