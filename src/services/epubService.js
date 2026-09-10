/**
 * EPUB Parsing and Extraction Service for LinguaFlow Text Reader
 * 
 * Safely extracts:
 * - Book title & author
 * - Language metadata
 * - Chapters in exact sequential spine order
 * - Clean text paragraphs without HTML garbage, styles, scripts, or invisible elements
 * - Stable deterministic paragraph IDs (ch{c}_p{p})
 * - Immediate offline tokenization with zero Groq AI calls during import
 */

import JSZip from 'jszip';
import { tokenizeAndGlossLineOffline } from './subtitleGlossService.js';
import { getLanguageMeta } from '../constants/languages.js';
import { splitTextIntoNaturalSegments } from './textDocumentService.js';

/**
 * Resolves a relative path against a base directory within a zip archive.
 * Example: resolveZipPath('OEBPS/', '../text/ch01.xhtml') -> 'text/ch01.xhtml'
 */
export function resolveZipPath(baseDir, relativePath) {
  if (!relativePath) return '';
  if (!baseDir) return relativePath.replace(/^\/+/, '');

  // If relativePath is already absolute or baseDir is empty
  const full = (baseDir.endsWith('/') ? baseDir : `${baseDir}/`) + relativePath;
  const parts = full.split('/');
  const resolved = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (resolved.length > 0) resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join('/');
}

/**
 * Normalizes language codes extracted from EPUB metadata to LinguaFlow codes.
 * E.g. 'zh-CN', 'cmn', 'zh-Hans' -> 'zh'; 'ar-SA' -> 'ar'; 'pl-PL' -> 'pl'
 */
export function normalizeEpubLanguage(rawLang) {
  if (!rawLang || typeof rawLang !== 'string') return null;
  const clean = rawLang.trim().toLowerCase();
  if (clean.startsWith('zh') || clean.startsWith('cmn')) return 'zh';
  if (clean.startsWith('ar')) return 'ar';
  if (clean.startsWith('pl')) return 'pl';
  if (clean.startsWith('ru')) return 'ru';
  if (clean.startsWith('en')) return 'en';
  if (clean.startsWith('es')) return 'es';
  if (clean.startsWith('de')) return 'de';
  if (clean.startsWith('fr')) return 'fr';
  if (clean.startsWith('it')) return 'it';
  if (clean.startsWith('nl')) return 'nl';
  return null;
}

/**
 * Helper to get DOMParser instance safely in browser or testing environments.
 */
function parseXmlOrHtml(content, mimeType = 'application/xml') {
  if (typeof window !== 'undefined' && window.DOMParser) {
    const parser = new window.DOMParser();
    return parser.parseFromString(content, mimeType);
  }
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    return parser.parseFromString(content, mimeType);
  }
  return null;
}

/**
 * Strips unwanted tags (script, style, noscript, svg, head, metadata) from raw HTML/XHTML string.
 * Also replaces line breaks and block element boundaries with clean spacing.
 */
