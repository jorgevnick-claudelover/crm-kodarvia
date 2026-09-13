/**
 * Estado del asistente de importación (4 pasos) y datos que necesita cada uno.
 * La lógica pura vive en mapeo.ts y la escritura en ejecutar.ts; aquí solo se
 * guarda lo que el usuario va eligiendo y se derivan columnas, filas y plan.
 */
import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import * as apiImportaciones from "@/lib/api/importaciones"
import type { Contacto } from "@/lib/types"
import { leerArchivo } from "./leerArchivo"
import {
  type CampoDestino,
  type CatalogosImportacion,
  type ColumnaHoja,
  type ContactoExistente,
  type Equivalencia,
  type Equivalencias,
  type FilaNormalizada,
  type HojaLeida,
  type Mapeo,
  type PlanImportacion,
  type TipoCatalogo,
  type ValorCatalogo,
  camposRepetidos,
  columnasDeHoja,
  detectarFilaCabecera,
  esFilaVacia,
  normalizarFilas,
  planificarImportacion,
  sugerirEquivalencias,
  sugerirMapeo,
  valoresDeCatalogos,
} from "./mapeo"
import { type ProgresoImportacion, type ResultadoEjecucion, ejecutarImportacion } from "./ejecutar"

export type PasoImportacion = 1 | 2 | 3 | 4

export const PASOS: { numero: PasoImportacion; titulo: string }[] = [
  { numero: 1, titulo: "Archivo" },
  { numero: 2, titulo: "Mapeo" },
  { numero: 3, titulo: "Revisar" },
  { numero: 4, titulo: "Importar" },
]

const SIN_VALORES: Record<TipoCatalogo, ValorCatalogo[]> = { origenes: [], etapas: [], responsables: [] }

export interface Importacion4Pasos {
  paso: PasoImportacion
  irAPaso: (paso: PasoImportacion) => void
  siguiente: () => void
  atras: () => void

  // Paso 1
  nombreArchivo: string
  hojas: HojaLeida[]
  hojaIndice: number
  hoja: HojaLeida | null
  elegirHoja: (indice: number) => void
  indiceCabecera: number
  cambiarCabecera: (indice: number) => void
  cargandoArchivo: boolean
  errorArchivo: string | null
  elegirArchivo: (archivo: File) => Promise<void>
  reiniciar: () => void

  // Paso 2
  columnas: ColumnaHoja[]
  mapeo: Mapeo
  cambiarMapeo: (indiceColumna: number, campo: CampoDestino) => void
  repetidos: CampoDestino[]
  valores: Record<TipoCatalogo, ValorCatalogo[]>
  equivalencias: Equivalencias
  cambiarEquivalencia: (tipo: TipoCatalogo, clave: string, equivalencia: Equivalencia) => void
  catalogos: CatalogosImportacion
  catalogosListos: boolean
  /** Nombre del administrador (a quien se asignan los responsables desconocidos). */
  nombreAdministrador: string

  // Paso 3
  filas: FilaNormalizada[]
  plan: PlanImportacion | null
  cargandoExistentes: boolean
  errorExistentes: Error | null

  // Paso 4
  importar: () => void
  importando: boolean
  progreso: ProgresoImportacion | null
  resultado: ResultadoEjecucion | null
  errorImportar: string | null
}

