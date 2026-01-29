import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { buildApiUrl, fetchTemplates, generateMeme, uploadImage } from './api/client';

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

// PUBLIC_INTERFACE
function App() {
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [uploadState, setUploadState] = useState({
    file: null,
    upload_id: null,
    image_url: null,
    loading: false,
    error: ''
  });

  const [topText, setTopText] = useState('WHEN YOU SHIP');
  const [bottomText, setBottomText] = useState('ON THE FIRST TRY');
  const [previewMode, setPreviewMode] = useState('auto'); // auto | template | upload

  const [generated, setGenerated] = useState({
    loading: false,
    error: '',
    meme_id: null,
    image_url: null
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTemplatesLoading(true);
      setTemplatesError('');
      try {
        const data = await fetchTemplates();
        if (cancelled) return;
        setTemplates(data);
        if (data && data.length && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      } catch (e) {
        if (cancelled) return;
        setTemplatesError(e?.message || 'Failed to load templates.');
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSource = useMemo(() => {
    const hasUpload = !!uploadState.upload_id && !!uploadState.image_url;
    const hasTemplate = !!selectedTemplateId;

    if (previewMode === 'upload') return hasUpload ? 'upload' : hasTemplate ? 'template' : null;
    if (previewMode === 'template') return hasTemplate ? 'template' : hasUpload ? 'upload' : null;

    // auto
    if (hasUpload) return 'upload';
    if (hasTemplate) return 'template';
    return null;
  }, [previewMode, uploadState.upload_id, uploadState.image_url, selectedTemplateId]);

  const previewImageUrl = useMemo(() => {
    if (generated.image_url) return buildApiUrl(generated.image_url);

    if (activeSource === 'upload') return buildApiUrl(uploadState.image_url);
    if (activeSource === 'template') {
      const t = templates.find(x => x.id === selectedTemplateId);
      return t ? buildApiUrl(t.image_url) : '';
    }
    return '';
  }, [generated.image_url, activeSource, uploadState.image_url, templates, selectedTemplateId]);

  const canGenerate = useMemo(() => {
    return activeSource === 'template' || activeSource === 'upload';
  }, [activeSource]);

  // PUBLIC_INTERFACE
  const handleSelectTemplate = templateId => {
    setSelectedTemplateId(templateId);
    setGenerated({ loading: false, error: '', meme_id: null, image_url: null });
  };

  // PUBLIC_INTERFACE
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  // PUBLIC_INTERFACE
  const handleFileChosen = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadState(s => ({ ...s, file: null, upload_id: null, image_url: null, error: 'Please select an image file.' }));
      return;
    }

    // Clear generated output when changing source.
    setGenerated({ loading: false, error: '', meme_id: null, image_url: null });

    setUploadState(s => ({
      ...s,
      file,
      loading: true,
      error: '',
      upload_id: null,
      image_url: null
    }));

    try {
      const res = await uploadImage(file);
      setUploadState(s => ({
        ...s,
        loading: false,
        upload_id: res.upload_id,
        image_url: res.image_url,
        error: ''
      }));
    } catch (err) {
      setUploadState(s => ({
        ...s,
        loading: false,
        upload_id: null,
        image_url: null,
        error: err?.message || 'Upload failed.'
      }));
    } finally {
      // allow selecting same file again
      e.target.value = '';
    }
  };

  // PUBLIC_INTERFACE
  const clearUpload = () => {
    setUploadState({ file: null, upload_id: null, image_url: null, loading: false, error: '' });
    setGenerated({ loading: false, error: '', meme_id: null, image_url: null });
  };

  // PUBLIC_INTERFACE
  const handleGenerate = async () => {
    if (!canGenerate) return;

    setGenerated({ loading: true, error: '', meme_id: null, image_url: null });

    const payload = {
      top_text: topText,
      bottom_text: bottomText
    };

    if (activeSource === 'upload') payload.upload_id = uploadState.upload_id;
    else payload.template_id = selectedTemplateId;

    try {
      const res = await generateMeme(payload);
      setGenerated({ loading: false, error: '', meme_id: res.meme_id, image_url: res.image_url });
    } catch (err) {
      setGenerated({ loading: false, error: err?.message || 'Failed to generate meme.', meme_id: null, image_url: null });
    }
  };

  // PUBLIC_INTERFACE
  const handleDownload = () => {
    if (!generated.meme_id) return;
    const url = buildApiUrl(`/download/${generated.meme_id}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // PUBLIC_INTERFACE
  const handleShare = async () => {
    const url = previewImageUrl;
    if (!url) return;

    // Prefer Web Share API when available; otherwise copy to clipboard.
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Meme',
          text: 'Made with the Retro Meme Generator',
          url
        });
        return;
      }
    } catch {
      // ignore share cancellation/errors
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId), [templates, selectedTemplateId]);

  return (
    <div className="App">
      <div className="retro-bg" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-badge">RG</div>
          <div>
            <div className="brand-title">Retro Meme Generator</div>
            <div className="brand-subtitle">Pick a template or upload your own, then add captions</div>
          </div>
        </div>

        <div className="topbar-actions">
          <a className="chip" href={buildApiUrl('/docs')} target="_blank" rel="noreferrer">
            API Docs
          </a>
          <a className="chip" href={buildApiUrl('/docs/web')} target="_blank" rel="noreferrer">
            Integration
          </a>
        </div>
      </header>

      <main className="layout">
        <section className="panel templates" aria-label="Template gallery">
          <div className="panel-header">
            <h2>Template Gallery</h2>
            <div className="panel-hint">Click a card to select</div>
          </div>

          {templatesLoading && <div className="notice">Loading templates…</div>}
          {templatesError && <div className="notice error">Error: {templatesError}</div>}

          {!templatesLoading && !templatesError && (
            <div className="template-grid" role="list">
              {templates.map(t => {
                const isActive = t.id === selectedTemplateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`template-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTemplate(t.id)}
                    role="listitem"
                    aria-pressed={isActive}
                    title={t.name}
                  >
                    <img alt={t.name} src={buildApiUrl(t.thumbnail_url || t.image_url)} />
                    <div className="template-meta">
                      <div className="template-name">{t.name}</div>
                      <div className="template-size">
                        {t.width}×{t.height}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel editor" aria-label="Meme editor">
          <div className="panel-header">
            <h2>Editor</h2>
            <div className="panel-hint">Upload an image or use the selected template</div>
          </div>

          <div className="editor-grid">
            <div className="card">
              <div className="card-title">1) Choose Image Source</div>

              <div className="source-row">
                <button type="button" className="btn" onClick={handlePickFile} disabled={uploadState.loading}>
                  {uploadState.loading ? 'Uploading…' : 'Upload Image'}
                </button>
                <button type="button" className="btn ghost" onClick={clearUpload} disabled={!uploadState.upload_id && !uploadState.file}>
                  Clear Upload
                </button>

                <div className="select">
                  <label htmlFor="previewMode" className="sr-only">
                    Preview source
                  </label>
                  <select id="previewMode" value={previewMode} onChange={e => setPreviewMode(e.target.value)}>
                    <option value="auto">Auto (prefer upload)</option>
                    <option value="template">Template</option>
                    <option value="upload">Upload</option>
                  </select>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChosen}
                  style={{ display: 'none' }}
                />
              </div>

              {uploadState.file && (
                <div className="upload-meta">
                  <div>
                    <strong>Selected:</strong> {uploadState.file.name} <span className="muted">({formatBytes(uploadState.file.size)})</span>
                  </div>
                  {uploadState.upload_id && (
                    <div>
                      <strong>Uploaded:</strong> <code className="code">{uploadState.upload_id}</code>
                    </div>
                  )}
                </div>
              )}
              {uploadState.error && <div className="notice error">Upload error: {uploadState.error}</div>}
              {!uploadState.upload_id && selectedTemplate && (
                <div className="notice">
                  Using template: <strong>{selectedTemplate.name}</strong>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">2) Add Captions</div>

              <div className="form-row">
                <label htmlFor="topText">Top text</label>
                <input
                  id="topText"
                  value={topText}
                  onChange={e => setTopText(e.target.value)}
                  placeholder="e.g. WHEN YOU SHIP"
                  maxLength={140}
                />
              </div>

              <div className="form-row">
                <label htmlFor="bottomText">Bottom text</label>
                <input
                  id="bottomText"
                  value={bottomText}
                  onChange={e => setBottomText(e.target.value)}
                  placeholder="e.g. ON THE FIRST TRY"
                  maxLength={140}
                />
              </div>

              <div className="actions-row">
                <button type="button" className="btn primary" onClick={handleGenerate} disabled={!canGenerate || generated.loading}>
                  {generated.loading ? 'Generating…' : 'Generate Meme'}
                </button>
                <button type="button" className="btn" onClick={handleDownload} disabled={!generated.meme_id}>
                  Download
                </button>
                <button type="button" className="btn ghost" onClick={handleShare} disabled={!previewImageUrl}>
                  Share / Copy Link
                </button>
              </div>

              {generated.error && <div className="notice error">Generate error: {generated.error}</div>}
              {generated.meme_id && (
                <div className="notice success">
                  Meme generated: <code className="code">{generated.meme_id}</code>
                </div>
              )}
            </div>

            <div className="card preview">
              <div className="card-title">Live Preview</div>

              <div className="preview-frame" aria-label="Meme preview">
                {previewImageUrl ? (
                  <>
                    <img src={previewImageUrl} alt="Meme preview" />
                    {!generated.image_url && (
                      <div className="preview-overlay" aria-hidden="true">
                        <div className="overlay-text top">{(topText || '').toUpperCase()}</div>
                        <div className="overlay-text bottom">{(bottomText || '').toUpperCase()}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="preview-empty">
                    <div className="preview-empty-title">No image selected</div>
                    <div className="preview-empty-subtitle">Choose a template or upload an image to start.</div>
                  </div>
                )}
              </div>

              <div className="preview-foot">
                <div className="muted">
                  Source: <strong>{activeSource || 'none'}</strong>
                  {activeSource === 'template' && selectedTemplate ? ` • ${selectedTemplate.name}` : ''}
                </div>
                <div className="muted">
                  {generated.image_url ? 'Rendered on server' : 'Overlay preview (server renders on Generate)'}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="muted">Tip: set </span>
          <code className="code">REACT_APP_API_BASE_URL</code>
          <span className="muted"> if the backend is on another origin.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
