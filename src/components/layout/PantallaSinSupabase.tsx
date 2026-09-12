import { Database } from "lucide-react"

/** Se muestra cuando faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY (sin romper la app). */
export function PantallaSinSupabase() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Database className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Falta configurar Supabase</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          La app no encuentra las variables de conexión. Crea un archivo <code className="rounded bg-muted px-1">.env.local</code> en
          la raíz del proyecto (copiando <code className="rounded bg-muted px-1">.env.example</code>) con:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {"VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ..."}
        </pre>
        <p className="text-sm text-muted-foreground">
          Los valores están en Supabase, en <strong>Project Settings › API</strong>. En Cloudflare Pages se configuran como variables de
          entorno del proyecto. Después reinicia <code className="rounded bg-muted px-1">npm run dev</code> o vuelve a desplegar.
        </p>
      </div>
    </main>
  )
}

export default PantallaSinSupabase
