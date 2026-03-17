const stats = [
  { value: "1,200+", label: "Registered Clubs" },
  { value: "50k+", label: "Active Athletes" },
  { value: "200", label: "Annual Events" },
  { value: "15", label: "Live Channels" },
];

export default function StatsSection() {
  return (
    <section className="border-b border-darkBorder py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-12 px-4 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="text-center">
            <p className="mb-3 text-4xl font-extrabold text-white md:text-5xl">
              {item.value}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}