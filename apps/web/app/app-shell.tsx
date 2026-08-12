"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import styles from "./app-shell.module.css";

/* Solo rutas que existen. No se añaden destinos futuros —Progreso, Logros,
   Calendario— como botones inertes: un enlace que no lleva a ninguna parte es
   peor que su ausencia. */
type NavItem = {
  href: string;
  label: string;
  /* Símbolo dibujado en SVG inline: tres trazos simples heredando
     `currentColor`, sin librería de iconos ni fuente adicional. */
  icon: ReactNode;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Plan",
    icon: (
      <>
        <path d="M4 5.5h12M4 10h12M4 14.5h8" />
      </>
    ),
  },
  {
    href: "/grafo",
    label: "Grafo",
    icon: (
      <>
        <circle cx="5" cy="5.5" r="2" />
        <circle cx="15" cy="10" r="2" />
        <circle cx="5" cy="14.5" r="2" />
        <path d="M7 6.4 13 9.1M7 13.6 13 10.9" />
      </>
    ),
  },
  {
    href: "/explorar",
    label: "Explorar",
    icon: (
      <>
        <circle cx="10" cy="4.5" r="2" />
        <circle cx="5" cy="15" r="2" />
        <circle cx="15" cy="15" r="2" />
        <path d="M10 6.5v3.5M10 10H5v3M10 10h5v3" />
      </>
    ),
  },
];

/* Coincidencia exacta en la raíz —si no, "/" quedaría activa en todas las
   rutas— y por prefijo de segmento en las demás, para que una futura subruta
   siga marcando su sección. */
function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerTitleId = useId();

  /* Navegar cierra el drawer: sin esto quedaría abierto sobre la vista nueva. */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    /* El foco entra al panel para que el lector de pantalla y el teclado
       queden dentro de la navegación recién abierta. */
    drawerRef.current?.focus();
    /* Mientras el drawer está abierto el fondo no debe desplazarse. Se guarda
       el valor previo en lugar de asumir "" para no pisar un overflow que
       otra capa pudiera haber fijado. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  };

  const navLinks = (variant: "sidebar" | "drawer") =>
    NAV_ITEMS.map((item) => {
      const active = isActiveRoute(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={styles.navLink}
          /* Señal semántica de ruta activa, independiente del color. */
          aria-current={active ? "page" : undefined}
          /* Colapsada, el nombre no se ve: el título accesible lo aporta el
             propio texto del enlace, que sigue en el DOM (ver .navLabel). */
          title={variant === "sidebar" && collapsed ? item.label : undefined}
        >
          <svg
            className={styles.navIcon}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {item.icon}
          </svg>
          <span className={styles.navLabel}>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className={styles.shell} data-collapsed={collapsed ? "true" : undefined}>
      <a className={styles.skipLink} href="#contenido-principal">
        Saltar al contenido
      </a>

      {/* Sidebar de escritorio. `sticky` y no `fixed`: así el documento
          conserva su flujo normal, del que dependen el scroll vertical y el
          `window.scrollTo` con que /explorar hace pan y centra materias. */}
      <aside className={styles.sidebar} aria-label="Navegación principal">
        {/* El control de colapso vive junto a la identidad, no al pie: se ve de
            inmediato y se lee como control DEL panel, separado de los tres
            destinos de navegación. */}
        <div className={styles.sidebarHeader}>
          <span className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              S
            </span>
            <span className={styles.brandName}>Sidera</span>
          </span>

          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setCollapsed((current) => !current)}
            /* Sin texto visible: el nombre accesible lo aporta el `aria-label`,
               que además cambia de semántica según el estado. */
            aria-label={
              collapsed ? "Expandir navegación" : "Contraer navegación"
            }
            aria-expanded={!collapsed}
          >
            <svg
              className={styles.collapseIcon}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5.5 7.5 10l4.5 4.5" />
            </svg>
          </button>
        </div>

        <nav className={styles.nav}>{navLinks("sidebar")}</nav>
      </aside>

      {/* Cabecera compacta de táctil/tablet. También `sticky`, por el mismo
          motivo que la sidebar. */}
      <header className={styles.topBar}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir navegación"
          aria-expanded={drawerOpen}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
          </svg>
        </button>
        <span className={styles.topBrand}>
          <span className={styles.brandMark} aria-hidden="true">
            S
          </span>
          Sidera
        </span>
      </header>

      {drawerOpen ? (
        <>
          {/* El overlay cubre el contenido e intercepta el puntero, de modo que
              nada de detrás —árbol, panel arrastrable, bottom sheet— puede
              activarse por accidente mientras el drawer está abierto. */}
          <div
            className={styles.overlay}
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerTitleId}
            tabIndex={-1}
          >
            <div className={styles.drawerHeader}>
              <span className={styles.brand} id={drawerTitleId}>
                <span className={styles.brandMark} aria-hidden="true">
                  S
                </span>
                <span className={styles.brandName}>Sidera</span>
              </span>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={closeDrawer}
                aria-label="Cerrar navegación"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <nav className={styles.nav} aria-label="Navegación principal">
              {navLinks("drawer")}
            </nav>
          </div>
        </>
      ) : null}

      <div className={styles.content} id="contenido-principal" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
