import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { useLocale, useSetLocale, useT } from '../i18n/I18nContext';
import type { Locale } from '../i18n/I18nContext';

/** Native names — shown in their own language so users can always find theirs. */
const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
};

/**
 * Language switcher for the sidebar footer.
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
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          p: 2,
          borderRadius: '18px',
          background: 'var(--blue-100)',
          boxShadow: 'var(--clay-inner-soft), inset 0 0 0 2px var(--blue-300)',
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '0.8125rem',
            color: 'var(--ink)',
            mb: 1,
          }}
        >
          {t('lang.toggle_label')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
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
            borderRadius: '10px',
            boxShadow: 'var(--clay-surface)',
            '& .MuiToggleButton-root': {
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
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
    </Box>
  );
}
