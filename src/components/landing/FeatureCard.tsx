import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  image: string;
}

export function FeatureCard({ icon: Icon, title, description, image }: FeatureCardProps) {
  return (
    <Card className="group relative overflow-hidden bg-white border border-slate-200 hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg">
      {/* Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm rounded-xl" />
      
      <div className="relative">
        {/* Image Section */}
        <div className="relative h-52 sm:h-64 overflow-hidden border-b border-slate-100">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3 relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
          
          {/* Blue bottom line on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Card>
  );
}
