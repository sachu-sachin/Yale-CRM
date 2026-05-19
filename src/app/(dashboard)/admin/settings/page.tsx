import Header from "@/components/layout/Header";
import { Settings } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <>
      <Header title="Settings" subtitle="System configuration" />
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Settings size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">
            Settings
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            System settings, email configuration, and pipeline customization
            will be available here.
          </p>
        </div>
      </div>
    </>
  );
}
