/**
 * Configuración del estudio (solo administrador): etapas, motivos de pérdida, orígenes,
 * usuarios, valores por defecto y los datos guardados en este navegador.
 * Pestañas en computadora; selector de sección en celular.
 */
import { useState } from "react"
import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { cn } from "@/lib/utils"
import { PestanaEtapas } from "./PestanaEtapas"
import { PestanaMotivos } from "./PestanaMotivos"
import { PestanaOrigenes } from "./PestanaOrigenes"
import { PestanaUsuarios } from "./PestanaUsuarios"
import { PestanaValores } from "./PestanaValores"
import { PestanaDatos } from "./PestanaDatos"

type Pestana = "etapas" | "motivos" | "origenes" | "usuarios" | "valores" | "datos"

const ETIQUETAS: Record<Pestana, string> = {
  etapas: "Etapas",
  motivos: "Motivos de pérdida",
  origenes: "Orígenes",
  usuarios: "Usuarios",
  valores: "Valores",
  datos: "Datos",
}

const ORDEN: Pestana[] = ["etapas", "motivos", "origenes", "usuarios", "valores", "datos"]

export function PaginaConfiguracion() {
  const { esAdmin, cargando } = useUsuarioActual()
  const esMovil = useEsMovil()
  const [pestana, setPestana] = useState<Pestana>("etapas")

  if (cargando) return <Cargando tipo="pantalla" />

  if (!esAdmin) {
    return (
      <Vacio
        icono={ShieldAlert}
        titulo="Solo para el administrador"
        descripcion="La configuración del CRM (etapas, motivos, orígenes, usuarios, valores por defecto y los datos guardados) la gestiona el administrador del estudio. Si necesitas un cambio aquí, pídeselo."
        accion={
          <Button render={<Link to="/" />} nativeButton={false} size="lg" className="min-h-11">
            Volver a Hoy
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Tabs value={pestana} onValueChange={(valor) => setPestana(String(valor) as Pestana)} className="gap-4">
        {esMovil && (
          <div className="space-y-1.5">
            <Select
              items={ETIQUETAS}
              value={pestana}
              onValueChange={(valor: string | null) => {
                if (valor) setPestana(valor as Pestana)
              }}
            >
              <SelectTrigger className="h-12 w-full text-base" aria-label="Sección de configuración">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDEN.map((p) => (
                  <SelectItem key={p} value={p}>
                    {ETIQUETAS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsList className={cn("h-auto w-full flex-wrap gap-1", esMovil && "hidden")}>
          {ORDEN.map((p) => (
            <TabsTrigger key={p} value={p} className="min-h-10 px-3">
              {ETIQUETAS[p]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="etapas">
          <PestanaEtapas />
        </TabsContent>
        <TabsContent value="motivos">
          <PestanaMotivos />
        </TabsContent>
        <TabsContent value="origenes">
          <PestanaOrigenes />
        </TabsContent>
        <TabsContent value="usuarios">
          <PestanaUsuarios />
        </TabsContent>
        <TabsContent value="valores">
          <PestanaValores />
        </TabsContent>
        <TabsContent value="datos">
          <PestanaDatos />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PaginaConfiguracion
