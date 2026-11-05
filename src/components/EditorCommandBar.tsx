import {
  Box,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Hammer,
  Image,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import './EditorCommandBar.css';

export type MenuTriggerId =
  | 'file'
  | 'clear'
  | 'construction'
  | 'tools'
  | 'view'
  | 'export';

export type MenuItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  shortcut?: string;
  checked?: boolean;
  dividerBefore?: boolean;
  title?: string;
};

export type EditorCommandBarProps = {
  /** Menu entries are supplied by the parent so the bar does not own editor behavior. */
  menus?: Partial<Record<MenuTriggerId, readonly MenuItem[]>>;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Used for Save's data/title state; Save remains available when a handler exists. */
  saved?: boolean;
  className?: string;
};

type Command = {
  id: string;
  label: string;
  icon: ReactNode;
  kind: 'action' | 'menu' | 'disabled';
  menuId?: MenuTriggerId;
  width?: 'construction' | 'render';
  disabled?: boolean;
  ariaLabel?: string;
};

const commandGroups: readonly (Command | 'divider')[] = [
  { id: 'file', label: 'File', icon: <FileText />, kind: 'menu', menuId: 'file' },
  { id: 'save', label: 'Save', icon: <Save />, kind: 'action', ariaLabel: 'Save project' },
  { id: 'undo', label: 'Undo', icon: <Undo2 />, kind: 'action', ariaLabel: 'Undo' },
  { id: 'redo', label: 'Redo', icon: <Redo2 />, kind: 'action', ariaLabel: 'Redo' },
  { id: 'clear', label: 'Clear', icon: <Trash2 />, kind: 'menu', menuId: 'clear' },
  'divider',
  { id: 'construction', label: 'Construction', icon: <Hammer />, kind: 'menu', menuId: 'construction', width: 'construction' },
  { id: 'tools', label: 'Tools', icon: <Wrench />, kind: 'menu', menuId: 'tools' },
  { id: 'view', label: 'View', icon: <Eye />, kind: 'menu', menuId: 'view' },
  { id: 'ai-tools', label: 'AI Tools', icon: <Sparkles />, kind: 'disabled', disabled: true },
  'divider',
  { id: 'export', label: 'Export', icon: <Download />, kind: 'menu', menuId: 'export' },
  { id: 'images', label: 'Images', icon: <Image />, kind: 'disabled', disabled: true },
  { id: 'render', label: 'Render', icon: <Box />, kind: 'disabled', disabled: true, width: 'render' },
];

const commandCount = commandGroups.filter((item): item is Command => item !== 'divider').length;

