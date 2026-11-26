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

    const defaultGuiColors = Theme.light.getGuiColors();
    for (const [name, value] of Object.entries(defaultGuiColors)) {
        doc.style.setProperty(`--${name}-default`, value);
    }

    const guiColors = theme.getGuiColors();

    // Project-TurboWarp shared appearance preferences override only GUI surfaces/accent.
    try {
        const saved = JSON.parse(localStorage.getItem('project-turbowarp-appearance-v2') || '{}');
        const accent = /^#[0-9a-f]{6}$/i.test(saved.accent || '') ? saved.accent : null;
        if (saved.mode === 'light') {
            Object.assign(guiColors, {
                'color-scheme': 'light',
                'ui-primary': 'hsla(215, 100%, 95%, 1)',
                'ui-secondary': 'hsla(215, 75%, 95%, 1)',
                'ui-tertiary': 'hsla(215, 50%, 90%, 1)',
                'ui-modal-background': '#ffffff',
                'ui-modal-foreground': '#575e75',
                'text-primary': '#575e75',
                'menu-bar-background': 'var(--looks-secondary)',
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
        if (accent) {
            guiColors['looks-secondary'] = accent;
            guiColors['looks-secondary-dark'] = accent;
            guiColors['looks-transparent'] = accent + '59';
            guiColors['looks-light-transparent'] = accent + '26';
            guiColors['motion-primary'] = accent;
            guiColors['motion-primary-transparent'] = accent + 'e6';
            guiColors['motion-tertiary'] = accent;
            guiColors['ui-modal-header-background'] = accent;
            if (saved.mode !== 'dark') guiColors['menu-bar-background'] = accent;
        }
    } catch (e) {
        // Ignore unavailable storage and preserve TurboWarp's selected theme.
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
