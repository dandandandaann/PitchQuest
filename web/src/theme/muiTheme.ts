/**
 * muiTheme — bridges the CSS clay tokens (src/styles/tokens.css) into MUI.
 *
 * MUI 7 defaults are textbook "flat corporate blue": 4px radii, uppercase
 * buttons, elevation shadows. This theme replaces all of that so a MUI
 * <Button>/<Drawer>/<ToggleButton> is indistinguishable from the hand-rolled
 * `.clay-*` primitives.
 *
 * Palette decisions (see tokens.css for the full contrast table):
 *   primary   = --clay-green #22C55E   (the CTA colour)   contrastText = INK
 *   secondary = --clay-blue  #ADD8E6   (the accent)       contrastText = INK
 *   info      = --clay-peach #FDBCB4   (the highlight)    contrastText = INK
 *   error     = --peach-800  #B04A3F   (deep shade of the peach hue)
 *
 * ⚠ White on #22C55E is only 2.3:1 — MUI's `contrastText` MUST stay `--ink`
 *   (5.7:1). If you ever override this, re-run the contrast check first.
 */

import { createTheme } from '@mui/material/styles';

/** Kept as literals (not CSS vars) so MUI's own colour maths can operate on them. */
const palette = {
  ink: '#33272A',
  inkSoft: '#6E5A57',
  inkFaint: '#9A8884',
  white: '#FFFFFF',
  peach: '#FDBCB4',
  peach100: '#FEEBE7',
  peach200: '#FDD8D2',
  peach300: '#FCCBC5',
  peach400: '#F79A8E',
  peach600: '#E4796A',
  peach800: '#B04A3F',
  blue: '#ADD8E6',
  blue100: '#E4F2F8',
  blue300: '#C6E4EF',
  blue400: '#7FBED4',
  blue600: '#4E9CB8',
  blue700: '#35708A',
  blue800: '#2B5A70',
  green: '#22C55E',
  green100: '#DBF7E5',
  green200: '#A6E9BF',
  green600: '#16A34A',
  green700: '#15803D',
  green800: '#146534',
  bg: '#FFFAF8',
} as const;

const FONT_DISPLAY = "'Nunito', 'Segoe UI', system-ui, -apple-system, sans-serif";
const FONT_BODY = "'DM Sans', system-ui, 'Segoe UI', -apple-system, sans-serif";

/** Clay surface recipe, duplicated from tokens.css in literal form. */
const claySurface = '0 5px 12px -4px rgba(51,39,42,0.22), 0 2px 5px -2px rgba(51,39,42,0.10), inset 0 -5px 10px rgba(51,39,42,0.10), inset 0 5px 12px rgba(255,255,255,0.85)';
const claySurfaceRaised = '0 12px 24px -8px rgba(51,39,42,0.26), 0 4px 9px -5px rgba(51,39,42,0.14), inset 0 -5px 10px rgba(51,39,42,0.10), inset 0 5px 12px rgba(255,255,255,0.85)';
const clayRim = 'inset 0 0 0 3px rgba(255,255,255,0.72)';
const clayPressed = 'inset 0 4px 10px rgba(51,39,42,0.22), inset 0 -3px 6px rgba(255,255,255,0.55)';
const clayInnerSoft = 'inset 0 -3px 6px rgba(51,39,42,0.07), inset 0 3px 8px rgba(255,255,255,0.70)';

