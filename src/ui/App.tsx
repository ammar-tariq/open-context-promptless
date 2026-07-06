import { PLUGIN_NAME, PLUGIN_VERSION, SELECTABLE_EXPORT_TARGETS } from '@/constants';
import { usePluginStore, useSelectedScreenCount } from '@/ui/store/plugin-store';
import {
  usePluginMessaging,
  postPluginMessage,
  requestScreenListRefresh,
} from '@/hooks/usePluginMessaging';
import { createMessage } from '@/types/messages';
import { beginExportDelivery } from '@/ui/utils/export-delivery';
import './styles.css';

function formatScreenType(type: string): string {
  switch (type) {
    case 'FRAME':
      return 'Frame';
    case 'SECTION':
      return 'Section';
    case 'COMPONENT':
      return 'Component';
    case 'INSTANCE':
      return 'Instance';
    default:
      return type;
  }
}

function ScreenPicker() {
  const pageName = usePluginStore((state) => state.pageName);
  const screens = usePluginStore((state) => state.screens);
  const checkedScreenIds = usePluginStore((state) => state.checkedScreenIds);
  const status = usePluginStore((state) => state.status);
  const toggleScreen = usePluginStore((state) => state.toggleScreen);
  const selectAllScreens = usePluginStore((state) => state.selectAllScreens);
  const clearScreenSelection = usePluginStore((state) => state.clearScreenSelection);

  const isGenerating = status === 'loading';
  const checkedSet = new Set(checkedScreenIds);
  const exportableScreens = screens.filter((screen) => !screen.empty);
  const allExportableSelected =
    exportableScreens.length > 0 &&
    exportableScreens.every((screen) => checkedSet.has(screen.id));
  const selectedCount = exportableScreens.filter((screen) => checkedSet.has(screen.id)).length;

  if (screens.length === 0) {
    return (
      <div className="info-banner info-banner--warning">
        <p className="info-banner__title">No screens on this page</p>
        <p className="info-banner__text">
          Add top-level frames, sections, components, or instances to{' '}
          <strong>{pageName || 'this page'}</strong>, then refresh the list.
        </p>
      </div>
    );
  }

  return (
    <section className="screen-picker" aria-labelledby="screen-picker-title">
      <div className="screen-picker__header">
        <div>
          <h2 id="screen-picker-title" className="screen-picker__title">
            Screens
          </h2>
          <p className="screen-picker__subtitle">
            {pageName || 'Current page'} · {selectedCount} of {exportableScreens.length} selected
          </p>
        </div>
        <div className="screen-picker__actions">
          <button
            type="button"
            className="button button--ghost button--compact"
            disabled={isGenerating || exportableScreens.length === 0 || allExportableSelected}
            onClick={selectAllScreens}
          >
            Select all
          </button>
          <button
            type="button"
            className="button button--ghost button--compact"
            disabled={isGenerating || selectedCount === 0}
            onClick={clearScreenSelection}
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="screen-picker__list" role="listbox" aria-multiselectable="true">
        {screens.map((screen) => {
          const isChecked = checkedSet.has(screen.id);
          const isDisabled = isGenerating || screen.empty;

          return (
            <li key={screen.id} className="screen-picker__item">
              <label
                className={`screen-picker__label${screen.empty ? ' screen-picker__label--disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  className="screen-picker__checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => toggleScreen(screen.id)}
                />
                <span className="screen-picker__meta">
                  <span className="screen-picker__name">{screen.name}</span>
                  <span className="screen-picker__type">
                    {formatScreenType(screen.type)}
                    {screen.empty ? ' · empty' : ''}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
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
          {summary.deduplicatedAssetCount > 0 ? (
            <li>{summary.deduplicatedAssetCount} duplicate assets reused</li>
          ) : null}
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
  const checkedScreenIds = usePluginStore((state) => state.checkedScreenIds);
  const status = usePluginStore((state) => state.status);
  const setProjectName = usePluginStore((state) => state.setProjectName);
  const setExportTarget = usePluginStore((state) => state.setExportTarget);
  const setLoading = usePluginStore((state) => state.setLoading);
  const selectedScreenCount = useSelectedScreenCount();

  const isGenerating = status === 'loading';
  const canGenerate =
    selectedScreenCount > 0 && projectName.trim().length > 0 && !isGenerating;

  const handleGenerate = async () => {
    try {
      const mode = await beginExportDelivery();
      setLoading();
      if (mode === 'zip') {
        usePluginStore.getState().setProgress('Exporting context package…', 0);
      }
      postPluginMessage(
        createMessage('GENERATE_CONTEXT', {
          projectName: projectName.trim(),
          exportTarget,
          selectedScreenIds: checkedScreenIds,
        }),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      usePluginStore.getState().setError({
        code: 'EXPORT_START_FAILED',
        message: 'Could not start export.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
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
        <ScreenPicker />

        <button
          type="button"
          className="button button--ghost screen-refresh"
          disabled={isGenerating}
          onClick={requestScreenListRefresh}
        >
          Refresh screen list
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
        Exports a <code>context/</code> folder when your browser allows it, otherwise downloads{' '}
        <code>context.zip</code>.
      </footer>
    </div>
  );
}
