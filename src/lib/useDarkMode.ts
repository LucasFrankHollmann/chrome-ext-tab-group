import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

/**
 * Tema em uso pela UI. Serve para escolher a cor de grupo igual a que o Chrome
 * desenha na barra de abas (ver `GROUP_COLOR_HEX`).
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const handler = (event: MediaQueryListEvent) => setDark(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  return dark
}
