// The atlas and "Gdzie boli?" are tabs of Doco, the app at the site's root. Opened on their own
// (a bookmark, an old home-screen icon, a shared link) they'd have no tab bar and, installed on an
// iPhone, no way back, so they hand over to Doco on their tab. ?solo keeps them on their own.

/** True when this page should render here; false when it is already on its way to Doco. */
export function stayOrOpenInSoleil(tab: 'cialo' | 'objawy'): boolean {
  // In Doco's frame, the frame's bottom edge runs under the tab bar's slanted top (CSS: .in-doco).
  if (window.top !== window.self) document.documentElement.classList.add('in-doco')
  if (!import.meta.env.PROD || window.top !== window.self) return true
  if (new URLSearchParams(location.search).has('solo')) return true
  location.replace(new URL(`../#${tab}`, location.href))
  return false
}

/**
 * Starts Doco's voice call, the same as the phone button in Rozmowa. In Doco's frame it opens in the app
 * around us, over this tab; a plain link would load a second Doco, tab bar and all, inside the frame.
 * False when there's no Doco around (opened on its own), so the caller can go there instead.
 */
export function callDoco(): boolean {
  try {
    const doco = window.parent as Window & { openVoiceCall?: () => void }
    if (doco === window || typeof doco.openVoiceCall !== 'function') return false
    doco.openVoiceCall()
    return true
  } catch {
    return false
  }
}
