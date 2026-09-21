/**
 * Usuarios del estudio: nombre, correo, rol y activo. Los cinco vienen con nombres de
 * ejemplo y el administrador los renombra aquí para poner a su equipo real. Sin backend
 * no se dan de alta usuarios nuevos: se reaprovechan estas cinco fichas.
 * El administrador actual no puede quitarse el rol a sí mismo.
 */
import { toast } from "sonner"
import { Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import type { RolUsuario, Usuario } from "@/lib/types"
import { useMutacionesUsuarios } from "./useConfiguracionPagina"

const ETIQUETA_ROL: Record<RolUsuario, string> = { admin: "Administrador", miembro: "Miembro" }
const AVISO_PROPIO = "No puedes cambiarte el rol ni desactivarte a ti mismo: pídeselo a otro administrador."

export function PestanaUsuarios() {
  const { usuariosTodos, cargando } = useCatalogos()
  const { uid } = useUsuarioActual()
  const { cambiarRol, cambiarActivo, cambiarNombre, cambiarEmail, guardando } = useMutacionesUsuarios()
  const esMovil = useEsMovil()

  const alCambiarRol = (usuario: Usuario, rol: RolUsuario) => {
    if (rol === usuario.rol) return
    if (usuario.id === uid) {
      toast.error(AVISO_PROPIO)
      return
    }
    void cambiarRol(usuario.id, rol)
  }

  /** Guarda al salir del campo o con Enter; si queda vacío se revierte al valor anterior. */
  const campoTexto = (usuario: Usuario, campo: "nombre" | "email") => {
    const valor = campo === "nombre" ? usuario.nombre : usuario.email
    const guardarCampo = (nuevo: string, elemento: HTMLInputElement) => {
      const limpio = nuevo.trim()
      if (limpio === valor) return
      if (!limpio) {
        elemento.value = valor
        toast.error(campo === "nombre" ? "El nombre no puede quedar vacío." : "El correo no puede quedar vacío.")
        return
      }
      void (campo === "nombre" ? cambiarNombre(usuario.id, limpio) : cambiarEmail(usuario.id, limpio))
    }
    return (
      <Input
        defaultValue={valor}
        key={`${usuario.id}-${campo}-${valor}`}
        disabled={guardando}
        aria-label={`${campo === "nombre" ? "Nombre" : "Correo"} de ${usuario.nombre}`}
        type={campo === "email" ? "email" : "text"}
        className="h-11 text-base"
        onBlur={(e) => guardarCampo(e.target.value, e.target)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") e.currentTarget.value = valor
        }}
      />
    )
  }

  const alCambiarActivo = (usuario: Usuario, activo: boolean) => {
    if (usuario.id === uid) {
      toast.error(AVISO_PROPIO)
      return
    }
    void cambiarActivo(usuario.id, activo)
  }

  const ayuda = (
    <div className="flex gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p>
          Esta versión no tiene contraseñas: al abrir el CRM se elige con quién trabajar entre las personas de esta lista, que
          vienen con los datos de ejemplo de este navegador.
        </p>
        <p>Pon aquí los nombres y correos reales de tu equipo: escribe encima y se guarda al salir del campo. El encargo cubre hasta 5 personas. Para dejar de dar acceso a alguien, desactívalo aquí; así se conserva su historial.</p>
      </div>
    </div>
  )

  if (cargando) {
    return (
      <section className="space-y-4" aria-label="Usuarios">
        {ayuda}
        <Cargando filas={3} />
      </section>
    )
  }

  if (usuariosTodos.length === 0) {
    return (
      <section className="space-y-4" aria-label="Usuarios">
        {ayuda}
        <Vacio
          titulo="Todavía no hay usuarios"
          descripcion="Vuelve a crear los datos de ejemplo desde la pestaña Datos y las cinco personas del estudio reaparecerán aquí."
        />
      </section>
    )
  }

  const selectorRol = (usuario: Usuario) => (
    <Select
      items={ETIQUETA_ROL}
      value={usuario.rol}
      disabled={guardando || usuario.id === uid}
      onValueChange={(valor: string | null) => {
        if (valor) alCambiarRol(usuario, valor as RolUsuario)
      }}
    >
      <SelectTrigger className="h-11 w-full min-w-40 text-base" aria-label={`Rol de ${usuario.nombre}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Administrador</SelectItem>
        <SelectItem value="miembro">Miembro</SelectItem>
      </SelectContent>
    </Select>
  )

  const interruptorActivo = (usuario: Usuario) => (
    <div className="flex min-h-11 items-center gap-2">
      <Switch
        id={`usuario-activo-${usuario.id}`}
        checked={usuario.activo}
        disabled={guardando || usuario.id === uid}
        onCheckedChange={(valor: boolean) => alCambiarActivo(usuario, valor)}
      />
      <Label htmlFor={`usuario-activo-${usuario.id}`} className="text-base">
        Activo
      </Label>
    </div>
  )

  return (
    <section className="space-y-4" aria-label="Usuarios">
      {ayuda}

      {esMovil ? (
        <ul className="space-y-3">
          {usuariosTodos.map((u) => (
            <li key={u.id} className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <AvatarUsuario nombre={u.nombre} id={u.id} />
                <p className="truncate font-medium">
                  {u.nombre}
                  {u.id === uid && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Nombre</Label>
                {campoTexto(u, "nombre")}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Correo</Label>
                {campoTexto(u, "email")}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Rol</Label>
                {selectorRol(u)}
              </div>
              {interruptorActivo(u)}
              {u.id === uid && <p className="text-sm text-muted-foreground">{AVISO_PROPIO}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosTodos.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AvatarUsuario nombre={u.nombre} id={u.id} tamano="sm" />
                      <div className="min-w-44 flex-1">{campoTexto(u, "nombre")}</div>
                      {u.id === uid && <span className="text-xs text-muted-foreground">(tú)</span>}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-52">{campoTexto(u, "email")}</TableCell>
                  <TableCell>{selectorRol(u)}</TableCell>
                  <TableCell>{interruptorActivo(u)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        El administrador ve y edita todo; el miembro edita solo lo suyo, aunque todos ven todo.
      </p>
    </section>
  )
}

export default PestanaUsuarios
