import { Link } from "react-router";
import { CalendarDays, ArrowRight } from "lucide-react";
import MyReservationsPanel from "../components/MyReservationsPanel";
import { useTutorial } from "../context/TutorialContext";
import { useAuth } from "../context/AuthContext";
import logoSrs from "@/resources/img/favicon-branco-circulo.svg"

export default function Home() {
  const tutorial = useTutorial();
  const { user } = useAuth();

  let saudacao = "Seja bem-vindo!";
  if (user && user.nameResolved) {
    const primeiroNome = user.name.trim().split(" ")[0];
    saudacao = `Seja bem-vindo, ${primeiroNome}!`;
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col items-center">
        <div className="text-center mb-12">

          <img src={logoSrs} className="justify-self-center w-20 pb-3" alt="" />

          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
            Sistema de Reservas
          </p>
          <h1
            className="text-4xl md:text-5xl text-foreground mb-4 motion-safe:animate-[homeFloat_4s_ease-in-out_infinite]"
            style={{ fontFamily: "'Blinker', sans-serif" }}
          >
            {saudacao}
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            Abra o calendário para visualizar as reservas e solicitar uma nova.
          </p>
        </div>

        <Link
          data-tour="home-calendario"
          to="/calendario"
          className="group relative flex flex-col items-start w-full max-w-sm p-6 rounded-2xl border bg-gradient-to-br from-[#5b4fcf]/10 to-[#5b4fcf]/5 border-[#5b4fcf]/20 hover:border-[#5b4fcf]/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "#5b4fcf20" }}
          >
            <CalendarDays size={22} style={{ color: "#5b4fcf" }} />
          </div>

          <h2 className="text-base font-semibold text-foreground mb-2 leading-snug">
            Calendário
          </h2>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
            Veja a disponibilidade e solicite uma nova reserva de sala de reunião, auditório ou veículo da frota.
          </p>

          <div className="flex items-center justify-between w-full mt-auto">
            <span
              className="text-[10px] font-medium px-2 py-1 rounded-full"
              style={{ background: "#5b4fcf20", color: "#5b4fcf" }}
            >
              Salas, auditório e frota
            </span>
            <ArrowRight
              size={14}
              className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
            />
          </div>
        </Link>

        <MyReservationsPanel />

        {tutorial.active && <div className="h-[45dvh] flex-shrink-0" aria-hidden="true" />}
      </div>
      <style>{`@keyframes homeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
