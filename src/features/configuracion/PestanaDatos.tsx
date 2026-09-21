/**
 * Datos de este navegador: cuánto ocupan, copia de seguridad (exportar/importar) y
 * borrar los datos de ejemplo para empezar de cero.
 *
 * Todo vive en la clave `crm.datos` de localStorage: no hay servidor donde respaldar,
 * así que la copia manual es la única red de seguridad y conviene decirlo sin adornos.
 */
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Download, RotateCcw, Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { exportarTodo, importarTodo, reiniciar, suscribirse, tamanoAproximado } from "@/lib/almacen"
import { formatearFechaHora } from "@/lib/utils/fechas"

function nombreCopia(): string {
  return `crm-copia-${formatearFechaHora(new Date().toISOString()).replace(/[/\s:]/g, "-")}.json`
}

function descargar(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/json;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function legible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PestanaDatos() {
  const queryClient = useQueryClient()
  const [tamano, setTamano] = useState(tamanoAproximado)
  const [confirmando, setConfirmando] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  useEffect(() => suscribirse(() => setTamano(tamanoAproximado())), [])

  const exportar = () => {
    try {
      descargar(nombreCopia(), exportarTodo())
      toast.success("Copia de seguridad descargada.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar la copia.")
    }
  }

  const importar = async (entrada: File) => {
    try {
      importarTodo(await entrada.text())
      await queryClient.invalidateQueries()
      toast.success("Copia restaurada. Los datos de este navegador son los del archivo.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar la copia.")
    }
  }

  const borrar = async () => {
    setConfirmando(false)
    try {
      reiniciar()
      await queryClient.invalidateQueries()
      toast.success("Listo: vuelven a estar los datos de ejemplo del inicio.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron borrar los datos.")
    }
  }

  return (
    <section className="space-y-4" aria-label="Datos de este navegador">
      <div className="flex gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>
            Todo el CRM se guarda en este navegador y en esta computadora o celular. No se sincroniza con otros equipos ni con
            ningún servidor: si borras los datos del navegador, se van.
          </p>
          <p>Descarga una copia de seguridad de vez en cuando; es un archivo que puedes volver a cargar aquí.</p>
        </div>
      </div>

      <p className="text-sm">
        Ocupan <strong>{legible(tamano.bytes)}</strong> de los 5 MB que permite el navegador ({tamano.porcentaje} %).
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" size="lg" className="min-h-11 gap-1.5" onClick={exportar}>
          <Download aria-hidden />
          Descargar copia
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 gap-1.5"
          onClick={() => archivo.current?.click()}
        >
          <Upload aria-hidden />
          Restaurar copia
        </Button>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Archivo de copia de seguridad"
          onChange={(e) => {
            const elegido = e.target.files?.[0]
            e.target.value = ""
            if (elegido) void importar(elegido)
          }}
        />
      </div>

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Borrar los datos de ejemplo</p>
        <p className="text-sm text-muted-foreground">
          Deja el CRM como recién instalado: se borra todo lo que hayas creado (contactos, oportunidades, tareas y actividades) y
          vuelven las etapas, los motivos, los orígenes y las cinco personas del estudio tal como venían.
        </p>
        {confirmando ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="destructive" size="lg" className="min-h-11" onClick={() => void borrar()}>
              Sí, borrar y empezar de cero
            </Button>
            <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 gap-1.5"
            onClick={() => setConfirmando(true)}
          >
            <RotateCcw aria-hidden />
            Borrar datos de ejemplo
          </Button>
        )}
      </div>
    </section>
  )
}

export default PestanaDatos
