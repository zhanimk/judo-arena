export default function SearchSection() {
  return (
    <section className="relative z-20 -mt-12 px-4" data-purpose="global-search">
      <div className="mx-auto max-w-5xl rounded-custom border border-darkBorder bg-darkSurface p-8 shadow-2xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Search Event or Club
            </label>
            <input
              type="text"
              placeholder="e.g. World Championship Tokyo"
              className="w-full rounded-custom border border-darkBorder bg-darkBg py-3 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Region
            </label>
            <select className="w-full rounded-custom border border-darkBorder bg-darkBg py-3 text-sm text-white focus:ring-primary">
              <option>Global Coverage</option>
              <option>Europe</option>
              <option>Asia</option>
              <option>Pan America</option>
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full rounded-custom bg-white py-3 text-[11px] font-black uppercase tracking-[0.2em] text-darkBg shadow-lg shadow-black/40 transition-colors hover:bg-primary">
              Find Results
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}