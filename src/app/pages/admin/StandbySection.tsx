import { Clock } from "lucide-react";

export default function StandbySection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-border/50">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          <Clock size={15} className="text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <span className="inline-block text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
            Em standby
          </span>
          <p className="text-xs text-muted-foreground mt-2 mb-2">Previsto para esta seção:</p>
          <ul className="space-y-1">
            {items.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
