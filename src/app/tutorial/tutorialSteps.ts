import type { CategoryKey } from "../types/calendar";
import type { Role } from "../auth/roles";
import type { Breakpoint } from "../utils/useBreakpoint";

export type TutorialSide = "top" | "bottom" | "left" | "right";

export interface TutorialCallout {
  target: string;
  title: string;
  text: string;
  side: TutorialSide;
  pointer?: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  route: string;
  modal: boolean;
  category: CategoryKey | null;
  breakpoints?: Breakpoint[];
  coffeeForm?: boolean;
  callouts: TutorialCallout[];
}

export const TUTORIAL_ROLES: Role[] = ["geral"];

export const TUTORIAL_HOME = "/";

export const TUTORIAL_TARGET_TIMEOUT = 5000;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "inicio",
    title: "Tela inicial",
    route: "/",
    modal: false,
    category: null,
    callouts: [
      {
        target: "home-calendario",
        title: "Calendário",
        text: "Abre o calendário com as reservas de salas de reunião, auditório e veículos da frota. É por lá que você faz uma nova reserva.",
        side: "top",
      },
      {
        target: "home-minhas-reservas",
        title: "Minhas reservas",
        text: "Acompanhe o status das suas solicitações. Filtre por tipo ou por data e clique numa reserva para ver os detalhes.",
        side: "bottom",
      },
    ],
  },
  {
    id: "calendario-criar",
    title: "Calendário: criar e encontrar",
    route: "/calendario",
    modal: false,
    category: null,
    callouts: [
      {
        target: "cal-nova-reserva",
        title: "Nova reserva",
        text: "Abre o formulário de reserva para o dia selecionado.",
        side: "right",
      },
      {
        target: "cal-busca",
        title: "Buscar",
        text: "Encontre reservas por título, data, responsável ou categoria.",
        side: "right",
      },
      {
        target: "cal-mini",
        title: "Escolher o dia",
        text: "Clique num dia para ver as reservas dele. Os pontinhos marcam os dias que já têm reserva.",
        side: "right",
      },
      {
        target: "cal-filtros",
        title: "Categorias",
        text: "Mostre ou esconda salas, auditório e frota no calendário.",
        side: "right",
      },
    ],
  },
  {
    id: "calendario-visualizar",
    title: "Calendário: visualizar",
    route: "/calendario",
    modal: false,
    category: null,
    breakpoints: ["tablet", "desktop"],
    callouts: [
      {
        target: "cal-visao",
        title: "Mês, semana ou dia",
        text: "Troque a forma de ver o calendário.",
        side: "left",
      },
      {
        target: "cal-grade",
        title: "Calendário",
        text: "Clique numa reserva para ver os detalhes. Dois cliques num dia já abrem uma nova reserva.",
        side: "left",
      },
    ],
  },
  {
    id: "calendario-dia",
    title: "Calendário: reservas do dia",
    route: "/calendario",
    modal: false,
    category: null,
    callouts: [
      {
        target: "cal-dia",
        title: "Reservas do dia",
        text: "Mostra as reservas do dia escolhido e o status de cada uma. \"Adicionar reserva\" também abre o formulário.",
        side: "left",
      },
      {
        target: "cal-proximas",
        title: "Próximas reservas",
        text: "As próximas reservas do calendário. Clique numa delas para ir até o dia.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-tipo",
    title: "Nova reserva: o que reservar",
    route: "/calendario",
    modal: true,
    category: null,
    callouts: [
      {
        target: "reserva-tipos",
        title: "Tipo de reserva",
        text: "Cada opção abre um formulário próprio. A seguir, vamos passar pelos três.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-comuns",
    title: "Campos comuns aos três tipos",
    route: "/calendario",
    modal: true,
    category: "MEETING_ROOM",
    callouts: [
      {
        target: "campo-data",
        title: "Data",
        text: "Dia da reserva. Datas passadas não são aceitas.",
        side: "left",
      },
      {
        target: "campo-divisao",
        title: "Divisão",
        text: "Preenchida com o departamento do seu usuário. Se aparecer \"Sem departamento\", fale com o administrador.",
        side: "right",
      },
      {
        target: "campo-responsavel",
        title: "Servidor responsável",
        text: "É você: a reserva fica no seu nome automaticamente.",
        side: "left",
      },
      {
        target: "campo-contato",
        title: "Contato",
        text: "Ramal (4 dígitos) ou telefone. Obrigatório em todas as reservas.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-sala",
    title: "Sala de reunião",
    route: "/calendario",
    modal: true,
    category: "MEETING_ROOM",
    callouts: [
      {
        target: "tipo-MEETING_ROOM",
        title: "Sala de reunião",
        text: "Para reuniões internas nas salas dos andares.",
        side: "left",
      },
      {
        target: "sala-sala",
        title: "Sala",
        text: "Só aparecem as salas liberadas pela administração.",
        side: "right",
      },
      {
        target: "sala-horario",
        title: "Início e término",
        text: "A partir das 07:00. Se terminar depois das 19:00, aparece um campo para explicar o motivo.",
        side: "right",
      },
      {
        target: "sala-pessoas",
        title: "Quantidade de pessoas",
        text: "Quantas pessoas vão participar da reunião.",
        side: "left",
      },
    ],
  },
  {
    id: "reserva-sala-extras",
    title: "Sala de reunião: café e observações",
    route: "/calendario",
    modal: true,
    category: "MEETING_ROOM",
    callouts: [
      {
        target: "sala-cafe",
        title: "Café e água",
        text: "Abre uma janela para dizer se precisa de café e água. O motivo é opcional.",
        side: "right",
      },
      {
        target: "campo-observacoes",
        title: "Observações",
        text: "Informações extras sobre a reserva, se precisar. O auditório também tem este campo.",
        side: "left",
      },
    ],
  },
  {
    id: "reserva-auditorio",
    title: "Auditório",
    route: "/calendario",
    modal: true,
    category: "AUDITORIUM",
    callouts: [
      {
        target: "tipo-AUDITORIUM",
        title: "Auditório",
        text: "Para palestras, apresentações e eventos com até 100 pessoas.",
        side: "left",
      },
      {
        target: "aud-horarios",
        title: "Abertura, início e fim",
        text: "A abertura pode ser antes do início do evento, para preparar o espaço. Nesse caso, explique o motivo.",
        side: "right",
      },
      {
        target: "aud-publico",
        title: "Público",
        text: "Pessoas da SIURB e, se houver, público externo. O total não pode passar de 100.",
        side: "left",
      },
      {
        target: "aud-assunto",
        title: "Assunto do evento",
        text: "Tema ou nome do evento.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-auditorio-extras",
    title: "Auditório: e-mail e recursos",
    route: "/calendario",
    modal: true,
    category: "AUDITORIUM",
    callouts: [
      {
        target: "aud-email",
        title: "E-mail",
        text: "E-mail para contato sobre o evento. Só o auditório pede.",
        side: "left",
      },
      {
        target: "aud-recursos",
        title: "Telão, som e coffee break",
        text: "Informe o que o evento precisa. Se marcar Sim no coffee break, abre um formulário com mais alguns campos.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-auditorio-cafe",
    title: "Auditório: coffee break",
    route: "/calendario",
    modal: true,
    category: "AUDITORIUM",
    coffeeForm: true,
    callouts: [
      {
        target: "aud-cafe-horarios",
        title: "Montagem e servir",
        text: "A montagem vai da abertura até 30 min antes do fim da reserva. O café é servido pelo menos 10 min depois da montagem e até o fim.",
        side: "right",
      },
      {
        target: "aud-cafe-motivo",
        title: "Motivo do coffee break",
        text: "Explique por que o evento precisa do coffee break. É obrigatório.",
        side: "left",
      },
    ],
  },
  {
    id: "reserva-frota",
    title: "Veículos da frota",
    route: "/calendario",
    modal: true,
    category: "FLEET_VEHICLE",
    callouts: [
      {
        target: "tipo-FLEET_VEHICLE",
        title: "Frota",
        text: "Carro ou VAN oficial para deslocamentos a trabalho.",
        side: "left",
      },
      {
        target: "frota-saida",
        title: "Horário de saída",
        text: "Na frota só existe horário de saída. A volta é informada mais abaixo.",
        side: "right",
      },
      {
        target: "frota-motivo",
        title: "Motivo",
        text: "Por que você precisa do veículo.",
        side: "left",
      },
      {
        target: "frota-end-saida",
        title: "Endereço de saída",
        text: "De onde o veículo parte.",
        side: "right",
      },
    ],
  },
  {
    id: "reserva-frota-trajeto",
    title: "Frota: trajeto",
    route: "/calendario",
    modal: true,
    category: "FLEET_VEHICLE",
    callouts: [
      {
        target: "frota-fora-municipio",
        title: "Fora do município?",
        text: "Se o destino fica fora do município, marque Sim e explique o motivo.",
        side: "left",
      },
      {
        target: "frota-end-destino",
        title: "Endereço de destino",
        text: "Para onde o veículo vai.",
        side: "right",
      },
      {
        target: "frota-retorno",
        title: "Retorno",
        text: "Se precisar de volta, marque Sim e informe o horário e os endereços do retorno.",
        side: "left",
      },
    ],
  },
  {
    id: "reserva-frota-veiculo",
    title: "Frota: veículo e telefone",
    route: "/calendario",
    modal: true,
    category: "FLEET_VEHICLE",
    callouts: [
      {
        target: "frota-van",
        title: "Carro ou VAN",
        text: "O carro leva até 4 passageiros; a VAN, até 15, com justificativa. Depois aparece o campo de passageiros.",
        side: "right",
      },
      {
        target: "frota-telefone",
        title: "Telefone",
        text: "Um telefone extra, opcional, além do contato.",
        side: "left",
      },
    ],
  },
  {
    id: "reserva-confirmar",
    title: "Criar a reserva",
    route: "/calendario",
    modal: true,
    category: "FLEET_VEHICLE",
    callouts: [
      {
        target: "form-confirmar",
        title: "Criar reserva",
        text: "Depois de preencher o formulário, é só clicar aqui para criar a reserva. No tutorial, o botão fica bloqueado.",
        side: "top",
        pointer: true,
      },
    ],
  },
];

export function stepsFor(breakpoint: Breakpoint): TutorialStep[] {
  const list: TutorialStep[] = [];
  for (const step of TUTORIAL_STEPS) {
    if (step.breakpoints && !step.breakpoints.includes(breakpoint)) continue;
    list.push(step);
  }
  return list;
}
