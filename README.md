# Projector Flipbook Reader

Aplicación cliente para **Android TV / Fire OS (Fire TV Stick 4K)** diseñada para consumir libros desde un servidor **Calibre-Web** local mediante **OPDS**, visualizándolos en proyección de pared o techo con una interfaz de pliego horizontal a dos páginas (16:9) y animación de paso de página (*page-curl* 3D) controlada por D-Pad.

## Características Principales
- **Conectividad OPDS:** Conexión con Calibre-Web y autenticación HTTP Basic.
- **Catálogo TV (5 columnas):** Navegación fluida con D-Pad del control remoto y efecto de foco (escala 1.1x y resalte `#FFB300`).
- **Paginación 16:9 a Doble Página:** División de pantalla en dos columnas virtuales (960×1080 px).
- **Animación 3D Page-Curl:** Transición suave tipo libro físico a 60 fps.
- **Paletas para Proyector:**
  - *Modo Pergamino (Día / Pared):* Fondo `#EADCB9`, Texto `#231A12`.
  - *Modo Noche (Techo / Dormitorio):* Fondo `#0D0D0D`, Texto `#C29B38`.
- **Menú Flotante:** Brillo, tamaño de texto y cambio de paleta con `DPAD_CENTER`.
