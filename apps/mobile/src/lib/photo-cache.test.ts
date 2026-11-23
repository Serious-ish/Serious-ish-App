import { Image } from 'expo-image';

import { clearPhotoCache } from './photo-cache';

jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(), clearDiskCache: jest.fn() },
}));

const memory = Image.clearMemoryCache as jest.Mock;
const disk = Image.clearDiskCache as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('clearPhotoCache', () => {
  it('clears both the memory and the disk photo caches', async () => {
    memory.mockResolvedValue(true);
    disk.mockResolvedValue(true);
    await clearPhotoCache();
    expect(memory).toHaveBeenCalledTimes(1);
    expect(disk).toHaveBeenCalledTimes(1);
  });

  it('fails loudly if either cache could not be cleared', async () => {
    memory.mockResolvedValue(true);
    disk.mockResolvedValue(false);
    await expect(clearPhotoCache()).rejects.toThrow('Photo cache could not be cleared');
  });
});
