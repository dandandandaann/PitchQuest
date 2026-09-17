/**
 * ScorePicker — loads a score from the bundled library or a local upload.
 *
 *  3a Upload  — <input type="file"> → FileReader → parseMusicXml → onScoreLoaded
 *  3b Library — fetch manifest.json → render clay tiles → fetch XML → onScoreLoaded
 *
 * Visual language: clay tiles (rounded, double-shadowed, lift on hover) with
 * palette-only badges. Difficulty maps to the palette:
 *   easy → green · medium → blue · hard → peach
 * Each badge also carries its label as text, so difficulty is never conveyed
 * by colour alone.
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import LibraryMusicRounded from '@mui/icons-material/LibraryMusicRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { parseMusicXml } from '../score/MusicXmlParser';
import { DEFAULT_BPM } from '../audio/TimingEngine';
import { useT } from '../i18n/I18nContext';
import type { ExpectedNote } from '../score/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScorePickerSource {
    id: string;
    title: string;
    composer: string;
}

export interface ScorePickerProps {
    /** Called when a score is loaded (library or upload). */
    onScoreLoaded: (expected: ExpectedNote[], bpm: number, source: ScorePickerSource) => void;
    /** Called when the user clears the loaded score. */
    onClearScore?: () => void;
    /**
     * Currently-loaded score metadata.
     * When non-null the picker shows "Loaded: <title> by <composer>" + Clear button.
     */
    loadedScore?: ScorePickerSource | null;
}

