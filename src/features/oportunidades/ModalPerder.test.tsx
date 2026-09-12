/**
 * Prueba de componente sin @testing-library (no está instalada): se monta el
 * formulario de pérdida con react-dom en jsdom y se interactúa con el DOM.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MotivoPerdida } from "@/lib/types"
import { FormularioPerder } from "./ModalPerder"

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const motivos: MotivoPerdida[] = [
  { id: "m1", nombre: "Precio", orden: 1, activo: true, created_at: "", updated_at: "" },
  { id: "m2", nombre: "Se fue con otro estudio", orden: 2, activo: true, created_at: "", updated_at: "" },
]

let contenedor: HTMLDivElement
let root: Root

function botonConfirmar(): HTMLButtonElement {
  const boton = [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.includes("Confirmar pérdida"))
  if (!boton) throw new Error("No se encontró el botón Confirmar")
  return boton
}

function chip(nombre: string): HTMLButtonElement {
  const boton = [...contenedor.querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre)
  if (!boton) throw new Error(`No se encontró el chip ${nombre}`)
  return boton
}

describe("ModalPerder: el motivo es obligatorio (criterio 3)", () => {
  beforeEach(() => {
    contenedor = document.createElement("div")
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
  })
  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  it("Confirmar está deshabilitado sin motivo y no llama a onConfirmar", () => {
    const onConfirmar = vi.fn()
    act(() => {
      root.render(<FormularioPerder motivos={motivos} onConfirmar={onConfirmar} onCancelar={() => {}} />)
    })
    const confirmar = botonConfirmar()
    expect(confirmar.disabled).toBe(true)
    expect(contenedor.textContent).toContain("Elige un motivo para poder confirmar.")

    // Ni pulsando el botón ni enviando el formulario se confirma sin motivo.
    act(() => {
      confirmar.click()
      contenedor.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it("con motivo elegido se habilita y confirma con motivo y detalle", () => {
    const onConfirmar = vi.fn()
    act(() => {
      root.render(<FormularioPerder motivos={motivos} onConfirmar={onConfirmar} onCancelar={() => {}} />)
    })
    act(() => {
      chip("Precio").click()
    })
    const confirmar = botonConfirmar()
    expect(confirmar.disabled).toBe(false)
    expect(chip("Precio").getAttribute("aria-pressed")).toBe("true")

    act(() => {
      confirmar.click()
    })
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith("m1", "")
  })

  it("Cancelar no confirma nada", () => {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    act(() => {
      root.render(<FormularioPerder motivos={motivos} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    })
    act(() => {
      chip("Cancelar").click()
    })
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it("sin motivos configurados avisa y no deja confirmar", () => {
    act(() => {
      root.render(<FormularioPerder motivos={[]} onConfirmar={() => {}} onCancelar={() => {}} />)
    })
    expect(contenedor.textContent).toContain("No hay motivos de pérdida configurados")
    expect(botonConfirmar().disabled).toBe(true)
  })
})
