import { useState, type ReactElement } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HomeRounded from '@mui/icons-material/HomeRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { useT } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/keys';
import { LanguageToggle } from './LanguageToggle';

const DRAWER_WIDTH = 264;

interface NavItem {
  text: TranslationKey;
  icon: ReactElement;
  path: string;
}

interface NavSection {
  label: TranslationKey | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  { label: null, items: [{ text: 'nav.home', icon: <HomeRounded />, path: '/' }] },
  {
    label: 'section.ear_training',
    items: [{ text: 'nav.tuner', icon: <GraphicEqRounded />, path: '/tuner' }],
  },
  {
    label: 'section.practice',
    items: [{ text: 'nav.practice.score', icon: <SchoolRounded />, path: '/practice' }],
  },
  {
    label: 'section.drills',
    items: [
      { text: 'nav.practice.trumpet', icon: <MusicNoteRounded />, path: '/trumpet-drill' },
      { text: 'nav.practice.trombone', icon: <SwapHorizRounded />, path: '/trombone-drill' },
    ],
  },
];

/** Brand block — a clay tile with a music-note glyph. */
function Brand({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: compact ? 0 : 3,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 44,
          height: 44,
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink)',
          background: 'var(--clay-peach)',
          borderRadius: '16px',
          boxShadow: 'var(--clay-surface), var(--clay-rim-strong)',
        }}
      >
        <AutoAwesomeRounded fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '1.35rem',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          PitchQuest
        </Typography>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontSize: '0.6875rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {t('brand.tagline')}
        </Typography>
      </Box>
    </Box>
  );
}

/** Sidebar nav body — shared by the permanent and temporary drawers. */
function NavBody({ onNavigate }: { onNavigate: (path: string) => void }) {
  const location = useLocation();
  const t = useT();

  // The "Practice / Score practice" section is dev-only — it ships the
  // wait-mode lane that hasn't been validated for end users yet. It is shown
  // when running `npm run dev` and hidden from the production build.
  // (`import.meta.env.DEV` is replaced statically by Vite: true in dev, false
  // in `vite build`.)
  const visibleSections = import.meta.env.DEV
    ? NAV_SECTIONS
    : NAV_SECTIONS.filter(section => section.label !== 'section.practice');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Brand />

      <Box component="nav" aria-label={t('a11y.nav.primary')} sx={{ flex: '1 1 auto', overflowY: 'auto', pt: 1 }}>
        {visibleSections.map((section, i) => (
          <List
            key={section.label ?? `section-${i}`}
            dense
            disablePadding
            sx={{ mb: 1 }}
            subheader={
              section.label ? (
                <ListSubheader component="div" disableSticky>
                  {t(section.label)}
                </ListSubheader>
              ) : undefined
            }
          >
            {section.items.map(item => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => onNavigate(item.path)}
                  selected={location.pathname === item.path}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={t(item.text)}
                    slotProps={{
                      primary: {
                        sx: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem' },
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ))}
      </Box>

      <Box>
        {/* Language switcher — self-wraps in its own p:2 container. */}
        <LanguageToggle />
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
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.8125rem',
                color: 'var(--ink)',
                mb: 0.5,
              }}
            >
              {t('card.mic.title')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--ink-soft)' }}>
              {t('card.mic.body')}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export function SidebarLayout() {
  const t = useT();
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Decorative clay background — purely presentational. */}
      <div className="pq-bg" aria-hidden="true">
        <div className="pq-bg-blocks" />
      </div>

      <a className="clay-visually-hidden" href="#main-content">
        {t('a11y.skip_to_content')}
      </a>

      <div className="pq-shell">
        {/* ─ Mobile top bar ────────────────────────────────────────────── */}
        {isCompact && (
          <AppBar
            className="pq-topbar"
            position="fixed"
            sx={{
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255,250,248,0.86)',
              borderBottom: '2px solid var(--peach-100)',
            }}
          >
            <Toolbar sx={{ minHeight: '68px !important', gap: 1 }}>
              <IconButton
                edge="start"
                aria-label={t('a11y.nav.open_menu')}
                aria-expanded={mobileOpen}
                aria-controls="pq-nav-drawer"
                onClick={() => setMobileOpen(true)}
              >
                <MenuRounded />
              </IconButton>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Brand compact />
              </Box>
            </Toolbar>
          </AppBar>
        )}

        {/* ── Desktop permanent sidebar ──────────────────────────────────── */}
        {!isCompact && (
          <Drawer
            className="pq-sidebar"
            variant="permanent"
            anchor="left"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: '3px solid var(--peach-100)',
              },
            }}
          >
            <NavBody onNavigate={handleNavigate} />
          </Drawer>
        )}

        {/* ── Mobile slide-over sidebar ──────────────────────────────────── */}
        {isCompact && (
          <Drawer
            id="pq-nav-drawer"
            className="pq-sidebar"
            variant="temporary"
            anchor="left"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: Math.min(DRAWER_WIDTH, 300),
                boxSizing: 'border-box',
                borderRadius: '0 28px 28px 0',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, px: 1 }}>
              <IconButton aria-label={t('a11y.nav.close_menu')} onClick={() => setMobileOpen(false)}>
                <CloseRounded />
              </IconButton>
            </Box>
            <NavBody onNavigate={handleNavigate} />
          </Drawer>
        )}

        {/* ── Content ──────────────────────────────────────────────────── */}
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          className="pq-content"
          sx={isCompact ? { pt: 'calc(68px + 20px)' } : undefined}
        >
          <Outlet />
        </Box>
      </div>
    </>
  );
}