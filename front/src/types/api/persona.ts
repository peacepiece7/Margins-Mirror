export interface Persona {
  personaId: number;
  name: string;
  displayName: string;
  description?: string;
  tone?: string;
}

export interface PersonaListResponse {
  personas: Persona[];
}
