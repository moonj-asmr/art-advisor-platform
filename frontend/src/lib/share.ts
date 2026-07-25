import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { mediaUrl } from './api';
import type { Artwork } from '../types';

/** The caption that travels with a shared work: title, artist, medium,
 *  dimensions, price — nothing else. */
const shareText = (a: Artwork) => {
  const titleLine = [a.title, a.year].filter(Boolean).join(', ');
  return [a.artist, titleLine, a.medium, a.dimensions, a.price].filter(Boolean).join('\n');
};

const extensionFor = (mime: string, url: string) => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  const fromUrl = url.split('?')[0].split('.').pop();
  return fromUrl && fromUrl.length <= 5 ? fromUrl : 'jpg';
};

const fetchImage = async (path: string) => {
  const url = mediaUrl(path);
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // The same image is already on screen in an <img>. If that request was
    // made without CORS the browser caches an opaque response, and this fetch
    // is rejected for reusing it — so bypass the cache and ask again.
    res = await fetch(url, { cache: 'reload' });
  }
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  const type = blob.type || 'image/jpeg';
  return { blob, type, ext: extensionFor(type, path) };
};

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    // strips the "data:<mime>;base64," prefix Filesystem doesn't want
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Inside the iOS app, go through the native share sheet: the browser's
 *  Web Share API is unreliable in a WKWebView for file attachments, which is
 *  why the image used to be dropped and only the caption came through. The
 *  image is written to the cache directory and handed over as a real file. */
const shareNative = async (a: Artwork, text: string) => {
  let fileUri: string | undefined;
  if (a.image_url) {
    try {
      const { blob, ext } = await fetchImage(a.image_url);
      const name = `advisorydeck-${a.id}.${ext}`;
      const written = await Filesystem.writeFile({
        path: name,
        data: await toBase64(blob),
        directory: Directory.Cache,
      });
      fileUri = written.uri;
    } catch {
      /* fall through and share the caption alone */
    }
  }
  await Share.share(fileUri ? { text, files: [fileUri] } : { text });
};

const shareWeb = async (a: Artwork, text: string) => {
  let files: File[] | undefined;
  if (a.image_url) {
    try {
      const { blob, type, ext } = await fetchImage(a.image_url);
      const file = new File([blob], `artwork.${ext}`, { type });
      if (navigator.canShare?.({ files: [file] })) files = [file];
    } catch {
      /* image fetch failed — share the text alone */
    }
  }
  if (navigator.share) {
    await navigator.share(files ? { files, text } : { text });
  } else {
    await navigator.clipboard.writeText(text);
    alert('Caption copied to the clipboard.');
  }
};

const wasCancelled = (e: unknown) =>
  /cancel|abort/i.test(e instanceof Error ? e.message : String(e));

/** Opens the share sheet with the artwork image and its short caption. */
export const shareArtwork = async (a: Artwork) => {
  const text = shareText(a);
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        await shareNative(a, text);
      } catch (e) {
        // never leave the button dead: if the native sheet itself failed
        // (rather than the user dismissing it), try the browser one
        if (wasCancelled(e)) return;
        await shareWeb(a, text);
      }
    } else {
      await shareWeb(a, text);
    }
  } catch {
    /* the user dismissed the share sheet */
  }
};
