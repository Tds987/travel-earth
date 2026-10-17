/** Running as the installed home-screen app? */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const installSteps = () =>
  isIOS()
    ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
    : 'Open the browser menu and choose “Install app” or “Add to Home screen”.'
