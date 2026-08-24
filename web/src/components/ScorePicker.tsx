/**
 * ScorePicker — Stage 6 Task 3.
 *
 * Two load paths:
 *  3a Upload   — <input type="file"> → FileReader → parseMusicXml → onScoreLoaded
 *  3b Library  — fetch manifest.json → render cards → click → fetch XML → onScoreLoaded
 *
 * Uses inline styles to match PracticePage.tsx patterns.
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { parseMusicXml } from '../score/MusicXmlParser';
import { DEFAULT_BPM } from '../audio/TimingEngine';
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
    composer: string;
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

/** Map manifest difficulty to a subtle badge colour. */
function difficultyColor(d: string): string {
    switch (d) {
        case 'easy':   return '#2e7d32';  // green
        case 'medium': return '#1565c0';  // blue
        case 'hard':   return '#c62828';  // red
        default:       return '#555';
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScorePicker({ onScoreLoaded, onClearScore, loadedScore }: ScorePickerProps) {
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
    // 3b — card click: fetch + parse + lift
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
                    composer: entry.composer,
                });
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                setUploadError(`Failed to load "${entry.title}": ${msg}`);
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
                setUploadError('File read failed — got empty result.');
                return;
            }
            try {
                const parsed = parseMusicXml(text, { bpm: DEFAULT_BPM });
                onScoreLoaded(parsed, DEFAULT_BPM, {
                    id: 'upload',
                    title: file.name,
                    composer: 'Uploaded',
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setUploadError(msg);
            }
        };
        reader.onerror = () => setUploadError('File read failed — browser error.');
        reader.readAsText(file);

        // Reset the input so the same file can be re-selected after clearing
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)' }}>

            {/* Loaded score status */}
            {loadedScore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(76,175,80,0.12)', borderRadius: '6px', border: '1px solid rgba(76,175,80,0.3)' }}>
                    <span style={{ fontSize: '0.95rem' }}>
                        Loaded: <strong>{loadedScore.title}</strong> by {loadedScore.composer}
                    </span>
                    <button
                        onClick={onClearScore}
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#ccc' }}
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* BPM edit hint — shown whenever a score is loaded */}
            {loadedScore && (
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.75rem', marginTop: '-0.5rem' }}>
                    Edit BPM if needed — uploaded files don&apos;t auto-detect tempo.
                </p>
            )}

            {/* Upload section */}
            <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.8 }}>Or upload a MusicXML file:</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.musicxml,.mxl"
                    onChange={handleFileChange}
                    style={{ fontSize: '0.85rem' }}
                />
            </div>

            {/* Upload / library error banner */}
            {uploadError && (
                <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: '6px', marginBottom: '1rem', color: '#ef9a9a', fontSize: '0.85rem' }}>
                    {uploadError}
                </div>
            )}

            {/* Library section */}
            <div>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.8 }}>Score library:</p>

                {/* Manifest fetch error */}
                {manifestError && (
                    <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '6px', color: '#ffcc80', fontSize: '0.85rem' }}>
                        Couldn&apos;t load score library — use the upload option above.
                        <span style={{ opacity: 0.6 }}> ({manifestError})</span>
                    </div>
                )}

                {/* Manifest empty */}
                {manifest !== null && manifest.length === 0 && (
                    <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '6px', color: '#ffcc80', fontSize: '0.85rem' }}>
                        No scores available — use the upload option above.
                    </div>
                )}

                {/* Manifest all-null files */}
                {manifest !== null && manifest.length > 0 && manifest.every(e => e.file === null) && (
                    <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '6px', color: '#ffcc80', fontSize: '0.85rem' }}>
                        No scores available — use the upload option above.
                    </div>
                )}

                {/* Library cards */}
                {manifest !== null && manifest.some(e => e.file !== null) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                        {manifest.filter(e => e.file !== null).map(entry => {
                            const isSelected = loadedScore?.id === entry.id;
                            const isLoading = loadingFile === entry.id;
                            return (
                                <button
                                    key={entry.id}
                                    onClick={() => handleCardClick(entry)}
                                    disabled={isLoading}
                                    style={{
                                        background: isSelected ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
                                        border: isSelected ? '1px solid rgba(76,175,80,0.6)' : '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        padding: '0.6rem 0.75rem',
                                        textAlign: 'left',
                                        cursor: isLoading ? 'wait' : 'pointer',
                                        transition: 'background 0.15s, border-color 0.15s',
                                        opacity: isLoading ? 0.6 : 1,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? '#a5d6a7' : '#e0e0e0', lineHeight: 1.3 }}>
                                            {entry.title}
                                        </div>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '0.1rem 0.35rem',
                                            borderRadius: '4px',
                                            background: difficultyColor(entry.difficulty),
                                            color: '#fff',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                        }}>
                                            {formatDifficulty(entry.difficulty)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', opacity: 0.65, marginTop: '0.2rem' }}>
                                        {entry.composer}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>
                                        {entry.bpm} BPM
                                    </div>
                                    {isLoading && (
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>Loading…</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
