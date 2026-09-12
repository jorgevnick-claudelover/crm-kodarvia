/** Paso 1: elegir el archivo, la pestaña y la fila de cabecera. */
import { useRef, useState, type DragEvent } from "react"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { cn } from "@/lib/utils"
import { EXTENSIONES_ACEPTADAS } from "./leerArchivo"
import { esFilaVacia, textoCelda } from "./mapeo"
import type { Importacion4Pasos } from "./useImportacion"

const FILAS_VISTA_PREVIA = 5

export function PasoArchivo({ estado }: { estado: Importacion4Pasos }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setEncima(false)
    const archivo = e.dataTransfer.files?.[0]
    if (archivo) void estado.elegirArchivo(archivo)
  }

  const hoja = estado.hoja
  const filasVista = hoja ? hoja.filas.slice(0, Math.max(estado.indiceCabecera + 1 + FILAS_VISTA_PREVIA, 6)) : []
  const anchoVista = filasVista.reduce((max, f) => Math.max(max, f.length), 0)

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          encima ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
          {estado.cargandoArchivo ? <Loader2 className="size-7 animate-spin" /> : <Upload className="size-7" aria-hidden />}
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">Arrastra aquí la hoja del cliente</p>
          <p className="text-sm text-muted-foreground">Excel (.xlsx, .xls) o CSV, hasta 15 MB. Nada se guarda hasta el último paso.</p>
        </div>
        <input
          ref={entrada}
          type="file"
          accept={EXTENSIONES_ACEPTADAS}
          className="sr-only"
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) void estado.elegirArchivo(archivo)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          size="lg"
          className="min-h-11 text-base"
          onClick={() => entrada.current?.click()}
          disabled={estado.cargandoArchivo}
        >
          Elegir archivo
        </Button>
      </div>

      {estado.errorArchivo && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {estado.errorArchivo}
        </p>
      )}

      {hoja && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="size-4" aria-hidden />
            <span className="font-medium text-foreground">{estado.nombreArchivo}</span>
          </p>

          {estado.hojas.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">El archivo tiene varias pestañas. ¿Cuál importamos?</p>
              <ChipsSeleccion
                etiqueta="Pestaña del archivo"
                valor={String(estado.hojaIndice)}
                onCambiar={(v) => v !== null && estado.elegirHoja(Number(v))}
                opciones={estado.hojas.map((h, i) => ({ valor: String(i), etiqueta: h.nombre }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Cabecera detectada en la fila {estado.indiceCabecera + 1}. Si no es esa, toca la fila correcta.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {filasVista.map((fila, i) => {
                    const esCabecera = i === estado.indiceCabecera
                    return (
                      <tr key={i} className={cn("border-b last:border-b-0", esCabecera && "bg-primary/10")}>
                        <th scope="row" className="sticky left-0 bg-background/95 px-1 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => estado.cambiarCabecera(i)}
                            aria-pressed={esCabecera}
                            className={cn(
                              "min-h-11 min-w-11 rounded-lg px-2 text-xs font-medium",
                              esCabecera ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {i + 1}
                          </button>
                        </th>
                        {Array.from({ length: anchoVista }).map((_, c) => (
                          <td
                            key={c}
                            className={cn(
                              "max-w-40 truncate px-2 py-2 whitespace-nowrap",
                              esCabecera ? "font-semibold" : "text-muted-foreground",
                            )}
                          >
                            {textoCelda(fila[c])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              {hoja.filas.slice(estado.indiceCabecera + 1).filter((f) => !esFilaVacia(f)).length} filas con datos por debajo de la cabecera.
            </p>
          </div>

          <Button type="button" size="lg" className="min-h-11 w-full text-base sm:w-auto" onClick={estado.siguiente}>
            Continuar al mapeo
          </Button>
        </div>
      )}
    </div>
  )
}

export default PasoArchivo
