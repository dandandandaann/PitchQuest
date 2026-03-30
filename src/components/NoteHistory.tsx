import { useEffect, useRef } from 'react';
import '../App.css';

interface NoteHistoryProps {
    history: string[];
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
        <div className="note-history-container">
            <h3>Last Played Notes</h3>
            <div ref={containerRef} className="note-history-scroll">
                {history.map((note, index) => {
                    // Escape hash symbol for CSS class names
                    const escapedNote = note.replace('#', '\\#');
                    return (
                        <span key={`${note}-${index}`} className={`note-history-item note-${escapedNote}`}>
                            {note}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
