import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ReactElement } from 'react';
import { useLocale, useSetLocale, useT } from '../i18n/I18nContext';
import type { Locale } from '../i18n/I18nContext';

/** Language codes — intentionally not translated. */
const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  pt: 'PT',
};

/**
 * Compact language switcher for the sidebar footer.
 *
 * Controlled by the I18n context — holds no local state. The group is
 * exclusive + keyboard accessible (roving focus per WAI-ARIA radiogroup
 * semantics, handled by MUI).
 */
export function LanguageToggle(): ReactElement {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();

  return (
    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={locale}
        onChange={(_event, next: Locale | null) => {
          // Exclusive groups can emit null (clicking the active button) —
          // ignore it so a language is always selected.
          if (next) setLocale(next);
        }}
        aria-label={t('lang.toggle_label')}
        sx={{
          backgroundColor: 'var(--surface)',
          borderRadius: '8px',
          '& .MuiToggleButton-root': {
            px: 1.25,
            py: 0.25,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: 'var(--ink-soft)',
            '&.Mui-selected': {
              color: 'var(--ink)',
              background: 'var(--blue-100)',
            },
          },
        }}
      >
        {(Object.keys(LOCALE_LABELS) as Locale[]).map(l => (
          <ToggleButton key={l} value={l} aria-pressed={locale === l}>
            {LOCALE_LABELS[l]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
