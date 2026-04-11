import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('project-os:theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('project-os:theme', dark ? 'dark' : 'light')
  }, [dark])

  // Apply theme on mount (handles page reload)
  useEffect(() => {
    const saved = localStorage.getItem('project-os:theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return (
    <button
      className="theme-toggle"
      onClick={() => setDark(d => !d)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '○' : '●'}
    </button>
  )
}
