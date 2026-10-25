import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { AlertCircle, ArrowDownToLine, Check, CheckCircle2, ChevronDown, Clipboard, Code2, FileCode2, FileJson, FileText, FolderOpen, History, Moon, RotateCcw, ShieldCheck, Sparkles, Sun, UploadCloud, X, Zap } from 'lucide-react';
import { buildReport, decodeXmlFile, formatBytes, formatXmlSource, validateXml, type ValidationResult } from './xml';

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="https://example.com/catalog" version="1.0">
  <product id="p-001" available="true">
    <name>Кофемолка «Ветер»</name>
    <price currency="RUB">4290.00</price>
    <description><![CDATA[Для свежемолотого кофе — каждый день.]]></description>
    <tags>
      <tag>кухня</tag>
      <tag>кофе</tag>
    </tags>
  </product>
</catalog>`;

type HistoryItem = { id: number; name: string; result: ValidationResult; time: string };
function saveFile(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function App() {
  const [source, setSource] = useState(EXAMPLE);
  const [filename, setFilename] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dark, setDark] = useState(false);
  const [maxMb, setMaxMb] = useState(5);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const extensions = useMemo(() => [xml()], []);

  const check = useCallback(() => {
    if (busy) return;
    setBusy(true); setNotice('');
    // Yield a frame so the progress indicator can render before parsing.
    window.setTimeout(() => {
      try {
        const checked = validateXml(source, maxMb * 1024 * 1024);
        setResult(checked);
        setHistory(prev => [{ id: Date.now(), name: filename || 'Вставленный XML', result: checked, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 8));
      } catch {
        setResult({ status: 'technical', summary: 'Не удалось выполнить проверку из-за технической ошибки.', issues: [], checkedAt: new Date().toISOString(), bytes: new TextEncoder().encode(source).byteLength });
      } finally { setBusy(false); }
    }, 30);
  }, [busy, source, maxMb, filename]);

  
const loadFile = useCallback(async (file?: File) => {
  if (!file) return;

  // Разрешаем загружать только файлы с расширением .xml
  if (!file.name.toLowerCase().endsWith('.xml')) {
    setNotice('Неподдерживаемый формат файла. Выберите файл с расширением .xml.');
    return;
  }

  // Проверяем размер файла
  if (file.size > maxMb * 1024 * 1024) {
    setResult({
      status: 'technical',
      summary: `Файл превышает выбранный лимит ${maxMb} МБ.`,
      issues: [],
      checkedAt: new Date().toISOString(),
      bytes: file.size
    });
    setNotice('Выберите файл меньшего размера или увеличьте лимит.');
    return;
  }

  try {
    const text = decodeXmlFile(await file.arrayBuffer());

    setSource(text);
    setFilename(file.name);
    setFileSize(file.size);
    setResult(null);
    setNotice('Файл загружен. Запустите проверку, чтобы получить результат.');
  } catch {
    setResult({
      status: 'technical',
      summary: 'Не удалось прочитать файл: неподдерживаемая или некорректная кодировка.',
      issues: [{
        message: 'Файл не удалось декодировать как UTF-8 или BOM-маркированный UTF-16.',
        line: null,
        column: null,
        snippet: null,
        suggestion: 'Сохраните файл в UTF-8 или UTF-16 с BOM и попробуйте снова.'
      }],
      checkedAt: new Date().toISOString(),
      bytes: file.size
    });

    setFilename(file.name);
    setFileSize(file.size);
    setNotice('Исходный текст не был заменён из-за ошибки кодировки.');
  }
}, [maxMb]);

  const copy = async (text: string, success = 'Скопировано в буфер обмена') => {
    try { await navigator.clipboard.writeText(text); setNotice(success); }
    catch { setNotice('Браузер не разрешил копирование. Выделите текст вручную.'); }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); check(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [check]);

  const reportText = result ? buildReport(result, filename, source) : '';
  const statusLabel = result?.status === 'valid' ? 'XML корректен' : result?.status === 'invalid' ? 'XML содержит ошибки' : 'Не удалось выполнить проверку';

  return <div className={dark ? 'app dark' : 'app'}>
    <header className="topbar"><a className="brand" href="#top" aria-label="XML Validator — главная"><span className="brand-icon"><Code2 size={21}/></span><span>xml<span className="brand-light">validator</span><small>ИНСТРУМЕНТ ПРОВЕРКИ XML</small></span></a><nav className="nav"><a href="#editor">Редактор</a><a href="#results">Результат</a><a href="#privacy">Конфиденциальность</a></nav><button className="theme-toggle" onClick={() => setDark(!dark)} aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}>{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? 'Светлая тема' : 'Тёмная тема'}</span></button></header>
    <main id="top" className="main-wrap">
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> БЕСПЛАТНЫЙ XML-ИНСТРУМЕНТ</div><h1>Ваш XML.<br/><span>Без ошибок.</span></h1><p>Проверяйте синтаксис XML, находите ошибки и приводите код в порядок — быстро, просто и прямо в браузере.</p><div className="hero-points"><span><ShieldCheck size={16}/> Файлы не покидают устройство</span><span><Zap size={16}/> Мгновенная проверка</span></div></div><div className="hero-visual" aria-hidden="true"><div className="visual-glow"/><div className="code-window"><div className="window-top"><div className="window-dots"><i/><i/><i/></div><span>document.xml</span><CheckCircle2 size={16}/></div><div className="mini-code"><div><b>1</b><span className="code-purple">&lt;?xml</span> <span className="code-blue">version</span>=<span className="code-green">"1.0"</span><span className="code-purple">?&gt;</span></div><div><b>2</b><span className="code-purple">&lt;catalog&gt;</span></div><div><b>3</b>　<span className="code-purple">&lt;item</span> <span className="code-blue">id</span>=<span className="code-green">"42"</span><span className="code-purple">&gt;</span></div><div><b>4</b>　　<span className="code-purple">&lt;name&gt;</span>Пример<span className="code-purple">&lt;/name&gt;</span></div><div><b>5</b>　<span className="code-purple">&lt;/item&gt;</span></div><div><b>6</b><span className="code-purple">&lt;/catalog&gt;</span></div></div><div className="valid-chip"><span><Check size={14}/></span><div><strong>Синтаксис корректен</strong><small>Проверка завершена успешно</small></div></div></div></div></section>
      <section className="workspace" id="editor"><div className="workspace-heading"><div><div className="section-kicker">РАБОЧАЯ ОБЛАСТЬ</div><h2>Проверка XML</h2><p>Загрузите файл или вставьте код — всё готово к проверке.</p></div><div className="limit-control"><label htmlFor="max-size">Макс. размер файла</label><select id="max-size" value={maxMb} onChange={e => setMaxMb(Number(e.target.value))}><option value={1}>1 МБ</option><option value={5}>5 МБ</option><option value={10}>10 МБ</option><option value={20}>20 МБ</option></select></div></div>
        <div className="upload-zone" onDragOver={e => {e.preventDefault();setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={e => {e.preventDefault();setDragging(false);void loadFile(e.dataTransfer.files[0])}} data-dragging={dragging} role="region" aria-label="Загрузка XML-файла"><div className="upload-icon"><UploadCloud size={22}/></div><div className="upload-copy"><strong>Перетащите XML-файл сюда</strong><span>или выберите файл с расширением .xml</span></div><button className="button button-outline" onClick={() => inputRef.current?.click()}><FolderOpen size={16}/> Выбрать файл</button><input ref={inputRef} type="file" accept=".xml" hidden onChange={e => {void loadFile(e.target.files?.[0]);e.currentTarget.value=''}} aria-label="Выбрать файл для проверки"/></div>
        {filename && <div className="file-pill"><FileCode2 size={17}/><span className="file-name">{filename}</span><span className="file-size">{fileSize === null ? '' : formatBytes(fileSize)}</span><button onClick={() => {setFilename(null);setFileSize(null);setNotice('Файл отвязан. Текст в редакторе сохранён.')}} aria-label="Убрать имя файла"><X size={16}/></button></div>}
        <div className="editor-card"><div className="editor-toolbar"><div className="editor-file"><span className="xml-file-icon">&lt;/&gt;</span><span>{filename || 'untitled.xml'}</span><span className="unsaved-dot" title="Редактируется локально"/></div><div className="editor-actions"><button onClick={() => void copy(source, 'XML скопирован')} title="Скопировать XML"><Clipboard size={15}/><span>Копировать</span></button><button onClick={() => {try {const pretty = formatXmlSource(source, maxMb * 1024 * 1024);setSource(pretty);setNotice('XML отформатирован.');} catch {setNotice('Форматирование невозможно: сначала исправьте ошибки синтаксиса. Исходный текст сохранён.')}}} title="Форматировать XML"><Sparkles size={15}/><span>Форматировать</span></button><button onClick={() => saveFile((filename || 'document.xml').replace(/\.[^.]+$/, '') + '.xml', source, 'application/xml;charset=utf-8')} title="Скачать XML"><ArrowDownToLine size={15}/><span>Скачать</span></button></div></div><div className="codemirror-wrap"><CodeMirror value={source} height="360px" theme={dark ? oneDark : 'light'} extensions={extensions} onChange={value => {setSource(value);setResult(null)}} basicSetup={{lineNumbers:true,foldGutter:true,highlightActiveLine:true,autocompletion:true,tabSize:2}} aria-label="Редактор XML"/></div><div className="editor-footer"><span><span className="footer-status-dot"/> XML · UTF-8</span><span>{source.split('\n').length} строк · {formatBytes(new TextEncoder().encode(source).byteLength)}</span></div></div>
        <div className="action-row"><button className="button button-primary" onClick={check} disabled={busy || !source.trim()}>{busy ? <span className="spinner"/> : <CheckCircle2 size={18}/>} {busy ? 'Проверяем XML…' : 'Проверить XML'}<span className="shortcut">⌘ ↵</span></button><button className="button button-ghost" onClick={() => {setSource('');setFilename(null);setFileSize(null);setResult(null);setNotice('Редактор очищен.')}}><RotateCcw size={16}/> Очистить</button><button className="button button-ghost sample-button" onClick={() => {setSource(EXAMPLE);setFilename(null);setFileSize(null);setResult(null);setNotice('Пример XML загружен.')}}>Загрузить пример</button><span className="action-note"><ShieldCheck size={15}/> Локальная проверка</span></div>
      </section>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Закрыть уведомление"><X size={15}/></button></div>}
      <section className="results-section" id="results"><div className="results-heading"><div><div className="section-kicker">ОТЧЁТ</div><h2>Результат проверки</h2></div>{result && <div className="report-actions"><button onClick={() => void copy(reportText, 'Отчёт скопирован')}><Clipboard size={15}/> Копировать отчёт</button><button onClick={() => saveFile('xml-validation-report.json', reportText, 'application/json;charset=utf-8')}><FileJson size={15}/> JSON</button></div>}</div>
        {!result ? <div className="empty-result"><div className="empty-icon"><FileText size={22}/></div><div><strong>Здесь появится результат</strong><p>Нажмите «Проверить XML», чтобы увидеть статус документа и подробности ошибок.</p></div><span className="waiting-tag"><span/> Ожидание проверки</span></div> : <div className={`result-card status-${result.status}`}><div className="result-top"><div className="result-status-icon">{result.status === 'valid' ? <CheckCircle2 size={22}/> : result.status === 'invalid' ? <AlertCircle size={22}/> : <AlertCircle size={22}/>}</div><div className="result-message"><h3>{statusLabel}</h3><p>{result.summary}</p></div><span className="result-time">{new Date(result.checkedAt).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span></div><div className="result-meta"><span><FileCode2 size={15}/>{filename || 'Вставленный XML'}</span><span><FileText size={15}/>{formatBytes(result.bytes)}</span><span><ShieldCheck size={15}/>Локально</span></div>{result.issues.length > 0 && <div className="issues-list"><h4>Детали {result.issues.length === 1 ? 'ошибки' : 'ошибок'}</h4>{result.issues.map((issue, i) => <article className="issue" key={`${issue.message}-${i}`}><div className="issue-title"><span className="issue-number">{i+1}</span><strong>{issue.message}</strong></div><div className="issue-location">{issue.line !== null ? `Строка ${issue.line}${issue.column !== null ? `, столбец ${issue.column}` : ''}` : 'Местоположение недоступно: парсер не предоставил точные координаты'}</div>{issue.snippet && <pre className="issue-snippet">{issue.snippet}</pre>}{issue.suggestion && <p className="issue-suggestion"><Sparkles size={14}/>{issue.suggestion}</p>}</article>)}</div>}</div>}
      </section>
      {history.length > 0 && <section className="history-section"><div className="history-heading"><div><div className="section-kicker">ТЕКУЩАЯ СЕССИЯ</div><h2><History size={19}/> История проверок</h2></div><button className="text-button" onClick={() => setHistory([])}>Очистить историю</button></div><div className="history-list">{history.map(item => <button className="history-item" key={item.id} onClick={() => {setResult(item.result);setNotice(`Показан сохранённый результат: ${item.name}`)}}><span className={`history-indicator ${item.result.status}`}>{item.result.status === 'valid' ? <Check size={14}/> : <AlertCircle size={14}/>}</span><span className="history-name">{item.name}<small>{item.time} · {formatBytes(item.result.bytes)}</small></span><span className={`history-status ${item.result.status}`}>{item.result.status === 'valid' ? 'Корректен' : item.result.status === 'invalid' ? 'Есть ошибки' : 'Сбой'}</span><ChevronDown className="history-chevron" size={16}/></button>)}</div></section>}
      <section className="privacy-strip" id="privacy"><div className="privacy-icon"><ShieldCheck size={22}/></div><div><strong>Ваши данные остаются вашими</strong><p>Файлы анализируются в браузере и не отправляются на сервер. Содержимое XML не сохраняется и не передаётся сторонним сервисам.</p></div><span className="privacy-badge"><Check size={13}/> Без загрузки на сервер</span></section>
      <section className="features"><div className="feature"><span><Code2 size={19}/></span><strong>Настоящий XML-парсер</strong><p>Проверка структуры XML, тегов, атрибутов и пространств имён.</p></div><div className="feature"><span><ShieldCheck size={19}/></span><strong>Конфиденциальность</strong><p>Документы остаются на вашем устройстве на протяжении всей проверки.</p></div><div className="feature"><span><Sparkles size={19}/></span><strong>Удобное форматирование</strong><p>Подсветка синтаксиса, нумерация строк и аккуратное форматирование.</p></div></section>
    </main><footer className="footer"><a className="footer-brand" href="#top"><Code2 size={16}/> XML Validator</a><span>Инструмент для разработчиков · Проверка синтаксиса, не XSD-валидация</span><span>© {new Date().getFullYear()}</span></footer>
  </div>;
}

export default App;
