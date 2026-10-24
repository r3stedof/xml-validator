import { DOMParser } from '@xmldom/xmldom';
import formatXml from 'xml-formatter';

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
export type ValidationStatus = 'valid' | 'invalid' | 'technical';
export interface XmlIssue { message: string; line: number | null; column: number | null; snippet: string | null; suggestion: string | null }
export interface ValidationResult { status: ValidationStatus; summary: string; issues: XmlIssue[]; checkedAt: string; bytes: number }

function locateSnippet(source: string, line: number | null): string | null {
  if (!line || line < 1) return null;
  const lines = source.split(/\r\n|\r|\n/);
  if (line > lines.length) return null;
  const from = Math.max(0, line - 2), to = Math.min(lines.length, line + 1);
  return lines.slice(from, to).map((text, i) => `${from + i + 1}: ${text}`).join('\n');
}

function guessSuggestion(message: string): string | null {
  const m = message.toLowerCase();
  if (/mismatch|matching|closing tag|end tag/.test(m)) return 'Сверьте имя закрывающего тега с открывающим и проверьте вложенность элементов.';
  if (/entity|entities|not defined|reference/.test(m)) return 'Проверьте написание сущностей. Для символов &, < и кавычек используйте &amp;, &lt;, &quot; или &apos; по контексту.';
  if (/attribute|quoted|quote/.test(m)) return 'Убедитесь, что каждый атрибут имеет имя, знак = и значение в парных кавычках.';
  if (/root|document element|multiple roots|extra content/.test(m)) return 'В XML-документе должен быть ровно один корневой элемент.';
  if (/comment/.test(m)) return 'В комментариях XML последовательность -- недопустима, а комментарий должен завершаться символами -->.';
  if (/namespace|prefix/.test(m)) return 'Проверьте объявление xmlns для каждого используемого префикса пространства имён.';
  return null;
}

export function validateXml(source: string, maxBytes = DEFAULT_MAX_BYTES): ValidationResult {
  const bytes = new TextEncoder().encode(source).byteLength;
  const checkedAt = new Date().toISOString();
  if (bytes > maxBytes) return { status: 'technical', summary: `Размер документа превышает лимит ${formatBytes(maxBytes)}.`, issues: [], checkedAt, bytes };
  if (!source.trim()) return { status: 'invalid', summary: 'XML-документ пуст.', issues: [{ message: 'Нет содержимого для разбора.', line: null, column: null, snippet: null, suggestion: 'Вставьте XML-код или выберите файл.' }], checkedAt, bytes };
  // The parser runs locally. No custom entity resolver is configured; external resources are never fetched.
  const issues: XmlIssue[] = [];
  try {
    const parser = new DOMParser({
      locator: {},
      errorHandler: {
        warning: (_message: string) => { /* Non-fatal parser warnings do not invalidate well-formed XML. */ },
        error: (message: string) => { issues.push(makeIssue(message, source, null, null)); },
        fatalError: (message: string) => { issues.push(makeIssue(message, source, null, null)); }
      }
    });
    const document = parser.parseFromString(source, 'application/xml');
    const root = document.documentElement;
    const parserIssues = issues;
    if (!root || root.nodeName === 'parsererror' || parserIssues.length) {
      const unique = dedupeIssues(parserIssues.length ? parserIssues : issues);
      if (!unique.length) unique.push(makeIssue('Не удалось разобрать XML-документ.', source, null, null));
      return { status: 'invalid', summary: `XML содержит ошибки (${unique.length}).`, issues: unique, checkedAt, bytes };
    }
    // A doctype may be present, but no external entity resolver is enabled.
    return { status: 'valid', summary: 'Документ успешно разобран. Синтаксис XML корректен.', issues: [], checkedAt, bytes };
  } catch (error) {
    return { status: 'technical', summary: 'Не удалось выполнить проверку из-за технической ошибки.', issues: [{ message: error instanceof Error ? error.message : 'Неизвестная ошибка парсера.', line: null, column: null, snippet: null, suggestion: null }], checkedAt, bytes };
  }
}

function makeIssue(message: string, source: string, line: number | null, column: number | null): XmlIssue {
  // xmldom's legacy error callback may not expose structured locations, so do not infer one from text.
  const clean = message.replace(/^(?:fatalError|error|warning):\s*/i, '').trim();
  return { message: clean, line, column, snippet: locateSnippet(source, line), suggestion: guessSuggestion(clean) };
}
function dedupeIssues(issues: XmlIssue[]): XmlIssue[] {
  return [...new Map(issues.map(i => [i.message, i])).values()];
}
export function formatXmlSource(source: string, maxBytes = DEFAULT_MAX_BYTES): string {
  const result = validateXml(source, maxBytes);
  if (result.status !== 'valid') throw new Error('Сначала исправьте синтаксические ошибки XML.');
  return formatXml(source, { indentation: '  ', collapseContent: true, lineSeparator: '\n' });
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} МБ`;
}
export function decodeXmlFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function buildReport(result: ValidationResult, filename: string | null, source: string): string {
  return JSON.stringify({ application: 'XML Validator', filename, status: result.status, summary: result.summary, bytes: result.bytes, checkedAt: result.checkedAt, issues: result.issues, sourceIncluded: false, sourceLength: source.length }, null, 2);
}
