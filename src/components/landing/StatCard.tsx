import { useRef, useState, useEffect } from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  value: number;
  suffix: string;
  label: string;
  icon: LucideIcon;
  index: number;
}

function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasStarted) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasStarted(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  return { count, ref };
}

export function StatCard({ value, suffix, label, icon: Icon, index }: StatCardProps) {
  const { count, ref } = useCountUp(value);

  return (
    <div
      ref={ref}
      className="relative group"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/15 to-emerald-500/15 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
      <div className="relative bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:border-green-300 hover:shadow-md transition-all">
        <Icon className="h-8 w-8 text-green-500 mx-auto mb-3" />
        <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">
          {count}{suffix}
        </div>
        <div className="text-sm text-slate-600">{label}</div>
      </div>
    </div>
  );
}
