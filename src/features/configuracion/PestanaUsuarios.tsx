/**
 * Usuarios del estudio: nombre, correo, rol y activo. El alta se hace fuera de la app
 * (script o panel de Supabase). El administrador actual no puede quitarse el rol a sí mismo.
 */
import { toast } from "sonner"
import { Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  const { cambiarRol, cambiarActivo, guardando } = useMutacionesUsuarios()
  const esMovil = useEsMovil()

  const alCambiarRol = (usuario: Usuario, rol: RolUsuario) => {
    if (rol === usuario.rol) return
    if (usuario.id === uid) {
      toast.error(AVISO_PROPIO)
      return
    }
    void cambiarRol(usuario.id, rol)
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
          Los usuarios nuevos no se crean desde aquí: se crean con el script{" "}
          <code className="rounded bg-background px-1 py-0.5 text-xs">scripts/crear-usuarios.mjs</code> o desde el panel de Supabase
          (Authentication → Users). Al entrar por primera vez, su perfil aparece en esta lista.
        </p>
        <p>El encargo cubre hasta 5 personas. Para dejar de dar acceso a alguien, desactívalo aquí; así se conserva su historial.</p>
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
        <Vacio titulo="Todavía no hay usuarios" descripcion="Créalos con el script o en el panel de Supabase y vuelve a esta pantalla." />
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
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.nombre}
                    {u.id === uid && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                </div>
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
                      <span className="font-medium">{u.nombre}</span>
                      {u.id === uid && <span className="text-xs text-muted-foreground">(tú)</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
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
