import { Truck, Clock } from "lucide-react";

export default function GestaoFrotasPage() {
  return (
    <div className="h-full overflow-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-[#f59e0b]/10 flex items-center justify-center mb-4">
            <Truck size={24} className="text-[#f59e0b]" />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Gestão de Frotas</p>
          <h1 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-3xl text-foreground mb-3">
            Painel de Frotas
          </h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Tela dedicada ao perfil Frotas — em construção. A estrutura já está separada e
            pronta para receber as funcionalidades assim que forem definidas.
          </p>
        </div>

        <div className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-border/50">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock size={15} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Funcionalidades da frota</p>
            <p className="text-xs text-muted-foreground">Gestão de veículos, motoristas e aprovações da frota.</p>
            <span className="inline-block mt-2 text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
              Em construção
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
