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

    // Expose the active GUI mode for theme-aware mirror navigation styles.
    // CSS variables alone cannot be reliably used as a selector.
    doc.setAttribute('data-tw-gui-theme', theme.gui);
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

    // Keep the editor's native TurboWarp Theme object as the single source of truth.
    // The built-in Settings menu persists its selection through themePersistance.js.

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
        localStorage.setItem('project-turbowarp-appearance-v2', JSON.stringify({
            mode: theme.gui,
            accentTheme: theme.accent
        }));
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
