import { mediaUrl } from './api';
import type { Artwork } from '../types';

/** The caption that travels with a shared work: title, artist, medium,
 *  dimensions, price — nothing else. */
const shareText = (a: Artwork) => {
  const titleLine = [a.title, a.year].filter(Boolean).join(', ');
  return [a.artist, titleLine, a.medium, a.dimensions, a.price].filter(Boolean).join('\n');
};

/** Opens the system share sheet (Messages, WhatsApp, Mail…) with the main
 *  image and the short caption. Falls back to copying the caption where the
 *  share sheet doesn't exist (desktop browsers). */
export const shareArtwork = async (a: Artwork) => {
  const text = shareText(a);
  let files: File[] | undefined;
  if (a.image_url) {
    try {
      const blob = await fetch(mediaUrl(a.image_url)).then((r) => r.blob());
      const file = new File([blob], 'artwork.png', { type: blob.type || 'image/png' });
      if (navigator.canShare?.({ files: [file] })) files = [file];
    } catch {
      /* image fetch failed — share the text alone */
    }
  }
  if (navigator.share) {
    try {
      await navigator.share(files ? { files, text } : { text });
    } catch {
      /* user cancelled the share sheet */
    }
  } else {
    await navigator.clipboard.writeText(text);
    alert('Caption copied — sharing is only available on the phone.');
  }
};
