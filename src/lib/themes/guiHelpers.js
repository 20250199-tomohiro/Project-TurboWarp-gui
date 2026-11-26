import {Theme} from '.';
import AddonHooks from '../../addons/hooks';
import './global-styles.css';

const BLOCK_COLOR_NAMES = [
    // Corresponds to the name of the object in blockColors
    'motion',
    'looks',
    'sounds',
    'control',
    'event',
    'sensing',
    'pen',
    'operators',
    'data',
    'data_lists',
    'more',
    'addons'
];

/**
 * @param {string} css CSS color or var(--...)
 * @returns {string} evaluated CSS
 */
const evaluateCSS = css => {
    const variableMatch = css.match(/^var\(([\w-]+)\)$/);
    if (variableMatch) {
        return document.documentElement.style.getPropertyValue(variableMatch[1]);
    }
    return css;
};

/**
 * @param {Theme} theme the theme
 */
const applyGuiColors = theme => {
    const doc = document.documentElement;
    if (!window.__mirrorAppearanceStorageSync) {
        window.__mirrorAppearanceStorageSync = true;
        window.addEventListener('storage', event => {
            if (event.key === 'project-turbowarp-appearance-v2') window.location.reload();
        });
    }

    const defaultGuiColors = Theme.light.getGuiColors();
    for (const [name, value] of Object.entries(defaultGuiColors)) {
        doc.style.setProperty(`--${name}-default`, value);
    }

    const guiColors = theme.getGuiColors();

    // Apply the same four accent themes provided by TurboWarp.
    try {
        const saved = JSON.parse(localStorage.getItem('project-turbowarp-appearance-v2') || '{}');
        const accentTheme = ['red', 'purple', 'blue', 'rainbow'].includes(saved.accentTheme)
            ? saved.accentTheme
            : 'red';
        const accentThemes = {
            red: {
                primary: '#ff4c4c', transparent: '#ff4d4d59', light: '#ff4d4d26',
                dark: 'hsla(0, 42%, 51%, 1)', motion: '#ff4c4c',
                motionTransparent: '#ff4c4ce6', tertiary: '#cc3333'
            },
            purple: {
                primary: 'hsla(260, 60%, 60%, 1)', transparent: 'hsla(260, 60%, 60%, 0.35)',
                light: 'hsla(260, 60%, 60%, 0.15)', dark: 'hsla(260, 42%, 51%, 1)',
                motion: 'hsla(260, 60%, 60%, 1)', motionTransparent: 'hsla(260, 60%, 60%, 0.9)',
                tertiary: 'hsla(260, 42%, 51%, 1)'
            },
            blue: {
                primary: 'hsla(215, 100%, 65%, 1)', transparent: 'hsla(215, 100%, 65%, 0.35)',
                light: 'hsla(215, 100%, 65%, 0.15)', dark: 'hsla(215, 60%, 50%, 1)',
                motion: 'hsla(215, 100%, 65%, 1)', motionTransparent: 'hsla(215, 100%, 65%, 0.35)',
                tertiary: 'hsla(215, 60%, 50%, 1)'
            },
            rainbow: {
                primary: '#ff4c4c', transparent: '#ff4d4d59', light: '#ff4d4d26',
                dark: 'hsla(0, 42%, 51%, 1)', motion: '#ff4c4c',
                motionTransparent: '#ff4c4ce6', tertiary: '#cc3333'
            }
        };
        const accent = accentThemes[accentTheme];
        Object.assign(guiColors, {
            'looks-secondary': accent.primary,
            'looks-transparent': accent.transparent,
            'looks-light-transparent': accent.light,
            'looks-secondary-dark': accent.dark,
            'motion-primary': accent.motion,
            'motion-primary-transparent': accent.motionTransparent,
            'motion-tertiary': accent.tertiary
        });
        if (accentTheme === 'rainbow') {
            guiColors['menu-bar-background-image'] = 'linear-gradient(90deg, rgba(255, 0, 0, 0.75) 0%, rgba(255, 154, 0, 0.75) 10%, rgba(208, 222, 33, 0.75) 20%, rgba(79, 220, 74, 0.75) 30%, rgba(63, 218, 216, 0.75) 40%, rgba(47, 201, 226, 0.75) 50%, rgba(28, 127, 238, 0.75) 60%, rgba(95, 21, 242, 0.75) 70%, rgba(186, 12, 248, 0.75) 80%, rgba(251, 7, 217, 0.75) 90%, rgba(255, 0, 0, 0.75) 100%)';
        } else {
            delete guiColors['menu-bar-background-image'];
        }
        if (saved.mode === 'light') {
            Object.assign(guiColors, {
                'color-scheme': 'light',
                'ui-primary': 'hsla(215, 100%, 95%, 1)',
                'ui-secondary': 'hsla(215, 75%, 95%, 1)',
                'ui-tertiary': 'hsla(215, 50%, 90%, 1)',
                'ui-modal-background': '#ffffff',
                'ui-modal-foreground': '#575e75',
                'text-primary': '#575e75',
                'menu-bar-background': accent.primary,
                'menu-bar-foreground': '#ffffff',
                'assets-background': '#ffffff',
                'input-background': '#ffffff',
                'popover-background': '#ffffff',
                'page-background': '#ffffff',
                'page-foreground': '#000000'
            });
        } else if (saved.mode === 'dark') {
            Object.assign(guiColors, {
                'color-scheme': 'dark',
                'ui-primary': '#111111',
                'ui-secondary': '#1e1e1e',
                'ui-tertiary': '#2e2e2e',
                'ui-modal-background': '#111111',
                'ui-modal-foreground': '#eeeeee',
                'text-primary': '#eeeeee',
                'menu-bar-background': '#333333',
                'menu-bar-foreground': '#ffffff',
                'assets-background': '#111111',
                'input-background': '#1e1e1e',
                'popover-background': '#1e1e1e',
                'page-background': '#111111',
                'page-foreground': '#eeeeee'
            });
        }
    } catch (e) {
        // Keep TurboWarp's built-in theme if local storage is unavailable.
    }

    for (const [name, value] of Object.entries(guiColors)) {
        doc.style.setProperty(`--${name}`, value);
    }

    // Share the active editor theme with same-origin Project-TurboWarp pages.
    try {
        const sharedThemeKeys = [
            'color-scheme',
            'looks-secondary',
            'looks-secondary-dark',
            'menu-bar-background',
            'menu-bar-foreground',
            'page-background',
            'page-foreground',
            'popover-background',
            'input-background',
            'ui-primary',
            'ui-secondary',
            'ui-black-transparent'
        ];
        const sharedTheme = {};
        for (const key of sharedThemeKeys) {
            if (guiColors[key]) sharedTheme[key] = guiColors[key];
        }
        localStorage.setItem('project-turbowarp-theme', JSON.stringify(sharedTheme));
    } catch (e) {
        // Private browsing or storage restrictions should not break the editor.
    }

    const blockColors = theme.getBlockColors();
    doc.style.setProperty('--editorTheme3-blockText', blockColors.text);
    doc.style.setProperty('--editorTheme3-inputColor', blockColors.textField);
    doc.style.setProperty('--editorTheme3-inputColor-text', blockColors.textFieldText);
    for (const color of BLOCK_COLOR_NAMES) {
        doc.style.setProperty(`--editorTheme3-${color}-primary`, blockColors[color].primary);
        doc.style.setProperty(`--editorTheme3-${color}-secondary`, blockColors[color].secondary);
        doc.style.setProperty(`--editorTheme3-${color}-tertiary`, blockColors[color].tertiary);
        doc.style.setProperty(`--editorTheme3-${color}-field-background`, blockColors[color].quaternary);
    }

    // Some browsers will color their interfaces to match theme-color, so if we make it the same color as our
    // menu bar, it'll look pretty cool.
    let metaThemeColor = document.head.querySelector('meta[name=theme-color]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', evaluateCSS(guiColors['menu-bar-background']));

    // a horrible hack for icons...
    window.Recolor = {
        primary: guiColors['looks-secondary']
    };
    AddonHooks.recolorCallbacks.forEach(i => i());
};

export {
    applyGuiColors
};
