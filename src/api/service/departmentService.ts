import { api } from "../lib/api";

export const DEPARTMENT_ENDPOINT = "/department";

export const DEPARTMENT_NAME_MAX = 50;

export interface Department {
  id: number;
  name: string;
  room: string;
  idRoom: number;
}

export interface DepartmentPayload {
  name: string;
  idRoom: number;
}

function parseDepartment(raw: any): Department {
  let name = "";
  if (typeof raw?.name === "string") {
    name = raw.name;
  }
  let room = "";
  if (typeof raw?.room === "string") {
    room = raw.room;
  }
  return {
    id: raw?.id,
    name,
    room,
    idRoom: raw?.idRoom,
  };
}

function toRequest(payload: DepartmentPayload) {
  return {
    name: payload.name.trim(),
    idRoom: payload.idRoom,
  };
}

export const departmentService = {
  async listar(): Promise<Department[]> {
    const { data } = await api.get<any[]>(DEPARTMENT_ENDPOINT);
    if (!Array.isArray(data)) return [];
    return data.map(parseDepartment);
  },

  async buscarDoUsuario(userId: number): Promise<Department> {
    const { data } = await api.get(`${DEPARTMENT_ENDPOINT}/${userId}`);
    return parseDepartment(data);
  },

  async criar(payload: DepartmentPayload): Promise<void> {
    await api.post(DEPARTMENT_ENDPOINT, toRequest(payload));
  },

  async atualizar(id: number, payload: DepartmentPayload): Promise<void> {
    await api.patch(DEPARTMENT_ENDPOINT, toRequest(payload), { params: { id } });
  },

  async excluir(id: number): Promise<void> {
    await api.delete(DEPARTMENT_ENDPOINT, { params: { id } });
  },
};
