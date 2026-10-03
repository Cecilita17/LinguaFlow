export function latestOpenedPage(first, second) {
  if (!first) return second || null;
  if (!second) return first;
  return (Number(second.updatedAt) || 0) > (Number(first.updatedAt) || 0) ? second : first;
}

export function resolveOpenedPage(document, paragraphsPerPage = 6) {
  const saved = document?.lastOpenedPage;
  if (!saved || !Number.isInteger(saved.pageIndex) || saved.pageIndex < 0) return null;
  const chapters = document.chapters || [];
  let chapterIndex = chapters.findIndex(chapter => chapter.id === saved.chapterId);
  if (chapterIndex < 0) chapterIndex = Math.min(Math.max(0, Number.isInteger(saved.chapterIndex) ? saved.chapterIndex : 0), Math.max(0, chapters.length - 1));
  const chapter = chapters[chapterIndex];
  const paragraphs = chapter
    ? (document.paragraphs || []).filter(paragraph => paragraph.chapterId === chapter.id)
    : document.paragraphs || [];
  if (!paragraphs.length) return null;
  const anchorIndex = paragraphs.findIndex(paragraph => paragraph.id === saved.paragraphId);
  const pageIndex = anchorIndex >= 0 ? Math.floor(anchorIndex / paragraphsPerPage)
    : Math.min(saved.pageIndex, Math.max(0, Math.ceil(paragraphs.length / paragraphsPerPage) - 1));
  return { chapterIndex, pageIndex, paragraphId: paragraphs[pageIndex * paragraphsPerPage]?.id || null };
}
