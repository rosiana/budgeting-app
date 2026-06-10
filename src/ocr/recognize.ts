import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ParsedReceipt } from '../types';
import { parseReceipt } from './parseReceipt';

/**
 * Run on-device text recognition (ML Kit on Android, falls back to the same
 * API surface on iOS) over a captured/selected image, then parse the result
 * into a structured receipt. Nothing leaves the device.
 *
 * @param imageUri local file uri, e.g. from expo-camera or expo-image-picker
 */
export async function recognizeReceipt(imageUri: string): Promise<ParsedReceipt> {
  const result = await TextRecognition.recognize(imageUri);
  const text = result?.text ?? '';
  return parseReceipt(text);
}
