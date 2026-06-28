import React from "react";
import { Clock, ShieldCheck, Zap, CheckCircle2 } from "lucide-react";

interface StatusTrackerProps {
  currentStatus: string;
}

const STEPS = [
  {
    id: "Reported",
    label: "Reported",
    desc: "Grievance Logged",
    icon: Clock,
    activeColor: "bg-gov-maroon-900 border-gov-maroon-900 text-white",
    inactiveColor: "bg-gov-cream-100 border-stone-200 text-stone-400",
    isBig: false,
  },
  {
    id: "Verified",
    label: "Verified",
    desc: "Details Verified",
    icon: ShieldCheck,
    activeColor: "bg-blue-700 border-blue-700 text-white",
    inactiveColor: "bg-gov-cream-100 border-stone-200 text-stone-400",
    isBig: false,
  },
  {
    id: "In Progress",
    label: "In Progress",
    desc: "Officials Assigned",
    icon: Zap,
    activeColor: "bg-gov-gold-500 border-gov-gold-500 text-white shadow-md ring-4 ring-gov-gold-100 scale-115 md:scale-120",
    inactiveColor: "bg-gov-cream-100 border-stone-200 text-stone-400 scale-110",
    isBig: true,
  },
  {
    id: "Resolved",
    label: "Resolved",
    desc: "Grievance Solved",
    icon: CheckCircle2,
    activeColor: "bg-gov-green-600 border-gov-green-600 text-white shadow-md ring-4 ring-green-100 scale-115 md:scale-120",
    inactiveColor: "bg-gov-cream-100 border-stone-200 text-stone-400 scale-110",
    isBig: true,
  },
];

export default function StatusTracker({ currentStatus }: StatusTrackerProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStatus);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  // Calculate the percentage of progress line
  const progressPercent = (activeIdx / (STEPS.length - 1)) * 100;

  // Track color based on state
  const getProgressLineColor = () => {
    if (currentStatus === "Resolved") return "bg-gov-green-600";
    if (currentStatus === "In Progress") return "bg-gov-gold-500";
    if (currentStatus === "Verified") return "bg-blue-700";
    return "bg-gov-maroon-900";
  };

  return (
    <div className="w-full py-6 px-2 sm:px-4 bg-gov-cream-100/50 border border-stone-200/80 rounded-sm my-4">
      <div className="relative flex items-center justify-between w-full max-w-2xl mx-auto">
        {/* Background Track Line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-stone-200 rounded-full" />

        {/* Active Fill Track Line */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-500 ease-out ${getProgressLineColor()}`}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Tracker Nodes */}
        {STEPS.map((step, idx) => {
          const isCompleted = idx <= activeIdx;
          const isActive = idx === activeIdx;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center group z-10"
              id={`tracker-step-${step.id.toLowerCase().replace(" ", "-")}`}
            >
              {/* Node Circle */}
              <div
                className={`flex items-center justify-center border-2 rounded-full transition-all duration-300 ${
                  isCompleted ? step.activeColor : step.inactiveColor
                } ${
                  step.isBig
                    ? "w-11 h-11 md:w-13 md:h-13" // Extra big for In Progress & Resolved
                    : "w-8 h-8 md:w-10 md:h-10"
                }`}
              >
                <StepIcon className={step.isBig ? "w-5 h-5 md:w-6 md:h-6" : "w-4 h-4 md:w-5 md:h-5"} />
              </div>

              {/* Text Label */}
              <div className="absolute top-12 md:top-14 flex flex-col items-center text-center w-24 sm:w-28">
                <span
                  className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                    isActive
                      ? idx === 3
                        ? "text-gov-green-700 font-extrabold"
                        : idx === 2
                        ? "text-gov-gold-700 font-extrabold"
                        : idx === 1
                        ? "text-blue-800 font-extrabold"
                        : "text-gov-maroon-900 font-extrabold"
                      : isCompleted
                      ? "text-gov-maroon-700"
                      : "text-stone-400"
                  }`}
                >
                  {step.label}
                </span>
                <span className="hidden sm:inline text-[8px] font-sans font-medium text-stone-400 uppercase tracking-tight mt-0.5">
                  {step.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Spacer for label heights */}
      <div className="h-8" />
    </div>
  );
}
