import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true cuando .env.local trae VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con pinta de válidos. */
export const supabaseConfigurado: boolean =
  typeof url === "string" &&
  /^https?:\/\//.test(url) &&
  typeof anonKey === "string" &&
  anonKey.length > 20 &&
  !url.includes("xxxxxxxxxxxx")

/**
 * Cliente de Supabase. Si faltan variables no lanzamos al importar: se crea un
 * cliente apuntando a una URL local inexistente y la app muestra PantallaSinSupabase.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseConfigurado ? (url as string) : "http://localhost:54321",
  supabaseConfigurado ? (anonKey as string) : "sin-configurar",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "crm.sesion",
    },
    realtime: { params: { eventsPerSecond: 5 } },
  },
)

export type Supabase = typeof supabase
