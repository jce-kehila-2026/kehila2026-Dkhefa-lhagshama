import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Check } from 'lucide-react'

/* ────────────────────────────────────────────────────────────
   Menu — reusable accessible dropdown primitive.

   <Menu trigger={...} align="end" label="Account">
     <MenuItem onSelect={...} icon={...} selected>…</MenuItem>
     <MenuItem href="/admin">…</MenuItem>
   </Menu>

   - Opens on click / Enter / Space.
   - role="menu" / role="menuitem"; aria-haspopup, aria-expanded.
   - ArrowUp/Down roving focus, Home/End, Esc + outside-click close.
   - Focus returns to the trigger on close. Closes on route change.
   - align="end" resolves against text direction (RTL/LTR aware).
   - Respects prefers-reduced-motion (handled in menu.css).
─────────────────────────────────────────────────────────────── */

type Align = 'start' | 'end'

export interface MenuProps {
  /** The clickable element that opens the menu. */
  trigger: ReactNode
  /** Anchor side, resolved against text direction. Default 'end'. */
  align?: Align
  /** Accessible label for the menu surface. */
  label: string
  /** <MenuItem> elements. */
  children: ReactNode
}

export interface MenuItemProps {
  /** Invoked when the item is chosen (click / Enter / Space). */
  onSelect?: () => void
  /** Optional leading icon node. */
  icon?: ReactNode
  /** Marks the item as the current selection (renders a check). */
  selected?: boolean
  /** When set, the item renders as a next/link instead of a button. */
  href?: string
  children: ReactNode
}

/* Internal props the parent <Menu> injects onto each <MenuItem>. */
interface InjectedItemProps {
  __index?: number
  /**
   * Stores the item's DOM node in the parent menu's array by index. This is a
   * plain bookkeeping callback (the actual element ref is created inside the
   * item via `setRef`), so it is intentionally not named like a React ref.
   */
  __storeNode?: (index: number, el: HTMLElement | null) => void
  __onActivate?: () => void
  __closeMenu?: () => void
}

export function MenuItem(props: MenuItemProps & InjectedItemProps) {
  const {
    onSelect,
    icon,
    selected,
    href,
    children,
    __index,
    __storeNode,
    __onActivate,
    __closeMenu,
  } = props

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      if (typeof __index === 'number') __storeNode?.(__index, el)
    },
    [__index, __storeNode],
  )

  const handleSelect = useCallback(() => {
    onSelect?.()
    __onActivate?.()
    __closeMenu?.()
  }, [onSelect, __onActivate, __closeMenu])

  const inner = (
    <>
      <span className="menu-item-icon" aria-hidden={icon ? undefined : true}>
        {icon}
      </span>
      <span className="menu-item-label">{children}</span>
      {selected && (
        <span className="menu-item-check" aria-hidden="true">
          <Check size={15} />
        </span>
      )}
    </>
  )

  const sharedProps = {
    role: 'menuitem',
    tabIndex: -1,
    className: `menu-item${selected ? ' is-selected' : ''}`,
    'aria-checked': typeof selected === 'boolean' ? selected : undefined,
  } as const

  if (href) {
    return (
      <Link
        href={href}
        {...sharedProps}
        ref={setRef as (el: HTMLAnchorElement | null) => void}
        onClick={handleSelect}
      >
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      {...sharedProps}
      ref={setRef as (el: HTMLButtonElement | null) => void}
      onClick={handleSelect}
    >
      {inner}
    </button>
  )
}

export default function Menu({ trigger, align = 'end', label, children }: MenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])

  const menuId = useId()

  // Only count concrete element children as focusable items.
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<
    MenuItemProps & InjectedItemProps
  >[]
  const itemCount = items.length

  const storeNode = useCallback((index: number, el: HTMLElement | null) => {
    itemRefs.current[index] = el
  }, [])

  const focusItem = useCallback((index: number) => {
    const el = itemRefs.current[index]
    if (el) el.focus()
  }, [])

  const closeMenu = useCallback(
    (returnFocus = true) => {
      setOpen(false)
      if (returnFocus) triggerRef.current?.focus()
    },
    [],
  )

  const openMenu = useCallback(
    (startIndex = 0) => {
      setOpen(true)
      setActiveIndex(startIndex)
    },
    [],
  )

  // Move focus to the active item whenever the menu opens / active index changes.
  useEffect(() => {
    if (open) focusItem(activeIndex)
  }, [open, activeIndex, focusItem])

  // Outside-click closes (no focus return — the click already moved focus).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, closeMenu])

  // Close on route change so a navigated-away menu never lingers.
  useEffect(() => {
    if (!open) return
    const onRouteChange = () => setOpen(false)
    router.events.on('routeChangeStart', onRouteChange)
    return () => router.events.off('routeChangeStart', onRouteChange)
  }, [open, router.events])

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        openMenu(0)
        break
      case 'ArrowDown':
        e.preventDefault()
        openMenu(0)
        break
      case 'ArrowUp':
        e.preventDefault()
        openMenu(itemCount - 1)
        break
    }
  }

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % itemCount)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + itemCount) % itemCount)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(itemCount - 1)
        break
      case 'Escape':
        e.preventDefault()
        closeMenu(true)
        break
      case 'Tab':
        // Tabbing out dismisses the menu but lets focus flow naturally.
        setOpen(false)
        break
    }
  }

  // Resolve `align` against text direction so 'end' anchors correctly in RTL.
  const dir =
    typeof document !== 'undefined'
      ? (document.documentElement.dir || document.body.dir || 'ltr')
      : 'ltr'
  const isRTL = dir === 'rtl'
  const resolvedSide: 'left' | 'right' =
    align === 'end' ? (isRTL ? 'left' : 'right') : isRTL ? 'right' : 'left'

  // `__storeNode` is a plain bookkeeping callback used by each MenuItem for
  // roving keyboard focus (the real element ref is created inside the item via
  // `setRef`). The React-Compiler-era `react-hooks/refs` rule misreads passing
  // it through cloneElement as "passing a ref to a function"; the pattern is
  // intentional and standard for menu/listbox widgets.
  // eslint-disable-next-line react-hooks/refs
  const decorated = items.map((child, index) =>
    cloneElement(child, {
      __index: index,
      __storeNode: storeNode,
      __closeMenu: () => closeMenu(true),
    }),
  )

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu(0))}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="menu-popover"
          data-side={resolvedSide}
          onKeyDown={onMenuKeyDown}
        >
          {decorated}
        </div>
      )}
    </div>
  )
}