const EASE_CLAY = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export const muiTheme = createTheme({
  cssVariables: false,

  palette: {
    mode: 'light',
    primary: {
      main: palette.green,
      light: palette.green200,
      dark: palette.green700,
      contrastText: palette.ink, // NOT white — 2.3:1 would fail
    },
    secondary: {
      main: palette.blue,
      light: palette.blue300,
      dark: palette.blue700,
      contrastText: palette.ink,
    },
    info: {
      main: palette.peach,
      light: palette.peach200,
      dark: palette.peach600,
      contrastText: palette.ink,
    },
    success: {
      main: palette.green600,
      light: palette.green200,
      dark: palette.green800,
      contrastText: palette.white,
    },
    warning: {
      main: palette.peach400,
      light: palette.peach200,
      dark: palette.peach600,
      contrastText: palette.ink,
    },
    error: {
      main: palette.peach800,
      light: palette.peach400,
      dark: '#8F3A31',
      contrastText: palette.white,
    },
    text: {
      primary: palette.ink,
      secondary: palette.inkSoft,
      disabled: palette.inkFaint,
    },
    divider: palette.peach300,
    background: {
      default: palette.bg,
      paper: palette.white,
    },
    action: {
      active: palette.ink,
      hover: 'rgba(51,39,42,0.06)',
      selected: 'rgba(253,188,180,0.45)',
      focus: 'rgba(51,39,42,0.12)',
    },
  },

  shape: {
    borderRadius: 18,
  },

  typography: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    htmlFontSize: 16,
    h1: { fontFamily: FONT_DISPLAY, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.12 },
    h2: { fontFamily: FONT_DISPLAY, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.12 },
    h3: { fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 },
    h4: { fontFamily: FONT_DISPLAY, fontWeight: 800, lineHeight: 1.2 },
    h5: { fontFamily: FONT_DISPLAY, fontWeight: 800, lineHeight: 1.25 },
    h6: { fontFamily: FONT_DISPLAY, fontWeight: 800, lineHeight: 1.3 },
    subtitle1: { fontFamily: FONT_DISPLAY, fontWeight: 700, lineHeight: 1.4 },
    subtitle2: { fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: '0.02em' },
    body1: { fontFamily: FONT_BODY, fontWeight: 400, lineHeight: 1.55 },
    body2: { fontFamily: FONT_BODY, fontWeight: 400, lineHeight: 1.55 },
    button: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 800,
      letterSpacing: '0.01em',
      textTransform: 'none',
    },
    caption: { fontFamily: FONT_BODY, lineHeight: 1.45 },
    overline: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 800,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      lineHeight: 1.6,
    },
  },

  transitions: {
    easing: {
      easeInOut: EASE_CLAY,
      easeOut: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      easeIn: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
    duration: {
      shortest: 120,
      shorter: 160,
      short: 200,
      standard: 240,
      complex: 320,
      enteringScreen: 300,
      leavingScreen: 220,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.bg,
          color: palette.ink,
        },
      },
    },

    /* ── Buttons ────────────────────────────────────────────────────────── */
    MuiButtonBase: {
      defaultProps: { disableRipple: true }, // ripple reads as "flat/Material", not clay
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 48, // ≥44px touch target
          borderRadius: 18,
          padding: '10px 24px',
          fontWeight: 800,
          boxShadow: claySurface,
          transition: `transform 220ms ${EASE_CLAY}, box-shadow 220ms ease-out, background-color 220ms ease-out`,
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: claySurfaceRaised,
          },
          '&:active': {
            transform: 'translateY(2px)',
            boxShadow: clayPressed,
          },
          '&.Mui-disabled': {
            boxShadow: clayInnerSoft,
            opacity: 0.5,
          },
        },
        sizeSmall: { minHeight: 38, padding: '6px 16px', fontSize: '0.875rem', borderRadius: 14 },
        sizeLarge: { minHeight: 60, padding: '14px 34px', fontSize: '1.15rem', borderRadius: 24 },
        containedPrimary: { color: palette.ink, boxShadow: `${claySurface}, ${clayRim}` },
        containedSecondary: { color: palette.ink, boxShadow: `${claySurface}, ${clayRim}` },
        containedInfo: { color: palette.ink, boxShadow: `${claySurface}, ${clayRim}` },
        outlined: {
          backgroundColor: palette.white,
          border: 'none',
          color: palette.inkSoft,
          boxShadow: `${claySurface}, inset 0 0 0 2px ${palette.peach300}`,
        },
        text: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
          '&:hover': { boxShadow: 'none', backgroundColor: 'rgba(51,39,42,0.06)' },
          '&:active': { transform: 'none', boxShadow: 'none' },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          width: 44,
          height: 44,
          borderRadius: 14,
          color: palette.ink,
          backgroundColor: palette.white,
          boxShadow: claySurface,
          transition: `transform 220ms ${EASE_CLAY}, box-shadow 220ms ease-out`,
          '&:hover': { backgroundColor: palette.white, transform: 'translateY(-2px)', boxShadow: claySurfaceRaised },
          '&:active': { transform: 'translateY(1px)', boxShadow: clayPressed },
        },
      },
    },

    /* ── Toggle buttons (the note-filter / instrument-key selector) ─────── */
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 8,
          backgroundColor: 'transparent',
          borderRadius: 18,
          padding: 0,
          flexWrap: 'wrap',
        },
        grouped: {
          margin: 0,
          border: 'none',
          borderRadius: '14px !important',
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: '8px 18px',
          fontWeight: 800,
          fontFamily: FONT_DISPLAY,
          textTransform: 'none',
          color: palette.inkSoft,
          backgroundColor: palette.white,
          boxShadow: claySurface,
          transition: `transform 200ms ${EASE_CLAY}, box-shadow 200ms ease-out, background-color 200ms ease-out`,
          '&:hover': {
            backgroundColor: palette.peach100,
            color: palette.ink,
            transform: 'translateY(-2px)',
            boxShadow: claySurfaceRaised,
          },
          '&.Mui-selected': {
            color: palette.ink,
            backgroundColor: palette.green,
            boxShadow: `${claySurface}, ${clayRim}, inset 0 0 0 2px ${palette.green700}`,
            '&:hover': { backgroundColor: palette.green },
          },
        },
      },
    },

    /* ── Navigation (sidebar) ──────────────────────────────────────────── */
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.white,
          backgroundImage: 'none',
          border: 'none',
          boxShadow: '10px 0 34px -22px rgba(51,39,42,0.35)',
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 52,
          margin: '4px 12px',
          padding: '8px 14px',
          borderRadius: 18,
          color: palette.inkSoft,
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          transition: `transform 200ms ${EASE_CLAY}, background-color 200ms ease-out, box-shadow 200ms ease-out`,
          '& .MuiListItemIcon-root': { minWidth: 40, color: 'inherit' },
          '&:hover': {
            backgroundColor: palette.blue100,
            color: palette.ink,
            transform: 'translateX(3px)',
          },
          '&.Mui-selected': {
            backgroundColor: palette.peach,
            color: palette.ink,
            boxShadow: `${claySurface}, ${clayRim}`,
            '&:hover': { backgroundColor: palette.peach },
          },
        },
      },
    },

    MuiListItemIcon: {
      styleOverrides: {
        root: { color: 'inherit' },
      },
    },

    MuiListSubheader: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          fontFamily: FONT_DISPLAY,
          fontSize: '0.6875rem',
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: palette.inkFaint,
          lineHeight: 2.4,
          paddingLeft: 26,
        },
      },
    },

    /* ── Surfaces ──────────────────────────────────────────────────────── */
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 24 },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 24,
          backgroundColor: palette.white,
          boxShadow: claySurface,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          margin: '10px 20px',
          border: 'none',
          height: 3,
          backgroundColor: palette.peach100,
          borderRadius: 999,
        },
      },
    },

    /* ── Inputs ────────────────────────────────────────────────────────── */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: 14,
          backgroundColor: palette.white,
          boxShadow: `${clayInnerSoft}, inset 0 0 0 2px ${palette.peach300}`,
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { boxShadow: `${clayInnerSoft}, inset 0 0 0 2px ${palette.peach400}` },
          '&.Mui-focused': { boxShadow: `${clayInnerSoft}, inset 0 0 0 3px ${palette.blue600}` },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: { fontFamily: FONT_DISPLAY, fontWeight: 800, color: palette.inkSoft },
      },
    },

    /* ── Feedback ──────────────────────────────────────────────────────── */
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          fontFamily: FONT_BODY,
          fontWeight: 500,
          boxShadow: clayInnerSoft,
        },
        standardError: { backgroundColor: palette.peach100, color: palette.peach800 },
        standardSuccess: { backgroundColor: '#EFFBF3', color: palette.green800 },
        standardInfo: { backgroundColor: palette.blue100, color: palette.blue800 },
        standardWarning: { backgroundColor: '#FFF5F3', color: palette.ink },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: palette.ink,
          color: palette.white,
          borderRadius: 12,
          fontFamily: FONT_BODY,
          fontSize: '0.8125rem',
          fontWeight: 500,
          padding: '8px 12px',
        },
        arrow: { color: palette.ink },
      },
    },

    MuiSnackbar: {
      styleOverrides: {
        root: { '& .MuiPaper-root': { boxShadow: claySurfaceRaised } },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 14,
          borderRadius: 999,
          backgroundColor: palette.peach100,
          boxShadow: clayInnerSoft,
        },
        bar: { borderRadius: 999, backgroundColor: palette.green },
      },
    },

    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: { color: palette.green },
      },
    },

    /* ── Overlays ──────────────────────────────────────────────────────── */
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(51,39,42,0.42)', backdropFilter: 'blur(3px)' },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 32,
          boxShadow: claySurfaceRaised,
          padding: 8,
        },
      },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: { backgroundImage: 'none', boxShadow: 'none' },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          borderRadius: 999,
          boxShadow: clayInnerSoft,
        },
      },
    },
  },
});

export default muiTheme;