export function EditorCommandBar({
  menus = {},
  onSave,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  saved = false,
  className = '',
}: EditorCommandBarProps) {
  const rootRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);
  const [focusedTrigger, setFocusedTrigger] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const menuId = useId();

  const closeMenu = useCallback(() => {
    setActiveTrigger(null);
    menuRefs.current = [];
  }, []);

  useEffect(() => {
    const dismiss = (event: PointerEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [closeMenu]);

  const isCommandDisabled = (command: Command) => command.disabled
    || (command.id === 'save' && !onSave)
    || (command.id === 'undo' && !canUndo)
    || (command.id === 'redo' && !canRedo);

  const commandAt = (index: number) => {
    let commandIndex = -1;
    for (const entry of commandGroups) {
      if (entry !== 'divider') {
        commandIndex += 1;
        if (commandIndex === index) return entry;
      }
    }
    return undefined;
  };

  const focusTrigger = (index: number, direction = 1) => {
    let next = ((index % commandCount) + commandCount) % commandCount;
    for (let tries = 0; tries < commandCount; tries += 1) {
      const command = commandAt(next);
      if (command && !isCommandDisabled(command)) {
        setFocusedTrigger(next);
        triggerRefs.current[next]?.focus();
        return;
      }
      next = (next + direction + commandCount) % commandCount;
    }
  };

  const focusMenuItem = (start: number, items: readonly MenuItem[], direction = 1) => {
    if (!items.length) return;
    let next = ((start % items.length) + items.length) % items.length;
    for (let tries = 0; tries < items.length; tries += 1) {
      if (!items[next].disabled) {
        menuRefs.current[next]?.focus();
        return;
      }
      next = (next + direction + items.length) % items.length;
    }
  };

  const openMenu = (command: Command, index: number, toggle = true) => {
    if (command.kind !== 'menu' || !command.menuId) return;
    setFocusedTrigger(index);
    if (activeTrigger === command.id) { if (toggle) closeMenu(); return; }
    menuRefs.current = [];
    setActiveTrigger(command.id);
  };

  useLayoutEffect(() => {
    if (!activeTrigger) return;
    const trigger = triggerRefs.current[commandGroups.filter((item): item is Command => item !== 'divider').findIndex((item) => item.id === activeTrigger)];
    const panel = menuPanelRef.current;
    if (!trigger || !panel) return;
    const position = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const margin = 6;
      const left = Math.max(margin, Math.min(triggerRect.left, window.innerWidth - panelRect.width - margin));
      const top = Math.max(margin, Math.min(triggerRect.bottom + 6.578125, window.innerHeight - panelRect.height - margin));
      setMenuPosition({ left, top });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [activeTrigger, menus]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, command: Command, index: number) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); closeMenu(); focusTrigger(index + 1); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); closeMenu(); focusTrigger(index - 1, -1); return; }
    if (event.key === 'Home') { event.preventDefault(); closeMenu(); focusTrigger(0); return; }
    if (event.key === 'End') { event.preventDefault(); closeMenu(); focusTrigger(commandCount - 1, -1); return; }
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && command.kind === 'menu') {
      event.preventDefault();
      openMenu(command, index, false);
      window.setTimeout(() => focusMenuItem(0, command.menuId ? (menus[command.menuId] ?? []) : []), 0);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>, itemIndex: number, items: readonly MenuItem[]) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(itemIndex + (event.key === 'ArrowDown' ? 1 : -1), items, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusMenuItem(event.key === 'Home' ? 0 : items.length - 1, items, event.key === 'Home' ? 1 : -1);
    } else if (event.key === 'Escape') {
      event.preventDefault(); closeMenu(); triggerRefs.current[focusedTrigger]?.focus();
    } else if (event.key === 'Tab') closeMenu();
  };

  let commandIndex = -1;
  return (
    <nav ref={rootRef} className={`editor-command-bar ${className}`.trim()} role="toolbar" aria-label="Project commands">
      {commandGroups.map((entry, entryIndex) => {
        if (entry === 'divider') return <span className="editor-command-bar__divider" aria-hidden="true" key={`divider-${entryIndex}`} />;
        commandIndex += 1;
        const index = commandIndex;
        const isDisabled = isCommandDisabled(entry);
        const items = entry.menuId ? (menus[entry.menuId] ?? []) : [];
        const isOpen = activeTrigger === entry.id;
        const triggerMenuId = `${menuId}-${entry.id}`;
        const title = entry.kind === 'disabled' ? `${entry.label} is not available yet` : entry.id === 'save' && saved ? 'Project is saved' : undefined;
        const onClick = (event: MouseEvent<HTMLButtonElement>) => {
          if (entry.kind === 'menu') { event.preventDefault(); openMenu(entry, index); return; }
          if (isDisabled) return;
          if (entry.id === 'save') onSave?.();
          if (entry.id === 'undo') onUndo?.();
          if (entry.id === 'redo') onRedo?.();
        };
        return (
          <span className={`editor-command-bar__slot${entry.width ? ` editor-command-bar__slot--${entry.width}` : ''}`} key={entry.id}>
            <button
              ref={(element) => { triggerRefs.current[index] = element; }} type="button" className="editor-command-bar__trigger"
              aria-label={entry.ariaLabel ?? entry.label} aria-haspopup={entry.kind === 'menu' ? 'menu' : undefined}
              aria-expanded={entry.kind === 'menu' ? isOpen : undefined} aria-controls={entry.kind === 'menu' ? triggerMenuId : undefined}
              disabled={isDisabled} title={title} tabIndex={!isDisabled && index === focusedTrigger ? 0 : -1}
              onFocus={() => !isDisabled && setFocusedTrigger(index)} onClick={onClick}
              onKeyDown={(event) => onTriggerKeyDown(event, entry, index)}
            >
              <span className="editor-command-bar__icon" aria-hidden="true">{entry.icon}</span>
              <span className="editor-command-bar__label">{entry.label}</span>
              {entry.kind === 'menu' && <ChevronDown className="editor-command-bar__chevron" aria-hidden="true" />}
            </button>
            {entry.kind === 'menu' && isOpen && typeof document !== 'undefined' && createPortal(
              <div ref={menuPanelRef} id={triggerMenuId} className="editor-command-bar__menu" role="menu" aria-label={`${entry.label} menu`} style={{ left: menuPosition.left, top: menuPosition.top }}>
                {items.length === 0 ? <span className="editor-command-bar__empty" role="presentation">No commands available</span> : items.map((item, itemIndex) => (
                  <span className="editor-command-bar__menu-row" key={item.id}>
                    {item.dividerBefore && <span className="editor-command-bar__menu-divider" role="separator" />}
                    <button
                      ref={(element) => { menuRefs.current[itemIndex] = element; }} type="button"
                      role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'} className="editor-command-bar__menu-item"
                      aria-label={item.label}
                      aria-keyshortcuts={item.shortcut?.replace(/\bCtrl\b/g, 'Control').replace(/⇧/g, 'Shift').replace(/\bDel\b/g, 'Delete').replace(/\s+/g, '+')}
                      disabled={item.disabled} aria-disabled={item.disabled || undefined} aria-checked={item.checked !== undefined ? item.checked : undefined}
                      title={item.title} onClick={(event) => {
                        if (item.disabled) return;
                        const clickedItem = event.currentTarget;
                        item.onSelect?.();
                        closeMenu();
                        if (document.activeElement === clickedItem) triggerRefs.current[focusedTrigger]?.focus();
                      }} onKeyDown={(event) => onMenuKeyDown(event, itemIndex, items)}
                    >
                      <span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}
                    </button>
                  </span>
                ))}
              </div>, document.body,
            )}
          </span>
        );
      })}
    </nav>
  );
}
