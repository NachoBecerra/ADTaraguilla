# Iconos del directo, en crudo

Aquí van los SVG tal y como se descargan. **No se sirven desde aquí**: se
convierten a componentes en `src/components/Iconos.tsx`, que es como funcionan
todos los iconos del sitio. Inline heredan el color del texto —el mismo dibujo
sale gris en la cronología y oscuro en un botón— y no cuestan una petición más
en un móvil con mala cobertura desde el campo.

Se guardan igualmente porque el original hace falta el día que haya que
retocar uno, y rehacerlo a partir del componente es más trabajo.

## Lo que hace falta

| Archivo                | Qué es                                    |
|------------------------|-------------------------------------------|
| `falta.svg`            | Falta cometida                            |
| `fuera-de-juego.svg`   | Fuera de juego                            |
| `corner.svg`           | Córner                                    |
| `disparo.svg`          | Disparo a puerta                          |
| `disparo-fuera.svg`    | Disparo fuera                             |
| `penalti.svg`          | Penalti                                   |
| `tiro-libre.svg`       | Solo para partidos ya retransmitidos       |

El gol, las tarjetas y los controles del reloj no hacen falta: los de ahora
funcionan.

## Al descargarlos

- **Todos de la misma librería.** Es lo que más se nota, más que si un dibujo
  suelto es mejor o peor. Mezclados, cantan.
- **De línea, no macizos**, para que peguen con el resto del sitio.
- Cuadrados, mejor con `viewBox="0 0 24 24"`.
- El color da igual: se cambia a `currentColor` al convertirlos.