/** Todo el estado del asistente. Un solo hook para que los cuatro pasos compartan datos. */
export function useImportacion(): Importacion4Pasos {
  const queryClient = useQueryClient()
  const { usuario, uid } = useUsuarioActual()
  const { etapas, origenes, motivos, usuarios } = useCatalogos()
  const { configuracion } = useConfiguracion()

  const [paso, setPaso] = useState<PasoImportacion>(1)
  const [nombreArchivo, setNombreArchivo] = useState("")
  const [hojas, setHojas] = useState<HojaLeida[]>([])
  const [hojaIndice, setHojaIndice] = useState(0)
  const [cabeceraManual, setCabeceraManual] = useState<number | null>(null)
  const [mapeoManual, setMapeoManual] = useState<Mapeo | null>(null)
  const [equivalenciasManual, setEquivalenciasManual] = useState<Equivalencias | null>(null)
  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<ProgresoImportacion | null>(null)
  const [resultado, setResultado] = useState<ResultadoEjecucion | null>(null)
  const [escribiendo, setEscribiendo] = useState(false)

  const hoja = hojas[hojaIndice] ?? null

  const indiceCabecera = useMemo(
    () => cabeceraManual ?? (hoja ? detectarFilaCabecera(hoja.filas) : 0),
    [cabeceraManual, hoja],
  )

  const columnas = useMemo(() => (hoja ? columnasDeHoja(hoja.filas, indiceCabecera) : []), [hoja, indiceCabecera])

  const mapeo = useMemo(() => mapeoManual ?? sugerirMapeo(columnas), [mapeoManual, columnas])

  const filas = useMemo(
    () => (hoja ? normalizarFilas(hoja.filas, indiceCabecera, mapeo, columnas) : []),
    [hoja, indiceCabecera, mapeo, columnas],
  )

  const catalogos = useMemo<CatalogosImportacion>(
    () => ({
      etapas: etapas.map((e) => ({ id: e.id, nombre: e.nombre })),
      origenes: origenes.map((o) => ({ id: o.id, nombre: o.nombre })),
      usuarios: usuarios.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })),
      motivos: motivos.map((m) => ({ id: m.id, nombre: m.nombre })),
      adminId: uid ?? "",
    }),
    [etapas, origenes, usuarios, motivos, uid],
  )
  const catalogosListos = etapas.length > 0 && !!uid

  const valores = useMemo(
    () => (filas.length > 0 ? valoresDeCatalogos(filas, catalogos) : SIN_VALORES),
    [filas, catalogos],
  )

  const equivalencias = useMemo(
    () => equivalenciasManual ?? sugerirEquivalencias(valores, catalogos),
    [equivalenciasManual, valores, catalogos],
  )

  // Contactos que ya están en el CRM: una sola lectura, al llegar a la previsualización.
  // Se congela mientras se escribe (y cuando ya hay resultado): cada lote insertado
  // dispara realtime, que invalida ["contactos"] y volvería a bajar la tabla entera en
  // mitad de la importación. Deshabilitada, la consulta sigue sirviendo lo cacheado.
  const consultaExistentes = useQuery({
    queryKey: ["contactos", "importar", "existentes"],
    queryFn: () => apiContactos.listarTodo({}),
    enabled: paso >= 3 && hojas.length > 0 && !escribiendo && resultado === null,
    staleTime: 5 * 60 * 1000,
  })
  const existentes = useMemo<Contacto[]>(() => consultaExistentes.data ?? [], [consultaExistentes.data])
  const existentesLigeros = useMemo<ContactoExistente[]>(
    () =>
      existentes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email,
        doc_numero: c.doc_numero,
      })),
    [existentes],
  )

  const plan = useMemo<PlanImportacion | null>(() => {
    if (filas.length === 0 || !catalogosListos) return null
    return planificarImportacion(filas, {
      mapeo,
      equivalencias,
      catalogos,
      existentes: existentesLigeros,
      tituloDefault: configuracion.titulo_oportunidad_default,
      importeDefault: configuracion.importe_default,
    })
  }, [filas, mapeo, equivalencias, catalogos, catalogosListos, existentesLigeros, configuracion])

  const reiniciar = useCallback(() => {
    setPaso(1)
    setNombreArchivo("")
    setHojas([])
    setHojaIndice(0)
    setCabeceraManual(null)
    setMapeoManual(null)
    setEquivalenciasManual(null)
    setErrorArchivo(null)
    setProgreso(null)
    setResultado(null)
  }, [])

  const elegirArchivo = useCallback(async (archivo: File) => {
    setCargandoArchivo(true)
    setErrorArchivo(null)
    try {
      const leidas = await leerArchivo(archivo)
      const conDatos = leidas.filter((h) => h.filas.some((f) => !esFilaVacia(f)))
      const utiles = conDatos.length > 0 ? conDatos : leidas
      // La hoja con más filas suele ser la de los contactos (y no la de notas sueltas).
      let mejor = 0
      utiles.forEach((h, i) => {
        if (h.filas.length > utiles[mejor].filas.length) mejor = i
      })
      setHojas(utiles)
      setHojaIndice(mejor)
      setNombreArchivo(archivo.name)
      setCabeceraManual(null)
      setMapeoManual(null)
      setEquivalenciasManual(null)
      setResultado(null)
      setProgreso(null)
      setPaso(2)
    } catch (e) {
      setHojas([])
      setNombreArchivo("")
      setErrorArchivo(e instanceof Error ? e.message : "No se pudo leer el archivo.")
    } finally {
      setCargandoArchivo(false)
    }
  }, [])

  const elegirHoja = useCallback((indice: number) => {
    setHojaIndice(indice)
    setCabeceraManual(null)
    setMapeoManual(null)
    setEquivalenciasManual(null)
  }, [])

  const cambiarCabecera = useCallback((indice: number) => {
    setCabeceraManual(indice)
    setMapeoManual(null)
    setEquivalenciasManual(null)
  }, [])

  const cambiarMapeo = useCallback(
    (indiceColumna: number, campo: CampoDestino) => {
      setMapeoManual({ ...mapeo, [indiceColumna]: campo })
      setEquivalenciasManual(null)
    },
    [mapeo],
  )

  const cambiarEquivalencia = useCallback(
    (tipo: TipoCatalogo, clave: string, equivalencia: Equivalencia) => {
      setEquivalenciasManual({ ...equivalencias, [tipo]: { ...equivalencias[tipo], [clave]: equivalencia } })
    },
    [equivalencias],
  )

  const mutacion = useMutation({
    onMutate: () => setEscribiendo(true),
    onSettled: () => setEscribiendo(false),
    mutationFn: async () => {
      if (!plan || !hoja) throw new Error("Todavía no hay nada que importar.")
      if (!uid) throw new Error("No se pudo identificar al usuario.")
      return ejecutarImportacion({
        archivo: nombreArchivo,
        hoja: hoja.nombre,
        columnas,
        mapeo,
        plan,
        equivalencias,
        valores,
        catalogos,
        existentes,
        onProgreso: setProgreso,
      })
    },
    onSuccess: (r) => {
      setResultado(r)
      toast.success(`Importación terminada: ${r.recuento.noVacias} filas, ninguna descartada.`)
      queryClient.invalidateQueries({ queryKey: ["contactos"] })
      queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
      queryClient.invalidateQueries({ queryKey: ["importaciones"] })
      queryClient.invalidateQueries({ queryKey: ["origenes"] })
      queryClient.invalidateQueries({ queryKey: ["etapas"] })
    },
    onError: (e: Error) => {
      toast.error(e.message || "No se pudo completar la importación.")
    },
  })

  const irAPaso = useCallback(
    (destino: PasoImportacion) => {
      if (destino > 1 && hojas.length === 0) return
      setPaso(destino)
    },
    [hojas.length],
  )

  return {
    paso,
    irAPaso,
    siguiente: () => setPaso((p) => (p < 4 ? ((p + 1) as PasoImportacion) : p)),
    atras: () => setPaso((p) => (p > 1 ? ((p - 1) as PasoImportacion) : p)),

    nombreArchivo,
    hojas,
    hojaIndice,
    hoja,
    elegirHoja,
    indiceCabecera,
    cambiarCabecera,
    cargandoArchivo,
    errorArchivo,
    elegirArchivo,
    reiniciar,

    columnas,
    mapeo,
    cambiarMapeo,
    repetidos: camposRepetidos(mapeo),
    valores,
    equivalencias,
    cambiarEquivalencia,
    catalogos,
    catalogosListos,
    nombreAdministrador: usuario?.nombre ?? "el administrador",

    filas,
    plan,
    cargandoExistentes: consultaExistentes.isPending && paso >= 3,
    errorExistentes: consultaExistentes.error,

    importar: () => mutacion.mutate(),
    importando: mutacion.isPending,
    progreso,
    resultado,
    errorImportar: mutacion.error ? mutacion.error.message : null,
  }
}

/** Importaciones anteriores, para la lista del paso 4 (clave ['importaciones']). */
export function useImportaciones() {
  return useQuery({
    queryKey: ["importaciones"],
    queryFn: apiImportaciones.listar,
    staleTime: 60_000,
  })
}

/** Deshacer: borra los contactos (y en cascada sus oportunidades) de esa importación. */
export function useDeshacerImportacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiImportaciones.deshacer(id),
    onSuccess: (borrados) => {
      toast.success(`Importación deshecha: ${borrados} ${borrados === 1 ? "contacto borrado" : "contactos borrados"}.`)
      queryClient.invalidateQueries({ queryKey: ["contactos"] })
      queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
      queryClient.invalidateQueries({ queryKey: ["importaciones"] })
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo deshacer la importación."),
  })
}

export type { ProgresoImportacion, ResultadoEjecucion }
