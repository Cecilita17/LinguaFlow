import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolveOpenedPage, latestOpenedPage } from '../src/utils/readerPagePosition.js';
const pageSource = readFileSync(new URL('../src/pages/TextReaderPage.jsx', import.meta.url), 'utf8');
const resolvers = runInNewContext(pageSource.slice(pageSource.indexOf('function resolveManualReadingBookmarkId'), pageSource.indexOf('export function TextReaderPage')) + '\n({ resolveChapterIndexForDoc, resolvePageIndexForDoc });', { resolveOpenedPage, resolveAudioBookmark: doc => doc?.audioBookmark });
const paragraphs = Array.from({ length: 24 }, (_, i) => ({ id: `p-${i}`, chapterId: i < 12 ? 'a' : 'b', text: 'Text' }));
const document = { id: 'book', paragraphs, chapters: [{ id: 'a', paragraphIds: paragraphs.slice(0,12).map(p=>p.id) }, { id: 'b', paragraphIds: paragraphs.slice(12).map(p=>p.id) }], format: 'epub', manualReadingBookmark: { documentId: 'book', paragraphId: 'p-0' } };

test('last visited page wins over the manual bookmark without removing it', () => {
 const doc = { ...document, lastOpenedPage: { chapterId: 'b', chapterIndex: 1, pageIndex: 1, paragraphId: 'p-18', updatedAt: 20 } };
 const originalBookmark = doc.manualReadingBookmark;
 assert.equal(resolvers.resolveChapterIndexForDoc(doc),1);
 assert.equal(resolvers.resolvePageIndexForDoc(doc,1),1);
 assert.equal(doc.manualReadingBookmark,originalBookmark);
});
test('legacy documents continue to restore their existing bookmarks', () => {
 const doc = { ...document, manualReadingBookmark: { documentId: 'book', paragraphId: 'p-18' } };
 assert.equal(resolvers.resolveChapterIndexForDoc(doc),1);
 assert.equal(resolvers.resolvePageIndexForDoc(doc,1),1);
});
test('TXT pages restore independently and invalid pages clamp after text changes', () => {
 const doc = { id: 'text', paragraphs, lastOpenedPage: { pageIndex: 3, paragraphId: 'p-18' } };
 assert.equal(resolveOpenedPage(doc).pageIndex,3);
 assert.equal(resolveOpenedPage({ ...doc, paragraphs: paragraphs.slice(0,7) }).pageIndex,1);
 assert.equal(resolveOpenedPage({ ...doc, lastOpenedPage: { pageIndex: -1 } }),null);
});
test('older saves cannot replace newer visited-page metadata', () => {
 const older = { pageIndex: 0, updatedAt: 10 }, newer = { pageIndex: 3, updatedAt: 20 };
 assert.equal(latestOpenedPage(older,newer),newer);
 assert.equal(latestOpenedPage(newer,older),newer);
 assert.equal(latestOpenedPage(null,newer),newer);
});
test('minimal persisted draft includes visited page and keeps the manual marker', () => {
 const source = readFileSync(new URL('../src/services/textDocumentService.js', import.meta.url),'utf8');
 const start = source.indexOf('export function extractMinimalDraft');
 const end = source.indexOf('\n/**', start);
 const extract = runInNewContext(source.slice(start,end).replace('export ','') + '\nextractMinimalDraft;', { resolveAudioBookmark: doc => doc.audioBookmark || null });
 const doc = { ...document, lastOpenedPage: { chapterId: 'b', chapterIndex: 1, pageIndex: 1, paragraphId: 'p-18', updatedAt: 20 } };
 const restored = JSON.parse(JSON.stringify(extract(doc)));
 assert.deepEqual(restored.lastOpenedPage,doc.lastOpenedPage);
 assert.deepEqual(restored.manualReadingBookmark,doc.manualReadingBookmark);
 assert.equal(restored.isMinimalDraft,true);
});
