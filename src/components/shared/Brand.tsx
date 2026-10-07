/** Fallback for settings rows created before branding existed. */
export const APP_NAME_FALLBACK = 'ShopLogic Pro';

/** The configured application name, or the default one when empty. */
export const appNameOf = (appName?: string) => (appName?.trim() || APP_NAME_FALLBACK);

/**
 * Store brand mark: the uploaded logo when there is one, the 📱 gradient tile
 * otherwise. Shared by the sidebar, the login screen and the settings preview,
 * so a logo change is visible everywhere at once.
 */
export function BrandMark({ logo, className, emojiClass = 'text-lg' }: { logo?: string; className: string; emojiClass?: string }) {
  return logo
    ? <img src={logo} alt="" draggable={false} className={`${className} bg-white/95 object-contain`} />
    : <div className={`${className} flex items-center justify-center bg-gradient-to-br from-primary to-fuchsia-500 text-white ${emojiClass}`}>📱</div>;
}
