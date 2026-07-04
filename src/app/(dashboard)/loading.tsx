export default function DashboardLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* header line */}
      <div className="h-7 w-48 bg-slate-200/70 rounded-lg mb-2" />
      <div className="h-4 w-64 bg-slate-100 rounded mb-8" />

      {/* stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-slate-100 p-5">
            <div className="h-10 w-10 rounded-xl bg-slate-100 mb-4" />
            <div className="h-6 w-20 bg-slate-200/70 rounded mb-2" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* table / panel */}
      <div className="rounded-2xl bg-white border border-slate-100 p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-slate-100" />
            <div className="h-4 flex-1 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
