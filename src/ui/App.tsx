import { PLUGIN_NAME, PLUGIN_VERSION, SELECTABLE_EXPORT_TARGETS } from '@/constants';
import { usePluginStore } from '@/ui/store/plugin-store';
import {
  usePluginMessaging,
  postPluginMessage,
  requestSelectionRefresh,
} from '@/hooks/usePluginMessaging';
import { createMessage } from '@/types/messages';
import './styles.css';

function SelectionInfo() {
  const selectionCount = usePluginStore((state) => state.selectionCount);
  const exportableCount = usePluginStore((state) => state.exportableCount);
  const selectedItems = usePluginStore((state) => state.selectedItems);

  if (selectionCount === 0) {
    return (
      <div className="info-banner info-banner--warning">
        <p className="info-banner__title">No selection detected</p>
        <p className="info-banner__text">
          Click a top-level frame, section, component, or instance on the canvas while this
          plugin is open. Selecting layers inside a frame is not enough — select the frame
          itself.
        </p>
      </div>
    );
  }

  if (exportableCount === 0) {
    const unsupported = selectedItems
      .filter((item) => !item.exportable)
      .map((item) => `${item.name} (${item.type})`)
      .join(', ');

    return (
      <div className="info-banner info-banner--warning">
        <p className="info-banner__title">Unsupported selection</p>
        <p className="info-banner__text">
          Selected: {unsupported}. Choose frames, sections, components, or instances instead.
        </p>
      </div>
    );
  }

  const exportableNames = selectedItems
    .filter((item) => item.exportable)
    .map((item) => item.name);

  return (
    <div className="info-banner info-banner--neutral">
      <p className="info-banner__title">
        {exportableCount} exportable screen{exportableCount === 1 ? '' : 's'} selected
      </p>
      <p className="info-banner__text">{exportableNames.join(', ')}</p>
    </div>
  );
}

function ProgressIndicator() {
  const status = usePluginStore((state) => state.status);
  const progress = usePluginStore((state) => state.progress);
  const progressStage = usePluginStore((state) => state.progressStage);

  if (status !== 'loading') return null;

  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress__bar">
        <div className="progress__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="progress__label">{progressStage}</p>
    </div>
  );
}

function StatusMessage() {
  const status = usePluginStore((state) => state.status);
  const summary = usePluginStore((state) => state.summary);
  const error = usePluginStore((state) => state.error);
  const resetStatus = usePluginStore((state) => state.resetStatus);

  if (status === 'success' && summary) {
    return (
      <div className="status status--success" role="status">
        <p className="status__title">Context package exported</p>
        <ul className="status__list">
          <li>{summary.screenCount} screens</li>
          <li>{summary.componentCount} components</li>
          <li>{summary.imageCount} images</li>
          <li>{summary.iconCount} icons</li>
          <li>{summary.exportedAssetCount} exported asset files</li>
          <li>{summary.navigationLinkCount} prototype links</li>
          {summary.skippedAssetCount > 0 ? (
            <li>{summary.skippedAssetCount} assets skipped (see plugin console)</li>
          ) : null}
          <li>{summary.textElementCount} text elements</li>
        </ul>
        <button type="button" className="button button--ghost" onClick={resetStatus}>
          Export again
        </button>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="status status--error" role="alert">
        <p className="status__title">Export failed</p>
        <p className="status__message">{error.message}</p>
        <p className="status__code">Error code: {error.code}</p>
        <details className="status__details-wrap">
          <summary>Debug details</summary>
          <pre className="status__details">{error.details}</pre>
        </details>
        <button type="button" className="button button--ghost" onClick={resetStatus}>
          Try again
        </button>
      </div>
    );
  }

  return null;
}

export function App() {
  usePluginMessaging();

  const projectName = usePluginStore((state) => state.projectName);
  const exportTarget = usePluginStore((state) => state.exportTarget);
  const exportableCount = usePluginStore((state) => state.exportableCount);
  const status = usePluginStore((state) => state.status);
  const setProjectName = usePluginStore((state) => state.setProjectName);
  const setExportTarget = usePluginStore((state) => state.setExportTarget);
  const setLoading = usePluginStore((state) => state.setLoading);

  const isGenerating = status === 'loading';
  const canGenerate =
    exportableCount > 0 && projectName.trim().length > 0 && !isGenerating;

  const handleGenerate = () => {
    setLoading();
    postPluginMessage(
      createMessage('GENERATE_CONTEXT', {
        projectName: projectName.trim(),
        exportTarget,
      }),
    );
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="header__title">{PLUGIN_NAME}</h1>
          <p className="header__subtitle">Export AI-ready design context</p>
        </div>
        <span className="header__version">v{PLUGIN_VERSION}</span>
      </header>

      <main className="main">
        <SelectionInfo />

        <button
          type="button"
          className="button button--ghost selection-refresh"
          disabled={isGenerating}
          onClick={requestSelectionRefresh}
        >
          Refresh selection
        </button>

        <label className="field">
          <span className="field__label">Export target</span>
          <select
            className="field__input field__select"
            value={exportTarget}
            disabled={isGenerating}
            onChange={(event) => setExportTarget(event.target.value as typeof exportTarget)}
          >
            {SELECTABLE_EXPORT_TARGETS.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          <span className="field__hint">
            {SELECTABLE_EXPORT_TARGETS.find((target) => target.id === exportTarget)?.description}
          </span>
        </label>

        <label className="field">
          <span className="field__label">Project name</span>
          <input
            className="field__input"
            type="text"
            value={projectName}
            placeholder="My Design System"
            disabled={isGenerating}
            onChange={(event) => setProjectName(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="button button--primary"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? 'Generating…' : 'Generate Context'}
        </button>

        <ProgressIndicator />
        <StatusMessage />
      </main>

      <footer className="footer">
        Exports a <code>context/</code> folder with README, structured JSON, navigation links, and
        optional platform notes.
      </footer>
    </div>
  );
}
