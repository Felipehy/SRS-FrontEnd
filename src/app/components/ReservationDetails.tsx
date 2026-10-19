import {
  Calendar, Clock, Users, Tag, MapPin, Check, X, Coffee, FileText,
  Navigation, Phone, Car, User, Building2, Ban,
} from "lucide-react";
import { clsx } from "clsx";
import { CoffeeBadge, coffeeState } from "./StatusBadge";
import type { CalEvent } from "../types/calendar";
import { formatInstant } from "../utils/datetime";

export function DetailRow({ icon: Icon, label, value }: {
  icon?: React.ElementType; label: string; value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon
        ? <Icon size={13} className="text-muted-foreground flex-shrink-0 mt-[3px]" />
        : <span className="w-[13px] flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-xs text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-border/60 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{title}</p>
      {children}
    </div>
  );
}

export function BoolChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border",
      ok ? "text-foreground bg-muted border-border"
         : "text-muted-foreground/50 border-border/50 line-through",
    )}>
      {ok ? <Check size={10} /> : <X size={10} />}{label}
    </span>
  );
}

function yesNo(b: boolean): string {
  return b ? "Sim" : "Não";
}

function publicoExterno(temExterno: boolean, quantidade: number | null): string {
  if (!temExterno) return "Não";
  if (quantidade) return `Sim — ${quantidade} pessoas`;
  return "Sim";
}

function orDash(v: string | null | undefined): string {
  if (v?.trim()) return v;
  return "—";
}

