import { useState } from 'react';
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

function VariantPicker() {
  const duplicateGroups = usePluginStore((state) => state.duplicateGroups);
  const variantMode = usePluginStore((state) => state.variantMode);
  const canonicalOverrides = usePluginStore((state) => state.canonicalOverrides);
  const status = usePluginStore((state) => state.status);
  const setVariantMode = usePluginStore((state) => state.setVariantMode);
  const setCanonicalOverride = usePluginStore((state) => state.setCanonicalOverride);

  const isGenerating = status === 'loading';

  if (duplicateGroups.length === 0) {
    return null;
  }

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.screens.length, 0);
  const uniqueNames = duplicateGroups.length;

  return (
    <section className="variant-picker" aria-labelledby="variant-picker-title">
      <div className="variant-picker__header">
        <h2 id="variant-picker-title" className="variant-picker__title">
          Duplicate screen names
        </h2>
        <p className="variant-picker__subtitle">
          {totalDuplicates} frames share {uniqueNames} name{uniqueNames === 1 ? '' : 's'}
        </p>
      </div>

      <label className="field">
        <span className="field__label">Variant handling</span>
        <select
          className="field__input field__select"
          value={variantMode}
          disabled={isGenerating}
          onChange={(event) => setVariantMode(event.target.value as typeof variantMode)}
        >
          <option value="canonical">One per name (recommended)</option>
          <option value="all">Export all variants</option>
          <option value="custom">Choose per group</option>
        </select>
        <span className="field__hint">
          {variantMode === 'canonical'
            ? 'Exports the largest variant per name; others listed in catalog/variants.json.'
            : variantMode === 'all'
              ? 'Exports every selected frame, including duplicates.'
              : 'Pick which variant to export for each duplicate name.'}
        </span>
      </label>

      {variantMode === 'custom' ? (
        <ul className="variant-picker__groups">
          {duplicateGroups.map((group) => (
            <li key={group.normalizedName} className="variant-picker__group">
              <span className="variant-picker__group-name">
                {group.name} ({group.screens.length})
              </span>
              <select
                className="field__input field__select"
                disabled={isGenerating}
                value={canonicalOverrides[group.normalizedName] ?? group.screens[0]?.id ?? ''}
                onChange={(event) =>
                  setCanonicalOverride(group.normalizedName, event.target.value)
                }
              >
                {group.screens.map((screen) => (
                  <option key={screen.id} value={screen.id}>
                    {screen.name} · {screen.nodeCount} nodes
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : null}
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

function StarterPromptCard({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = prompt;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="starter-prompt">
      <div className="starter-prompt__header">
        <p className="starter-prompt__title">Next steps</p>
        <ol className="starter-prompt__steps">
          <li>Create or open your app repo and scaffold the project if needed.</li>
          <li>
            Place the exported <code>context/</code> folder at <code>./context</code> in that repo.
          </li>
          <li>Copy the prompt below into Cursor, Claude Code, or your AI agent.</li>
        </ol>
      </div>
      <pre className="starter-prompt__text">{prompt}</pre>
      <button type="button" className="button button--primary button--compact" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy agent prompt'}
      </button>
      <p className="starter-prompt__hint">
        The same prompt is saved in <code>context/PROMPT.md</code>.
      </p>
    </div>
  );
}

function StatusMessage() {
  const status = usePluginStore((state) => state.status);
  const summary = usePluginStore((state) => state.summary);
  const starterPrompt = usePluginStore((state) => state.starterPrompt);
  const error = usePluginStore((state) => state.error);
  const resetStatus = usePluginStore((state) => state.resetStatus);

  if (status === 'success' && summary) {
    return (
      <div className="status status--success" role="status">
        <p className="status__title">Context package exported</p>
        {starterPrompt ? <StarterPromptCard prompt={starterPrompt} /> : null}
        <details className="status__details-wrap">
          <summary>Export summary</summary>
          <ul className="status__list">
            <li>{summary.screenCount} screens exported</li>
            {summary.skippedVariantCount > 0 ? (
              <li>{summary.skippedVariantCount} duplicate variants skipped</li>
            ) : null}
            <li>{summary.mapFileCount} layout maps</li>
            <li>{summary.referenceImageCount} reference images</li>
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
        </details>
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
  const variantMode = usePluginStore((state) => state.variantMode);
  const canonicalOverrides = usePluginStore((state) => state.canonicalOverrides);
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
          variantMode,
          canonicalOverrides: variantMode === 'custom' ? canonicalOverrides : undefined,
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

        <VariantPicker />

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

        {status === 'idle' ? (
          <div className="info-banner info-banner--neutral">
            <p className="info-banner__title">After export</p>
            <p className="info-banner__text">
              Put <code>context/</code> at <code>./context</code> in your app repo. Use{' '}
              <strong>React Native</strong> target when building Expo/RN — it exports typed screen
              structure rules and forbids generic map renderers. <strong>General</strong> asks the
              agent to confirm your stack first.
            </p>
          </div>
        ) : null}

        <ProgressIndicator />
        <StatusMessage />
      </main>

      <footer className="footer">
        Exports a <code>context/</code> package with per-screen maps and reference images. Saves to a
        folder when your browser allows it, otherwise downloads <code>context.zip</code>.
      </footer>
    </div>
  );
}
