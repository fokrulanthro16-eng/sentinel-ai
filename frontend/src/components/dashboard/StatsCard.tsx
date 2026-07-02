import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: string; up: boolean };
  pulse?: boolean;
  loading?: boolean;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-blue-400",
  trend,
  pulse = false,
  loading = false,
}: StatsCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-28 rounded bg-secondary animate-pulse" />
              <div className="h-8 w-14 rounded bg-secondary animate-pulse" />
              <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-secondary animate-pulse shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p className={cn("text-xs font-medium", trend.up ? "text-red-400" : "text-green-400")}>
                {trend.up ? "↑" : "↓"} {trend.value}
              </p>
            )}
          </div>
          <div className="rounded-lg p-2.5 bg-secondary relative">
            <Icon className={cn("h-5 w-5", iconColor)} />
            {pulse && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
