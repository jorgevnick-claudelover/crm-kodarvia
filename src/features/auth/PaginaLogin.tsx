import { type FormEvent, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { Cargando } from "@/components/comunes/Cargando"
import { useSesion } from "@/hooks/useSesion"
import { supabase } from "@/lib/supabase"

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) return "Correo o contraseña incorrectos."
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Pide al administrador que lo active."
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera un minuto y vuelve a probar."
  if (m.includes("failed to fetch") || m.includes("network")) return "Sin conexión. Revisa tu internet e inténtalo de nuevo."
  if (m.includes("user not found")) return "No existe una cuenta con ese correo."
  return `No se pudo iniciar sesión: ${mensaje}`
}

interface EstadoDesde {
  desde?: string
}

/** Inicio de sesión con correo y contraseña. */
export function PaginaLogin() {
  const { sesion, cargando } = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [recuperando, setRecuperando] = useState(false)

  if (cargando) return <Cargando tipo="pantalla" className="min-h-dvh" />
  if (sesion) {
    const desde = (location.state as EstadoDesde | null)?.desde
    return <Navigate to={desde && desde !== "/login" ? desde : "/"} replace />
  }

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const correo = email.trim().toLowerCase()
    if (!correo || !contrasena) {
      setError("Escribe tu correo y tu contraseña.")
      return
    }
    setEnviando(true)
    try {
      const { error: errorAuth } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
      if (errorAuth) {
        setError(traducirError(errorAuth.message))
        return
      }
      const desde = (location.state as EstadoDesde | null)?.desde
      navigate(desde && desde !== "/login" ? desde : "/", { replace: true })
    } catch (ex) {
      setError(traducirError(ex instanceof Error ? ex.message : String(ex)))
    } finally {
      setEnviando(false)
    }
  }

  const recuperar = async () => {
    const correo = email.trim().toLowerCase()
    if (!correo) {
      setError("Escribe tu correo arriba y vuelve a pulsar «Olvidé mi contraseña».")
      return
    }
    setRecuperando(true)
    setError(null)
    try {
      const { error: errorReset } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (errorReset) setError(traducirError(errorReset.message))
      else toast.success("Te enviamos un correo para cambiar la contraseña. Revisa tu bandeja.")
    } finally {
      setRecuperando(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" alt="CRM" width={160} height={46} className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Ingresa al CRM</h1>
            <p className="text-sm text-muted-foreground">Estudio contable · Arequipa</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => void entrar(e)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              enterKeyHint="next"
              className="h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrasena">Contraseña</Label>
            <Input
              id="contrasena"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              className="h-12"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={enviando}>
            {enviando && <Loader2 className="animate-spin" />}
            Entrar
          </Button>

          <button
            type="button"
            className="w-full py-2 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            disabled={recuperando}
            onClick={() => void recuperar()}
          >
            {recuperando ? "Enviando…" : "Olvidé mi contraseña"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          ¿Sin cuenta? Pídele al administrador que te cree una.
        </p>
      </div>
      <Toaster />
    </main>
  )
}

export default PaginaLogin
