import { describe, expect, it } from 'vitest';
import { buildReport, decodeXmlFile, formatXmlSource, validateXml } from './xml';

describe('validateXml', () => {
  it.each([
    ['simple document', '<root/>'],
    ['nested elements and attributes', '<root a="1"><child key="v">text</child></root>'],
    ['comments and CDATA', '<root><!-- hello --><data><![CDATA[a < b]]></data></root>'],
    ['namespaces', '<x:root xmlns:x="urn:test"><x:item/></x:root>'],
    ['Cyrillic and Unicode', '<корень привет="мир">Привет 🌍 漢字</корень>'],
    ['XML declaration', '<?xml version="1.0" encoding="UTF-8"?><root/>'],
    ['empty element', '<root><empty></empty><self-closing/></root>'],
    ['processing instruction', '<?xml version="1.0"?><root><?work now?></root>'],
  ])('accepts %s', (_name, xml) => expect(validateXml(xml).status).toBe('valid'));

  it.each([
    ['multiple roots', '<a/><b/>'],
    ['unclosed tag', '<root>'],
    ['mismatched tags', '<root></other>'],
    ['wrong nesting', '<a><b></a></b>'],
    ['unquoted attribute', '<root value=test/>'],
    ['invalid entity', '<root>&notDefined;</root>'],
    ['empty document', ''],
    ['malformed declaration', '<?xml version="2.0"?><root/>'],
    ['malformed comment', '<root><!-- a -- b --></root>'],
    ['unbound namespace prefix', '<x:root/>'],
  ])('rejects %s', (_name, xml) => expect(validateXml(xml).status).toBe('invalid'));

  it('rejects a document above the configured byte limit', () => expect(validateXml('<root/>', 2).status).toBe('technical'));
  it('does not fetch or expand an external entity', () => {
    const result = validateXml('<!DOCTYPE root [<!ENTITY ext SYSTEM "file:///etc/passwd">]><root>&ext;</root>');
    expect(result.status).not.toBe('valid');
  });
  it('formats valid XML without changing the parsed structure', () => {
    const formatted = formatXmlSource('<root><a>1</a><b x="y"/></root>');
    expect(validateXml(formatted).status).toBe('valid');
    expect(formatted).toContain('<root>');
  });
  it('does not format invalid XML', () => expect(() => formatXmlSource('<root>')).toThrow());
  it('reports are valid JSON and do not include source content', () => {
    const source = '<root>secret</root>';
    const report = buildReport(validateXml(source), 'test.xml', source);
    expect(JSON.parse(report).sourceIncluded).toBe(false);
    expect(report).not.toContain('secret');
  });
  it('decodes UTF-8 and rejects invalid byte sequences', () => {
    expect(decodeXmlFile(new TextEncoder().encode('<корень/>').buffer)).toBe('<корень/>');
    expect(() => decodeXmlFile(new Uint8Array([0xc3, 0x28]).buffer)).toThrow();
  });
});