function hasText(v: string | null | undefined): boolean {
  return !!v?.trim();
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

function fmtDateTime(iso: string | null): string {
  const texto = formatInstant(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (!texto) return "—";
  return texto;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function CoffeeDetails({ event, label, actions }: { event: CalEvent; label: string; actions?: React.ReactNode }) {
  const state = coffeeState(event);

  if (state === "sem-cafe") {
    return <DetailRow icon={Coffee} label={label} value="Não solicitado" />;
  }

  return (
    <>
      <DetailRow icon={Coffee} label={label} value={
        <span className="inline-flex mt-1"><CoffeeBadge state={state} /></span>
      } />
      {event.horaMontagemCafe && (
        <DetailRow label="Horário de montagem" value={fmtTime(event.horaMontagemCafe)} />
      )}
      {event.horaServirCafe && (
        <DetailRow label="Horário de servir" value={fmtTime(event.horaServirCafe)} />
      )}
      <DetailRow label="Motivo do café" value={orDash(event.motivoCafe)} />
      {state === "recusado" && (
        <div className="ml-[23px] rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-0.5">Motivo da recusa do café</p>
          <p className="text-xs text-red-700 dark:text-red-300 break-words">{orDash(event.motivoRejeicaoCafe)}</p>
        </div>
      )}
      {actions && <div className="ml-[23px]">{actions}</div>}
    </>
  );
}

export function ReservationDetails({ event, showDate = false, coffeeActions }: { event: CalEvent; showDate?: boolean; coffeeActions?: React.ReactNode }) {
  const raw = event.raw;

  return (
    <>
      {showDate && <DetailRow icon={Calendar} label="Data" value={<span className="capitalize">{fmtDate(event.date)}</span>} />}
      <DetailRow icon={Clock} label="Horário" value={`${fmtTime(event.time)} – ${fmtTime(event.endTime)}`} />
      <DetailRow icon={User} label="Solicitante" value={orDash(event.responsavel)} />
      <DetailRow icon={Building2} label="Departamento do solicitante" value={orDash(event.departamento)} />

      {raw?.reservationType === "MEETING_ROOM" && (
        <DetailSection title="Sala de reunião">
          <DetailRow icon={MapPin} label="Sala" value={`${raw.room.floor}`} />
          <DetailRow icon={Users} label="Participantes" value={`${raw.numPeople}`} />
          {hasText(raw.reasonOutsideHours) && (
            <DetailRow icon={FileText} label="Motivo do uso após as 19:00" value={raw.reasonOutsideHours} />
          )}
          <DetailRow icon={Phone} label="Telefone" value={orDash(raw.telephone)} />
          <CoffeeDetails event={event} label="Café e água" actions={coffeeActions} />
          <DetailRow icon={FileText} label="Observações" value={orDash(raw.observation)} />
        </DetailSection>
      )}

      {raw?.reservationType === "AUDITORIUM" && (
        <DetailSection title="Auditório">
          <DetailRow icon={Clock} label="Abertura do auditório" value={fmtTime(raw.timeOpenAuditorium)} />
          <DetailRow icon={FileText} label="Motivo da abertura antecipada" value={orDash(raw.reasonOpenAuditorium)} />
          <DetailRow icon={FileText} label="Motivo da reserva" value={orDash(raw.reason)} />
          {hasText(raw.reasonOutsideHours) && (
            <DetailRow icon={FileText} label="Motivo do uso após as 19:00" value={raw.reasonOutsideHours} />
          )}
          <DetailRow icon={Users} label="Público estimado" value={`${raw.numPeople + (raw.numExternalPeople ?? 0)}`} />
          <DetailRow icon={Users} label="Pessoas da SIURB" value={`${raw.numPeople}`} />
          <DetailRow icon={Users} label="Público externo" value={publicoExterno(raw.externalPublic, raw.numExternalPeople)} />
          <DetailRow icon={Phone} label="Telefone" value={orDash(raw.telephone)} />
          <DetailRow label="Recursos" value={
            <span className="flex flex-wrap gap-1.5 mt-1">
              <BoolChip ok={raw.necessaryScreen} label="Telão" />
              <BoolChip ok={raw.necessarySoundSystem} label="Som" />
            </span>
          } />
          <CoffeeDetails event={event} label="Coffee break" actions={coffeeActions} />
          <DetailRow icon={FileText} label="Observações" value={orDash(raw.observation)} />
        </DetailSection>
      )}

      {raw?.reservationType === "FLEET_VEHICLE" && (
        <DetailSection title="Veículo da frota">
          <DetailRow icon={FileText} label="Motivo da reserva" value={orDash(raw.reason)} />
          <DetailRow icon={MapPin} label="Saída" value={`${fmtTime(raw.exitTime)} — ${raw.departureAddress}`} />
          <DetailRow icon={Navigation} label="Destino" value={raw.destinationAddress} />
          <DetailRow icon={MapPin} label="Fora do município" value={yesNo(raw.isOutsideTheMunicipality)} />
          {raw.isOutsideTheMunicipality && (
            <DetailRow icon={FileText} label="Motivo da saída do município" value={orDash(raw.reasonOutsideTheMunicipality)} />
          )}
          <DetailRow icon={Clock} label="Retorno" value={
            raw.necessaryReturn
              ? `${raw.returnTime ? fmtTime(raw.returnTime) : "horário não informado"}${raw.departureAddressReturn ? ` — de ${raw.departureAddressReturn}` : ""}${raw.destinationAddressReturn ? ` para ${raw.destinationAddressReturn}` : ""}`
              : "Sem retorno"
          } />
          <DetailRow icon={Car} label="Veículo" value={raw.typeVehicle === "VAN" ? "Van" : "Carro"} />
          {raw.necessaryVan && <DetailRow icon={Car} label="Justificativa da van" value={orDash(raw.reasonUseVan)} />}
          <DetailRow icon={Users} label="Passageiros" value={`${raw.quantityPassengers}`} />
          <DetailRow icon={Users} label="Motorista" value={raw.driver?.name ?? "Não definido"} />
          <DetailRow icon={Phone} label="Contato" value={orDash(raw.contact)} />
          <DetailRow icon={Phone} label="Telefone" value={orDash(raw.telephone)} />
        </DetailSection>
      )}

      {raw && (
        <DetailSection title="Acompanhamento">
          <DetailRow icon={Calendar} label="Solicitada em" value={fmtDateTime(raw.dateCreate)} />
          <DetailRow icon={Calendar} label="Analisada em" value={fmtDateTime(raw.dateAnalysis)} />
          <DetailRow icon={Tag} label="Analisada por" value={orDash(raw.userNameApprover)} />
        </DetailSection>
      )}

      {raw && event.status === "CANCELADA" && (
        <DetailSection title="Cancelamento">
          <DetailRow icon={Ban} label="Cancelada em" value={fmtDateTime(raw.dateCancellation)} />
          {hasText(raw.reasonsCancellation) && (
            <div className="ml-[23px] rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-0.5">Motivo do cancelamento</p>
              <p className="text-xs text-red-700 dark:text-red-300 break-words">{raw.reasonsCancellation}</p>
            </div>
          )}
        </DetailSection>
      )}
    </>
  );
}
