import { Image } from 'expo-image';

// Member photos are cached on the phone by expo-image (memory and disk). Clear both on
// sign-out, block and account hold, so a cached card or photo cannot outlive the access that
// allowed it (FT-007; Frontend Specification 8.3 Images; Security & Access edge case N17).
// To be called by the sign-out, block and hold flows when they are built.
export async function clearPhotoCache(): Promise<void> {
  const [memory, disk] = await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
  if (!memory || !disk) throw new Error('Photo cache could not be cleared');
}
