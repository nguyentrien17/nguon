import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import flagGB from 'flag-icons/flags/4x3/gb.svg';
import flagVN from 'flag-icons/flags/4x3/vn.svg';
import flagCN from 'flag-icons/flags/4x3/cn.svg';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: flagGB },
    { code: 'vi', label: 'Tiếng Việt', flag: flagVN },
    { code: 'zh', label: '中文', flag: flagCN },
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const current = LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) || LANGUAGES[0];

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const selectLanguage = (code) => {
        i18n.changeLanguage(code);
        setOpen(false);
    };

    return (
        <div className="language-switcher" ref={rootRef}>
            <button
                type="button"
                className="language-switcher-trigger"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <img src={current.flag} alt="" className="language-flag" />
                <span>{current.label}</span>
                <ChevronDown size={14} />
            </button>

            {open && (
                <ul className="language-switcher-menu" role="listbox">
                    {LANGUAGES.map((lang) => (
                        <li key={lang.code}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={lang.code === current.code}
                                className={lang.code === current.code ? 'active' : ''}
                                onClick={() => selectLanguage(lang.code)}
                            >
                                <img src={lang.flag} alt="" className="language-flag" />
                                <span>{lang.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
