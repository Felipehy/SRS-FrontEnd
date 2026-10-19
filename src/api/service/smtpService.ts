import { api } from "../lib/api";

export const SMTP_ENDPOINT = "/smtp";

export const smtpService = {
  async buscarStatus(): Promise<boolean> {
    const { data } = await api.get(SMTP_ENDPOINT);
    if (data === true || data === "true") return true;
    return false;
  },

  async definirStatus(active: boolean): Promise<void> {
    await api.post(SMTP_ENDPOINT, null, { params: { active } });
  },
};