// Minimal shape of a manifest entry (subset of what plan §2 describes)
interface ManifestEntry {
    id: string;
    title: string;
    composer: string | null;
    difficulty: string;
    file: string | null;
    bpm: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDifficulty(d: string): string {
    return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Palette-only difficulty badge classes. */
function difficultyClass(d: string): string {
    switch (d) {
        case 'easy':
            return 'clay-badge--green';
        case 'medium':
            return 'clay-badge--blue';
        case 'hard':
            return 'clay-badge--peach';
        default:
            return 'clay-badge--white';
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScorePicker({ onScoreLoaded, onClearScore, loadedScore }: ScorePickerProps) {
    const t = useT();

    // 3b — library state
    const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
    const [manifestError, setManifestError] = useState<string | null>(null);
    const [loadingFile, setLoadingFile] = useState<string | null>(null); // id of entry being fetched

    // 3a — upload error state
    const [uploadError, setUploadError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------------------
    // 3b — fetch manifest on mount
    // -------------------------------------------------------------------------
    useEffect(() => {
        const url = `${import.meta.env.BASE_URL}scores/manifest.json`;
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<ManifestEntry[]>;
            })
            .then(data => setManifest(data))
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                setManifestError(msg);
            });
    }, []);

    // -------------------------------------------------------------------------
    // 3b — tile click: fetch + parse + lift
    // -------------------------------------------------------------------------
    const handleCardClick = (entry: ManifestEntry) => {
        if (entry.file === null) return;
        setLoadingFile(entry.id);
        setUploadError(null);

        const url = `${import.meta.env.BASE_URL}scores/${entry.file}`;
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(xml => {
                const parsed = parseMusicXml(xml, { bpm: entry.bpm });
                onScoreLoaded(parsed, entry.bpm, {
                    id: entry.id,
                    title: entry.title,
                    composer: entry.composer ?? t('components.score_picker.composer_traditional'),
                });
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                setUploadError(
                    t('components.score_picker.load_failed')
                        .replace('{title}', entry.title)
                        .replace('{error}', msg),
                );
            })
            .finally(() => setLoadingFile(null));
    };

    // -------------------------------------------------------------------------
    // 3a — file upload
    // -------------------------------------------------------------------------
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            const text = ev.target?.result;
            if (typeof text !== 'string') {
                setUploadError(t('components.score_picker.read_failed'));
                return;
            }
            try {
                const parsed = parseMusicXml(text, { bpm: DEFAULT_BPM });
                onScoreLoaded(parsed, DEFAULT_BPM, {
                    id: 'upload',
                    title: file.name,
                    composer: t('components.score_picker.composer_uploaded'),
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setUploadError(msg);
            }
        };
        reader.onerror = () => setUploadError(t('components.score_picker.read_failed_browser'));
        reader.readAsText(file);

        // Reset the input so the same file can be re-selected after clearing
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const playable = manifest?.filter(e => e.file !== null) ?? [];
    const libraryUnavailable = manifest !== null && playable.length === 0;

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <section className="clay-card scores" aria-labelledby="scores-title">
            <header className="scores__head">
                <span className="clay-iconplate clay-iconplate--blue">
                    <LibraryMusicRounded />
                </span>
                <div>
                    <h2 id="scores-title" className="clay-title clay-title--h2">
                        {t('components.score_picker.title')}
                    </h2>
                    <p className="clay-text">
                        {t('components.score_picker.subtitle')}
                    </p>
                </div>
            </header>

            {/* ── Currently loaded ─────────────────────────────────────────── */}
            {loadedScore && (
                <div className="clay-notice clay-notice--success scores__loaded" role="status">
                    <CheckCircleRounded sx={{ fontSize: 20, flex: '0 0 auto', marginTop: '2px' }} />
                    <div className="scores__loaded-text">
                        <strong>{loadedScore.title}</strong>
                        <span className="scores__loaded-by">
                            {t('components.score_picker.loaded_by').replace('{composer}', loadedScore.composer)}
                        </span>
                    </div>
                    <button type="button" className="clay-btn clay-btn--sm clay-btn--ghost" onClick={onClearScore}>
                        {t('components.score_picker.clear')}
                    </button>
                </div>
            )}

            {/* ─ Upload ───────────────────────────────────────────────────── */}
            <div className="scores__upload">
                <label className="clay-label" htmlFor="score-file">
                    {t('components.score_picker.upload')}
                </label>
                <div className="clay-file">
                    <UploadFileRounded sx={{ fontSize: 22, color: 'var(--ink-soft)', flex: '0 0 auto' }} />
                    <input
                        id="score-file"
                        ref={fileInputRef}
                        type="file"
                        accept=".xml,.musicxml,.mxl"
                        onChange={handleFileChange}
                    />
                </div>
                <p className="clay-text scores__help">
                    <InfoOutlined sx={{ fontSize: 15, verticalAlign: '-3px', marginRight: '6px' }} />
                    {t('components.score_picker.upload_help').replace('{bpm}', String(DEFAULT_BPM))}
                </p>
            </div>

            {/* ── Errors ───────────────────────────────────────────────────── */}
            {uploadError && (
                <p className="clay-notice clay-notice--error" role="alert">
                    <ErrorOutlineRounded sx={{ fontSize: 20, flex: '0 0 auto' }} />
                    <span>{uploadError}</span>
                </p>
            )}

            {manifestError && (
                <p className="clay-notice clay-notice--warn" role="status">
                    <InfoOutlined sx={{ fontSize: 20, flex: '0 0 auto' }} />
                    <span>
                        {t('components.score_picker.library_error')}
                        <span className="scores__err-detail"> ({manifestError})</span>
                    </span>
                </p>
            )}

            {libraryUnavailable && (
                <p className="clay-notice clay-notice--warn" role="status">
                    <InfoOutlined sx={{ fontSize: 20, flex: '0 0 auto' }} />
                    <span>{t('components.score_picker.library_empty')}</span>
                </p>
            )}

            {/* ── Library grid ─────────────────────────────────────────────── */}
            {playable.length > 0 && (
                <div className="scores__grid" role="group" aria-label={t('components.score_picker.library_aria')}>
                    {playable.map(entry => {
                        const isSelected = loadedScore?.id === entry.id;
                        const isLoading = loadingFile === entry.id;
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                className={`clay-tile score-tile${isSelected ? ' is-selected' : ''}`}
                                onClick={() => handleCardClick(entry)}
                                disabled={isLoading}
                                aria-pressed={isSelected}
                            >
                                <span className="score-tile__top">
                                    <span className="score-tile__title">{entry.title}</span>
                                    <span className={`clay-badge ${difficultyClass(entry.difficulty)}`}>
                                        {formatDifficulty(entry.difficulty)}
                                    </span>
                                </span>

                                <span className="score-tile__composer">
                                    {entry.composer ?? t('components.score_picker.composer_traditional')}
                                </span>

                                <span className="score-tile__foot">
                                    <span className="clay-badge clay-badge--white">{entry.bpm} BPM</span>
                                    {isSelected && (
                                        <span className="score-tile__check">
                                            <CheckCircleRounded sx={{ fontSize: 18 }} />
                                            {t('components.score_picker.loaded')}
                                        </span>
                                    )}
                                    {isLoading && <span className="score-tile__loading">{t('components.score_picker.loading')}</span>}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}