export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'] as const;

export const FORMAT_OPTIONS = ['same', 'jpg', 'png', 'webp'] as const;

export const FORMAT_LABELS = {
  jpg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
} as const;

export const TARGET_SIZE_PRESETS = ['100KB', '250KB', '500KB', '1MB', '2MB', '5MB', '10MB'] as const;

export const IMGBYTESIZER_INSTALL_URL = 'https://github.com/pyyupsk/imgbytesizer#installation';