export function cleanHtmlText(htmlStr) {
  if (!htmlStr || typeof htmlStr !== 'string') return '';

  return htmlStr
    // Remove scripts, styles, heads, noscripts
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    // Replace <br> and block closures with spaces or newlines
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Unescape common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Normalize excessive whitespace
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

/**
 * Extracts blocks of text and headings from a parsed DOM document or HTML string.
 * Returns array of objects: { type: 'heading' | 'paragraph', text: string, level?: number }
 */
export function extractContentBlocks(docOrHtml) {
  const blocks = [];

  // If we have a full DOM Document
  if (docOrHtml && typeof docOrHtml === 'object' && docOrHtml.body) {
    const body = docOrHtml.body;

    // Remove unwanted nodes first
    const unwanted = body.querySelectorAll('script, style, head, noscript, svg, nav, footer, header');
    unwanted.forEach(el => el.remove());

    // Traverse all elements in document order
    const elements = body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, blockquote, li');
    const processedNodes = new Set();

    for (const el of elements) {
      // Avoid duplicating nested blocks (e.g. if div contains p)
      if (processedNodes.has(el)) continue;

      const tag = el.tagName.toLowerCase();
      const isHeading = /^h[1-6]$/.test(tag);
      const text = (el.textContent || '').replace(/[ \t\r\n]+/g, ' ').trim();

      if (!text) continue;

      // If div/blockquote contains child paragraphs, process children instead
      if ((tag === 'div' || tag === 'blockquote') && el.querySelector('p, h1, h2, h3, h4, h5, h6')) {
        continue;
      }

      processedNodes.add(el);
      // Mark all descendant elements as processed so they aren't parsed twice
      el.querySelectorAll('p, div, li, span, a').forEach(child => processedNodes.add(child));

      blocks.push({
        type: isHeading ? 'heading' : 'paragraph',
        tag,
        text
      });
    }

    if (blocks.length > 0) return blocks;
  }

  // Fallback string-based extraction if DOM is unavailable or empty
  const rawString = typeof docOrHtml === 'string' ? docOrHtml : (docOrHtml?.body?.innerHTML || '');
  const clean = cleanHtmlText(rawString);
  if (!clean) return [];

  const rawParagraphs = clean.split(/\n{2,}/);
  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (trimmed) {
      blocks.push({
        type: 'paragraph',
        tag: 'p',
        text: trimmed
      });
    }
  }

  return blocks;
}

/**
 * Parses an EPUB file into structured metadata, chapters, and LinguaFlow-ready paragraphs.
 * 
 * @param {File|Blob|ArrayBuffer|Uint8Array} file - The .epub file
 * @param {object} options
 * @param {string} [options.targetLang] - Preferred learning language (falls back to detected EPUB lang or 'zh')
 * @param {string} [options.nativeLang='es']
 * @param {function} [options.onProgress] - Optional progress callback ({ current, total, chapterTitle })
 * @returns {Promise<object>} Extracted book document structure
 */
