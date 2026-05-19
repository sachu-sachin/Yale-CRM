import Header from "@/components/layout/Header";
import { BarChart3 } from "lucide-react";

export default function AdminReportsPage() {
  return (
    <>
      <Header title="Reports" subtitle="Analytics & performance metrics" />
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">
            Reports Coming Soon
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Conversion rates, source analytics, telecaller performance
            comparisons, and detailed export options are planned for Phase 2.
          </p>
        </div>
      </div>
    </>
  );
}
