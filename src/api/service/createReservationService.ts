import { api } from "../lib/api";

export function createReservationService<TResponse, TCreate>(resource: string) {
  return {
    async listar(): Promise<TResponse[]> {
      const { data } = await api.get<TResponse[]>(resource);
      return data;
    },

    async listarPorMesEAno(month: number, year: number): Promise<TResponse[]> {
      const { data } = await api.get<TResponse[]>(resource, { params: { year, month } });
      return data;
    },

    async buscarPorId(id: number): Promise<TResponse> {
      const { data } = await api.get<TResponse>(`${resource}/${id}`);
      return data;
    },

    async criar(payload: TCreate): Promise<void> {
      await api.post(resource, payload);
    },

    async deletar(id: number): Promise<void> {
      await api.delete(`${resource}/${id}`);
    },

    async aprovar(id: number, userNameApprover: string): Promise<void> {
      await api.post(`${resource}/${id}/approve`, { userNameApprover });
    },

    async reprovar(id: number, reasonFailure: string, userNameApprover: string): Promise<void> {
      await api.post(`${resource}/${id}/reject`, { reasonFailure, userNameApprover });
    },

    async cancelar(id: number, reasonCancellation?: string): Promise<void> {
      const body = { id, reasonCancellation: reasonCancellation ?? null };
      await api.post(`${resource}/cancel`, body);
    },

    async aprovarCafe(id: number): Promise<void> {
      await api.post(`${resource}/approve-coffee`, null, { params: { id } });
    },

    async reprovarCafe(id: number, reasonRejectCoffee: string): Promise<void> {
      await api.post(`${resource}/reject-coffee`, { reasonRejectCoffee }, { params: { id } });
    },
  };
}