export async function parseEpubFile(file, options = {}) {
  if (!file) throw new Error('No se proporcionó ningún archivo EPUB.');

  const {
    targetLang: preferredTargetLang = null,
    nativeLang = 'es',
    onProgress = null
  } = options;

  // 1. Load ZIP archive
  const zip = await JSZip.loadAsync(file);

  // 2. Parse META-INF/container.xml to find the OPF package path
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('El archivo no es un EPUB válido (falta META-INF/container.xml).');
  }

  const containerXml = await containerFile.async('string');
  const containerDoc = parseXmlOrHtml(containerXml, 'application/xml');

  let opfPath = '';
  if (containerDoc) {
    const rootfileEl = containerDoc.querySelector('rootfile[full-path]') || containerDoc.querySelector('rootfile');
    opfPath = rootfileEl?.getAttribute('full-path') || '';
  }

  // Fallback regex if DOMParser didn't find full-path
  if (!opfPath) {
    const match = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (match) opfPath = match[1];
  }

  if (!opfPath || !zip.file(opfPath)) {
    // Try common default paths
    const candidates = ['content.opf', 'OEBPS/content.opf', 'OPS/content.opf'];
    for (const cand of candidates) {
      if (zip.file(cand)) {
        opfPath = cand;
        break;
      }
    }
  }

  if (!opfPath || !zip.file(opfPath)) {
    throw new Error('No se pudo localizar el archivo de manifiesto OPF en el EPUB.');
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = await zip.file(opfPath).async('string');
  const opfDoc = parseXmlOrHtml(opfXml, 'application/xml');

  // 3. Extract Metadata (Title, Creator, Language)
  let title = '';
  let author = '';
  let detectedLanguage = null;

  if (opfDoc) {
    title = opfDoc.querySelector('metadata dc\\:title, metadata title')?.textContent?.trim() || '';
    author = opfDoc.querySelector('metadata dc\\:creator, metadata creator')?.textContent?.trim() || '';
    const langRaw = opfDoc.querySelector('metadata dc\\:language, metadata language')?.textContent?.trim() || '';
    detectedLanguage = normalizeEpubLanguage(langRaw);
  }

  // Fallback regex for OPF metadata if XML parser didn't catch namespaces
  if (!title) {
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) || opfXml.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();
  }
  if (!author) {
    const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i) || opfXml.match(/<creator[^>]*>([^<]+)<\/creator>/i);
    if (authorMatch) author = authorMatch[1].trim();
  }
  if (!detectedLanguage) {
    const langMatch = opfXml.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i) || opfXml.match(/<language[^>]*>([^<]+)<\/language>/i);
    if (langMatch) detectedLanguage = normalizeEpubLanguage(langMatch[1]);
  }

  // Fallback to filename if title is missing
  if (!title && file.name) {
    title = file.name.replace(/\.[^/.]+$/, '').trim();
  }
  if (!title) title = 'Libro EPUB sin título';

  const finalTargetLang = preferredTargetLang || detectedLanguage || 'zh';
  const langMeta = getLanguageMeta(finalTargetLang);
  const speechCode = langMeta?.speechCode || 'zh-CN';

  // 4. Extract Manifest (item id -> href)
  const manifestMap = new Map();
  if (opfDoc) {
    const items = opfDoc.querySelectorAll('manifest item');
    items.forEach(el => {
      const id = el.getAttribute('id');
      const href = el.getAttribute('href');
      const mediaType = el.getAttribute('media-type') || '';
      if (id && href) {
        manifestMap.set(id, {
          href: resolveZipPath(opfDir, href),
          mediaType
        });
      }
    });
  }

  // Fallback regex for manifest
  if (manifestMap.size === 0) {
    const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = itemRegex.exec(opfXml)) !== null) {
      manifestMap.set(match[1], {
        href: resolveZipPath(opfDir, match[2]),
        mediaType: ''
      });
    }
  }

  // 5. Extract Spine (ordered chapter itemrefs)
  const spineIds = [];
  if (opfDoc) {
    const itemrefs = opfDoc.querySelectorAll('spine itemref');
    itemrefs.forEach(el => {
      const idref = el.getAttribute('idref');
      if (idref) spineIds.push(idref);
    });
  }

  // Fallback regex for spine
  if (spineIds.length === 0) {
    const spineMatch = opfXml.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i);
    if (spineMatch) {
      const itemrefRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = itemrefRegex.exec(spineMatch[1])) !== null) {
        spineIds.push(m[1]);
      }
    }
  }

  // If spine is empty, look for any html/xhtml files in manifest
  if (spineIds.length === 0) {
    for (const [id, val] of manifestMap.entries()) {
      if (/\.x?html?$/i.test(val.href)) {
        spineIds.push(id);
      }
    }
  }

  const chapters = [];
  const allParagraphs = [];
  let globalParagraphIndex = 0;
  const totalSpine = spineIds.length;

  // 6. Process each chapter in spine order
  for (let cIdx = 0; cIdx < totalSpine; cIdx++) {
    const idref = spineIds[cIdx];
    const manifestItem = manifestMap.get(idref);
    if (!manifestItem || !manifestItem.href) continue;

    const zipEntry = zip.file(manifestItem.href);
    if (!zipEntry) continue;

    const chapterHtml = await zipEntry.async('string');
    const chapterDoc = parseXmlOrHtml(chapterHtml, 'text/html') || parseXmlOrHtml(chapterHtml, 'application/xhtml+xml');

    // Extract title from chapter content (h1, h2, or document title)
    let chapterTitle = '';
    if (chapterDoc) {
      const h1 = chapterDoc.querySelector('h1, h2, .chapter-title, .title');
      if (h1 && h1.textContent.trim()) {
        chapterTitle = h1.textContent.trim();
      } else if (chapterDoc.title && chapterDoc.title.trim()) {
        chapterTitle = chapterDoc.title.trim();
      }
    }

    if (!chapterTitle) {
      // Fallback regex for title
      const hMatch = chapterHtml.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i) || chapterHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (hMatch) chapterTitle = cleanHtmlText(hMatch[1]);
    }

    // Default chapter title
    if (!chapterTitle) {
      chapterTitle = `Capítulo ${cIdx + 1}`;
    }

    if (onProgress) {
      onProgress({
        current: cIdx + 1,
        total: totalSpine,
        chapterTitle
      });
    }

    // Extract content blocks from this chapter
    const blocks = extractContentBlocks(chapterDoc || chapterHtml);
    const chapterParagraphs = [];
    const chapterId = `ch_${cIdx + 1}`;
    const startIndex = globalParagraphIndex;

    let paraInChapterIndex = 0;
    let isFirstHeadingSkipped = false;

    for (const block of blocks) {
      const rawBlockText = (block.text || '').trim();
      if (!rawBlockText) continue;

      // Skip the main heading if it matches the chapter title to avoid duplicating it as a reading paragraph
      if (!isFirstHeadingSkipped && rawBlockText === chapterTitle) {
        isFirstHeadingSkipped = true;
        continue;
      }

      // Split into natural segments (sentences, punctuation boundaries, length limit)
      const segments = splitTextIntoNaturalSegments(rawBlockText, finalTargetLang);

      for (const segment of segments) {
        const cleanSeg = segment.trim();
        if (!cleanSeg) continue;

        // Deterministic stable ID: ch{chapterIndex}_p{paragraphIndex}
        const paragraphId = `${chapterId}_p${paraInChapterIndex + 1}`;

        const paragraphObj = {
          id: paragraphId,
          index: globalParagraphIndex,
          text: cleanSeg,
          tokens: tokenizeAndGlossLineOffline(cleanSeg, finalTargetLang),
          glosses: [],
          chapterId,
          chapterTitle,
          isChapterStart: paraInChapterIndex === 0,
          tts: {
            speechCode,
            rate: 1.0
          }
        };

        chapterParagraphs.push(paragraphObj);
        allParagraphs.push(paragraphObj);
        paraInChapterIndex++;
        globalParagraphIndex++;
      }
    }

    // Only record chapter if it contained readable content
    if (chapterParagraphs.length > 0) {
      chapters.push({
        id: chapterId,
        index: chapters.length,
        title: chapterTitle,
        href: manifestItem.href,
        paragraphIds: chapterParagraphs.map(p => p.id),
        startIndex,
        endIndex: globalParagraphIndex - 1,
        paragraphsCount: chapterParagraphs.length
      });
    }
  }

  // Ensure at least one fallback paragraph if book had no textual chapters
  if (allParagraphs.length === 0) {
    const emptyPara = {
      id: 'ch_1_p1',
      index: 0,
      text: 'El archivo EPUB no contiene texto legible.',
      tokens: tokenizeAndGlossLineOffline('El archivo EPUB no contiene texto legible.', finalTargetLang),
      glosses: [],
      chapterId: 'ch_1',
      chapterTitle: 'Capítulo 1',
      isChapterStart: true,
      tts: { speechCode, rate: 1.0 }
    };
    allParagraphs.push(emptyPara);
    chapters.push({
      id: 'ch_1',
      index: 0,
      title: 'Capítulo 1',
      paragraphIds: [emptyPara.id],
      startIndex: 0,
      endIndex: 0,
      paragraphsCount: 1
    });
  }

  const rawText = allParagraphs.map(p => p.text).join('\n\n');

  return {
    title,
    author,
    targetLang: finalTargetLang,
    nativeLang,
    detectedLanguage,
    chapters,
    paragraphs: allParagraphs,
    paragraphsCount: allParagraphs.length,
    rawText,
    sourceType: 'epub',
    format: 'epub'
  };
}
