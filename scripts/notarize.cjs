/**
 * electron-builder afterSign hook for macOS notarization.
 *
 * Signing itself is done by electron-builder when a Developer ID certificate is
 * available (CSC_LINK / CSC_KEY_PASSWORD or the login keychain). This hook only
 * notarizes, and is a no-op unless all Apple credentials are present, so local
 * and fork builds keep working without secrets.
 */
module.exports = async function notarizeMac(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Apple credentials not set; skipping notarization.');
    return;
  }
  const path = require('node:path');
  const { notarize } = await import('@electron/notarize');
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[notarize] submitting ${appPath}`);
  await notarize({
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
  console.log('[notarize] done');
};
