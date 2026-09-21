import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { aplicarMonedaGuardada } from "@/lib/api/configuracion"

// La moneda elegida en Configuración vale para toda la interfaz; se fija antes de pintar.
aplicarMonedaGuardada()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
