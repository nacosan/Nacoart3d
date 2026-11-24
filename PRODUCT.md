# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas que pagan varias suscripciones digitales y comparten algunas con familia, pareja o amigos.
Hay dos papeles, a menudo en la misma persona:

- **Líder:** contrata y paga el plan al proveedor, adelanta el dinero y recupera la parte de los demás.
  Su duda es: "¿quién me debe qué, desde cuándo, y cuánto llevo adelantado?".
- **Miembro:** participa en el plan de otra persona. Su duda es: "¿cuánto me toca, hasta cuándo lo
  tengo pagado y qué me falta por pagar?".

Consultan la app de forma puntual: al llegar una renovación, al recibir o enviar un pago o al
revisar el gasto del mes. La usan en el móvil y en el escritorio.

## Product Purpose

Registrar y organizar lo que cada persona paga por sus suscripciones, personales y compartidas:
- cuánto le cuesta de verdad cada una (su parte, no el precio completo);
- qué periodos tiene cubiertos cada participante;
- qué está pendiente, vencido o por confirmar;
- qué renovaciones se acercan.

Éxito: el líder deja de llevar las cuentas en notas o mensajes, y cada miembro sabe qué debe sin
preguntar.

## Positioning

Separa cuatro cosas que otras herramientas mezclan:
- los periodos que factura el proveedor;
- el coste atribuido a cada participante;
- el calendario de pagos que ha acordado cada uno (mensual o anual);
- el dinero que se ha movido de verdad.

Por eso puede decir con exactitud qué cubre un pago anual, qué es un anticipo, qué es una
previsión y qué es un pago confirmado, sin contar nada dos veces.

## Operating Context

- Aplicación privada, en español, con EUR y formato `es-ES` por defecto.
- Los pagos ocurren fuera de la app (Bizum, transferencia, efectivo). La app solo los registra:
  - el miembro declara "he enviado el pago";
  - el líder confirma o rechaza.
- Las invitaciones se comparten copiando un enlace por cualquier canal; la app no envía mensajes.
- La app no puede verificar si alguien tiene acceso real al servicio. Habla siempre de
  "cobertura económica registrada".

## Capabilities and Constraints

- Suscripciones personales mensuales o anuales, con historial de precios y un calendario de
  renovaciones previstas que se calcula a partir del contrato.
- Grupos con líder, miembros registrados e invitados sin cuenta, plazas con capacidad máxima e
  invitaciones de un solo uso con caducidad.
- Reparto igualitario entre participantes reales o con cuotas fijas, con una regla de céntimos visible.
- Acuerdos de pago por participante, plazos, pagos parciales, saldo a favor y acuerdos a precio pactado
  (con confirmación del líder), y correcciones mediante movimientos auditables.
- **Fuera del MVP:** cobrar dinero, conectar bancos, contratar servicios, cambiar nada en los
  proveedores, guardar credenciales de servicios, un marketplace de cuentas, funciones para eludir
  condiciones de los proveedores y monetizar la propia app.
- **Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS 4 y Supabase
  (Auth y Postgres con RLS). Las reglas del proyecto están en CLAUDE.md.
- El detalle de negocio y el modelo de datos están en `docs/propuesta-mvp.md`.
- **Nombre del producto:** ManagSub (decidido el 2026-11-24). El repositorio sigue llamándose Nacoart3d.

## Evidence on Hand

- No hay usuarios reales, testimonios ni métricas.
- El catálogo de planes reales todavía no está verificado. Hasta que se contraste con las fuentes
  oficiales, cualquier ejemplo de plan o condición comercial es ficticio y se rotula como tal.
- Los datos del prototipo (`src/prototype/`) son ficticios.

## Product Principles

1. **Registrar no es cobrar.** Una previsión nunca es un pago, y un pago declarado nunca es un pago
   confirmado.
2. **El pasado no se reescribe.** Los cambios de precio o de participantes aplican hacia delante.
   Las correcciones son movimientos nuevos, auditables.
3. **Cada persona ve lo suyo.** Un miembro nunca ve importes, deudas, contactos ni movimientos de otros.
4. **Sin doble conteo.** Mi parte, el importe completo y la tesorería del líder son vistas distintas
   y se rotulan como tales.
5. **Honestidad con los datos.** Lo desconocido se muestra como desconocido, las estimaciones se
   rotulan como estimaciones y los estados vacíos no se rellenan con nada inventado.

## Accessibility & Inclusion

- WCAG 2.2 AA: contraste mínimo 4,5:1 en el texto, foco visible, navegación completa con teclado y
  etiquetas en todos los campos.
- Ningún estado depende solo del color: lleva texto, un icono o una marca distinta.
- Los importes son legibles completos, céntimos incluidos, con cifras tabulares.
- Movimiento reducido cuando el sistema lo pide.
