import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory + 'tx-images/';

/**
 * Copy a picked/captured image into the app's document directory so it survives
 * cache eviction and app restarts. Returns the new persistent uri (or the
 * original uri if the copy fails).
 */
export async function persistImage(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    }
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
    const dest = `${DIR}${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}
