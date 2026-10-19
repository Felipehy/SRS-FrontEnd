/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** URL de logout do Cognito (Hosted UI /logout). Opcional; sem ela, o logout só recarrega. */
  readonly VITE_COGNITO_LOGOUT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
