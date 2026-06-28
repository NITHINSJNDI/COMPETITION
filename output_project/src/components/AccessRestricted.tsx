import React from "react";
import { ShieldAlert, ArrowRight, UserCheck, Landmark, Building2, User } from "lucide-react";

interface AccessRestrictedProps {
  requiredRole: "citizen" | "collector" | "mla";
  currentRole: string;
  onSwitchRole: (role: "citizen" | "collector" | "mla") => void;
}

export default function AccessRestricted({ requiredRole, currentRole, onSwitchRole }: AccessRestrictedProps) {
  const roleNames = {
    citizen: "Citizen",
    collector: "District Collector",
    mla: "MLA (Assembly Representative)",
  };

  const icons = {
    citizen: <User className="text-gov-maroon-900" size={24} />,
    collector: <Landmark className="text-gov-maroon-900" size={24} />,
    mla: <UserCheck className="text-gov-maroon-900" size={24} />,
  };

  return (
    <div className="max-w-xl mx-auto my-16 bg-white border border-stone-200 p-8 shadow-xs text-center space-y-6 animate-fadeIn">
      <div className="mx-auto w-12 h-12 bg-gov-cream-200 border border-stone-200 flex items-center justify-center text-gov-maroon-900 rounded-sm">
        <ShieldAlert size={24} />
      </div>

      <div className="space-y-2">
        <span className="text-[9px] font-black tracking-[0.3em] uppercase text-stone-400 block">
          ROLE AUTHORIZATION FAILURE
        </span>
        <h3 className="font-display font-black text-2xl uppercase text-gov-maroon-900 tracking-tight">
          ACCESS RESTRICTED
        </h3>
        <p className="text-stone-500 text-sm max-w-md mx-auto">
          The requested panel requires <strong className="text-gov-maroon-950 font-bold">{roleNames[requiredRole]}</strong> privileges. 
          Your active session is authenticated as <strong className="text-gov-maroon-950 font-bold">{roleNames[currentRole as keyof typeof roleNames] || currentRole}</strong>.
        </p>
      </div>

      {/* Visual Transition Helper */}
      <div className="flex items-center justify-center gap-6 py-4 border-y border-gov-cream-200">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] font-sans text-stone-400 uppercase">ACTIVE</span>
          <div className="p-2 bg-gov-cream-100 border border-gov-cream-200 font-bold text-xs uppercase tracking-wider text-stone-600">
            {roleNames[currentRole as keyof typeof roleNames] || currentRole}
          </div>
        </div>
        <ArrowRight size={16} className="text-stone-400 mt-3 animate-pulse" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] font-sans text-stone-400 uppercase">REQUIRED</span>
          <div className="p-2 bg-gov-maroon-900 border border-gov-maroon-950 font-bold text-xs uppercase tracking-wider text-white">
            {roleNames[requiredRole]}
          </div>
        </div>
      </div>

      {/* Fast Switch Action */}
      <div className="space-y-4">
        <p className="text-xs text-stone-500 uppercase tracking-wider">
          Switch your active credentials below to unlock this portal:
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <select
            value={requiredRole}
            onChange={(e) => onSwitchRole(e.target.value as any)}
            className="px-4 py-3 border border-stone-200 text-xs font-bold uppercase tracking-widest text-gov-maroon-900 bg-white focus:border-gov-maroon-900 outline-none rounded-sm cursor-pointer"
          >
            <option value="citizen">Citizen</option>
            <option value="collector">District Collector</option>
            <option value="mla">MLA Representative</option>
          </select>

          <button
            onClick={() => onSwitchRole(requiredRole)}
            className="bg-gov-maroon-950 hover:bg-gov-maroon-800 text-white font-bold text-xs uppercase tracking-widest px-6 py-3.5 transition-colors rounded-sm cursor-pointer flex items-center gap-2"
          >
            <span>Activate Role</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
