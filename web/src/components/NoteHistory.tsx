import { useEffect, useRef } from 'react';

interface NoteHistoryProps {
    history: string[];
}

/**
 * Note colours rotate through the four-hue palette, keyed off the *letter* of
 * the note so C is always the same colour as C. Colour is decorative here —
 * the note name is always rendered as text, so nothing is conveyed by colour
 * alone.
 */
const LETTER_ORDER = 'CDEFGAB';
const VARIANT_CLASSES = ['note-chip--peach', 'note-chip--blue', 'note-chip--green', 'note-chip--white'];

function variantFor(note: string): string {
    const letter = note.charAt(0).toUpperCase();
    const idx = LETTER_ORDER.indexOf(letter);
    return VARIANT_CLASSES[(idx === -1 ? 0 : idx) % VARIANT_CLASSES.length];
}

export function NoteHistory({ history }: NoteHistoryProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && history.length > 0) {
            // Auto-scroll to the right end when new notes are added
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
    }, [history]);

    return (
        <section className="note-history" aria-label="Recently detected notes">
            <h3 className="note-history__title">Last played notes</h3>

            {history.length === 0 ? (
                <p className="clay-text">Nothing yet — play a note.</p>
            ) : (
                <div ref={containerRef} className="clay-scroller note-history__scroll">
                    {history.map((note, index) => (
                        <span
                            key={`${note}-${index}`}
                            className={`clay-chip note-chip ${variantFor(note)}`}
                        >
                            {note}
                        </span>
                    ))}
                </div>
            )}
        </section>
    );
}