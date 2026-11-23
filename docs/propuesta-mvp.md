# Propuesta MVP: gestor de suscripciones personales y compartidas

Estado: **aprobada como dirección general** (2026-11-17). Fase 1 autorizada: sistema visual y
prototipo navegable con datos de muestra, sin migraciones ni cambios remotos.
Revisión 2: incorpora las correcciones del usuario sobre acuerdos de pago, renovaciones, anticipos,
privacidad, diseño, autenticación, historial y bajas.

## 0. Punto de partida verificado

**Repositorio.** Next.js 16.4 (App Router), React 19.3, TypeScript estricto, Tailwind 4, `@supabase/ssr`.
Ya existen clientes de navegador y servidor, el proxy con `getClaims()` y el diagnóstico de `demo_items`.
No hay pruebas ni un sistema visual propio: `globals.css` es el de la plantilla y la fuente es Geist.

**Supabase (`ebwjmkzoauxtzssfegyc`), consultado en solo lectura:**

- `public` solo contiene `demo_items` (2 filas, RLS activado). Hay una migración aplicada: `create_demo_items`.
- `auth.users` tiene 0 usuarios.
- Extensiones instaladas: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`.
- Disponibles sin instalar: `pgtap` (pruebas SQL), `pg_cron` (tareas programadas) y `citext`.

**Herramientas de diseño cargadas y leídas:**

- `impeccable:impeccable` v4.7.0. Hay una versión más nueva (v4.9.1); actualizarla ejecuta `npx impeccable update`.
- `taste-skill:design-taste-frontend` v2.1.4, en su modo de pantallas de aplicación (`app-screens.md`).
- `modern-web-guidance`. Guías consultadas: `capture-location-agnostic-data`, `responsive-table`,
  `dialog`, `forms`, `dark-mode` y `navigation-drawer`.

---

## 1. Resumen funcional

Una aplicación privada, en español, para llevar el control de lo que cada persona paga por sus suscripciones.

- **Suscripciones personales.** Cada usuario registra las suyas: importe, periodicidad, renovación,
  estado y fin del periodo pagado. También registra los pagos reales que hace y ve las previsiones
  de renovación, siempre separadas de esos pagos.
- **Suscripciones compartidas (grupos).** El líder comparte una suscripción con otros participantes.
  Pueden ser usuarios registrados (entran con su cuenta mediante una invitación) o invitados sin cuenta.
  El líder define el reparto. Cada periodo se guarda como una fotografía fija de las cuotas.
- **Pagos y cobertura.** El líder registra pagos al proveedor y cobros a los participantes. El miembro
  puede declarar "he enviado el pago" y solo el líder lo confirma. Cada cobro se asigna a cuotas
  concretas. La cobertura es económica: indica hasta qué fecha está pagada la parte de cada uno.
- **Paneles.**
  - **Mi parte:** mi gasto, en coste mensual y anual equivalente, y mis pagos reales.
  - **Importe completo:** el precio total de los planes a los que pertenezco, que no es mi gasto.
  - **Grupos que lidero:** cuánto he pagado al proveedor, cuánto he cobrado, qué está pendiente y mi adelanto neto.
- **Lo que no hace.** No cobra, no conecta bancos, no contrata servicios, no modifica nada en los
  proveedores, no guarda credenciales de servicios externos y no envía correos de recordatorio en el MVP.

---

## 2. Supuestos y decisiones de negocio propuestas

Cada punto es un valor predeterminado. Si estás de acuerdo, no hace falta que respondas a ninguno.

### 2.1 Entidades y vocabulario

| Término en la UI | Qué es |
|---|---|
| **Servicio** | El proveedor o producto (por ejemplo, "Spotify"). Puede ser del catálogo o personalizado (privado de quien lo crea). |
| **Plan** | La oferta comercial de un servicio en un mercado (por ejemplo, "Premium Familiar", ES). Sus datos (precio, capacidad, condiciones) se guardan en **versiones** con fecha de verificación. |
| **Suscripción** | Lo que una persona tiene contratado. Puede ser **personal** o **compartida**. |
| **Grupo** | El nombre en la UI de una suscripción compartida. No es una tabla aparte: es una suscripción en modo compartido con participantes. Una suscripción personal se puede convertir en compartida. |
| **Participante** | Un registrado (vinculado a `auth.users`) o un invitado sin cuenta. Tiene un rol (líder o miembro) y un estado (activo, salió o archivado). |
| **Periodo del proveedor** | Un intervalo de facturación del proveedor, `[inicio, fin)`. |
| **Coste atribuido** | La parte del coste de un periodo que corresponde a un participante. Es la fotografía del reparto, no una deuda con fecha. |
| **Acuerdo de pago** | Cómo y cuándo paga un participante: mensual o anual, día de vencimiento y, opcionalmente, un precio pactado. Define sus vencimientos reales, sea cual sea el calendario del proveedor. |
| **Plazo** | Un vencimiento concreto del acuerdo de pago. Agrupa los costes atribuidos que cubre (1 si el acuerdo es mensual, 12 si es anual sobre un proveedor mensual). Lo que se debe y cuándo se mide en plazos. |
| **Movimiento** | Dinero real: un pago al proveedor, un cobro, una devolución o un ajuste. |
| **Asignación** | La parte de un movimiento que se aplica a un plazo concreto. |
| **Saldo a favor** | Dinero confirmado que aún no se ha asignado a ningún plazo. Sigue siendo dinero, no periodos. |

### 2.2 Dinero, monedas y fechas

- **Importes en céntimos.** Se guardan como enteros (`bigint`), con la moneda ISO al lado (`char(3)`).
  Nunca se usan números de coma flotante, ni en la base de datos ni en TypeScript. Todo el formateo
  pasa por `Intl.NumberFormat('es-ES', { style: 'currency' })`.
- **Monedas.** EUR por defecto. Cada suscripción tiene una sola moneda. Los totales se agrupan por moneda
  y nunca se suman monedas distintas. En el MVP se admiten EUR, USD y GBP; los totales en otra moneda
  aparecen en una línea separada.
- **Fechas de facturación.** Son fechas de calendario (`date` en Postgres, cadena `YYYY-MM-DD` en TypeScript).
  Los instantes de auditoría son `timestamptz`. La zona por defecto es `Europe/Madrid` y se identifica
  siempre por su nombre IANA.
- **Intervalos semiabiertos.** Un periodo va de `[inicio, fin)`: incluye el día de inicio y excluye el de fin.
  En la UI, "cubierto hasta" muestra el último día incluido (fin − 1 día).
- **Fin de mes y años bisiestos.** Cada periodo se calcula desde la fecha ancla, nunca encadenando sumas:
  `ancla + k meses`. Postgres ajusta al último día del mes, así que si el ancla es el 31 de enero,
  los periodos empiezan el 29 de febrero (en 2024), el 31 de marzo, el 30 de abril, etc. Un plan anual
  con ancla el 29 de febrero renueva el 28 de febrero los años que no son bisiestos.
  Así la fecha no se desplaza mes a mes.
- **Sin `Temporal` en el navegador.** Modern Web Guidance indica que `Temporal` tiene disponibilidad
  limitada: Safari no lo soporta y necesitaría un polyfill. Propongo que la aritmética de fechas viva en
  SQL, y que TypeScript solo compare y formatee cadenas ISO de fecha. Así no hace falta ninguna dependencia.

### 2.3 Equivalentes y porcentajes

- **Coste mensual equivalente.** Un plan mensual cuenta su importe; uno anual, el importe dividido entre 12,
  redondeado al céntimo en un único sitio. Se rotula siempre "equivalente": no es dinero cobrado ese mes.
- **Porcentaje de una suscripción.** Es su mensual equivalente (mi parte) entre el total mensual
  equivalente con los mismos filtros. Si el denominador es 0, se muestra "—".
- **Presupuesto.** Es opcional, mensual y en la moneda del perfil. El porcentaje respecto al presupuesto
  solo aparece si hay presupuesto.
- **Proyecciones.** Siempre van separadas del gasto registrado: tienen otro rótulo y otro trazo
  (discontinuo en los gráficos).

### 2.4 Suscripciones personales

- **Estados.** `activa`, `prueba`, `pausada` y `cancelada`.
  - `cancelada` guarda la fecha de cancelación y, por separado, el **fin del periodo pagado**:
    la suscripción sigue "pagada hasta" esa fecha.
  - Mientras está pausada o después de cancelarse no se prevén renovaciones.
- **Tres listas separadas: previsiones, pendientes de registrar e historial real.**
  - **Previsiones.** El calendario de renovaciones se calcula a partir del contrato
    (fecha ancla + k periodos, §2.2). Sigue avanzando aunque no se haya registrado ningún pago:
    la "próxima renovación" es la primera fecha del calendario igual o posterior a hoy.
    Se detiene al pausar, o al cancelar a partir del fin del periodo pagado.
  - **Renovaciones sin pago registrado.** Son las fechas pasadas del calendario sin ningún movimiento
    asociado. Se muestran como "Sin pago registrado". No son una deuda, solo un aviso de que falta
    anotar el pago, y nunca se convierten solas en un pago.
  - **Historial real.** Solo los movimientos que alguien ha registrado. Un pago nunca se marca como
    confirmado de forma automática.
  - "Registrar pago" en una renovación crea el movimiento y lo enlaza con esa fecha del calendario.
    El calendario no cambia.
- **Historial de precios.** Cada precio tiene una fecha de entrada en vigor. El precio contratado puede
  diferir del catálogo y cambiar el catálogo nunca lo toca.
- **Lo que no se pide.** Datos de tarjeta, datos bancarios ni contraseñas del servicio. Solo se guarda
  la URL de gestión o cancelación.

### 2.5 Grupos, plazas y capacidad

- **Borrador o activo.** Un grupo se crea en **borrador**, solo con el líder, y pasa a **activo** al tener
  2 participantes activos. El estado se calcula a partir de los participantes; no se guarda.
- **Capacidad máxima.** Sale del plan si está verificada. Si no, el líder introduce un máximo manual,
  que se marca como **no verificado**. Un grupo no se puede activar sin un máximo conocido.
  Si el plan indica que el titular cuenta en el límite, el líder ocupa una plaza.
- **Plazas.** Se distinguen tres tipos:
  - **Ocupadas:** participantes activos, invitados incluidos.
  - **Reservadas:** invitaciones pendientes que reservan plaza y no han caducado.
  - **Libres:** el resto.
  - Ocupadas + reservadas nunca pueden superar el máximo.
- **Invitaciones pendientes.** No generan cuota ni gasto personal hasta que se aceptan.
  Por defecto **reservan plaza 7 días** y luego caducan.
- **Comprobación atómica.** Las operaciones que añaden participantes (aceptar una invitación, añadir un
  invitado, reactivar a alguien) bloquean la fila de la suscripción (`SELECT … FOR UPDATE`), cuentan las
  plazas y escriben, todo en la misma transacción. Si dos personas aceptan la última plaza a la vez,
  una de las dos recibe "El grupo está completo".
- **Sin duplicados.** Hay un índice único parcial: un `user_id` solo puede tener una participación activa
  por suscripción, y solo puede haber un líder activo por suscripción.
- **Salir y archivar.** Un participante que sale o se archiva cambia de estado, pero conserva sus cuotas
  y movimientos.
- **El líder no puede salir.** Primero tiene que transferir el liderazgo. El nuevo líder debe aceptar,
  y la transferencia caduca a los 7 días.
- **Vincular un invitado a una cuenta.** El líder genera una invitación vinculada a ese invitado.
  Al aceptarla, la participación existente recibe el `user_id` y conserva su historial.
  - Si esa persona ya tenía una participación activa en el grupo, la vinculación se rechaza y se avisa
    al líder para que archive una de las dos.
  - Nunca se vincula automáticamente por coincidencia de nombre o email.

### 2.6 Invitaciones

- **Token.** Son 32 bytes aleatorios de `gen_random_bytes` (pgcrypto), codificados en base64url.
  En la base de datos solo se guarda su `sha256`. El enlace completo se muestra una sola vez para
  copiarlo y no se envía ningún correo.
- **Uso y vida.** Son de un solo uso, con caducidad (7 días por defecto, editable) y se pueden revocar.
- **Aceptación.** Exige iniciar sesión. Antes de aceptar se muestra el servicio, el grupo, el líder
  (por su nombre visible), la cuota estimada, desde qué periodo empieza y las condiciones del plan.
- **Destinatario.** Una invitación puede limitarse a un email. Si es así, se compara con el email
  verificado de la sesión.
- **Privacidad.** La vista previa la sirve una función que solo devuelve datos de esa invitación.
  Nunca se exponen listados de usuarios ni de correos.

### 2.7 Reparto del coste

- **Modo igualitario.** Usa los participantes activos que ocupan plaza al empezar el periodo, invitados
  incluidos, y nunca el máximo de plazas. A cada uno se le atribuye `floor(T / n)` céntimos.
  Los céntimos sobrantes (como mucho n − 1) van a quien se elija al crear el grupo:
  por defecto el líder, o si no participa, el participante más antiguo. Esta regla aparece en el
  formulario de creación y siempre a la vista en el reparto ("El líder asume 1 céntimo de
  redondeo"). Cambiarla aplica desde el siguiente periodo.
  - Ejemplo: 24,00 € entre 6 son 4,00 € cada uno.
  - Ejemplo: 10,00 € entre 3 son 3,33 €, 3,33 € y 3,34 € (este último, el líder).
- **Modo de cuotas fijas.** El líder fija la cuota de cada miembro y su propia parte es el resto
  (`T − Σ cuotas`). Si el resto sale negativo, se rechaza con un mensaje que explica cuánto sobra.
- **Plazas vacías.** No se reparten entre nadie. La UI muestra el coste por plaza solo como referencia.
- **Fotografía de cada periodo.** Cuando un periodo empieza, se guarda su precio y sus cuotas.
  Los cambios de precio o de participantes aplican **desde el siguiente periodo** y no recalculan nada
  del pasado.
- **Entrar a mitad de periodo.** Por defecto se empieza en el siguiente periodo. Como alternativa, el líder
  puede acordar una **cuota inicial**: es una cuota extra en el periodo actual, que reduce en la misma
  cantidad la parte del líder (el total sigue cuadrando). Se muestra antes de confirmarla.
  En el MVP no hay prorrateo.
- **La parte del líder.** Es su gasto económico, no una deuda con nadie. Se considera cubierta por
  sus pagos al proveedor.

### 2.8 Pagos, acuerdos, plazos y cobertura

- **Cuatro capas separadas.** Cada una tiene su propia tabla (§3.1):
  1. **Periodos del proveedor:** cuándo factura el proveedor y cuánto. Generan la fotografía del reparto.
  2. **Costes atribuidos:** la parte de cada participante en cada periodo.
  3. **Calendario acordado de pagos:** el acuerdo de cada participante (mensual o anual, día de
     vencimiento) genera sus **plazos**, que son sus vencimientos reales. Un plazo cubre un conjunto
     concreto de costes atribuidos.
  4. **Movimientos reales:** el dinero que se mueve, en su fecha real, asignado a plazos.
- **Ejemplo.** Proveedor mensual y miembro con acuerdo anual:
  - Ese miembro tiene **un solo plazo al año** (por ejemplo, 48,00 € con vencimiento el 5 de marzo),
    que cubre 12 costes atribuidos de 4,00 €.
  - Si no lo paga, la app muestra **un plazo anual vencido**, nunca doce deudas mensuales.
  - Si lo paga, hay un único movimiento asignado a ese plazo, nunca doce cobros.
- **Importe de un plazo.** Por defecto es la suma de los costes atribuidos que cubre, con el precio
  vigente al generarse el plazo.
  - Los costes de periodos aún no fotografiados son una **estimación**. Si al fotografiar un periodo
    cubierto el coste resulta distinto (sube el precio o cambian los miembros), la diferencia aparece
    como **ajuste pendiente** del participante, a la vista y con su motivo. Nadie la asume en silencio.
- **Cambiar de acuerdo** (de mensual a anual o al revés). Aplica desde el siguiente plazo.
  El acuerdo anterior y sus plazos se conservan.
- **Tipos de movimiento.** Pago al proveedor, cobro de un participante, devolución a un participante y ajuste.
- **Estados de un movimiento.**
  - `declarado`: lo indica el miembro.
  - `confirmado`: solo el líder puede confirmar, y nunca un movimiento declarado por él mismo como miembro.
  - `rechazado`.
  - `anulado`: mediante un movimiento de anulación enlazado.
  - Los movimientos confirmados nunca se editan ni se borran; las correcciones son movimientos nuevos y
    quedan auditadas.
- **Estado de un plazo.** Se calcula, no se guarda:
  - `pendiente`: aún no vencido y sin pagar del todo.
  - `parcialmente pagado`: 0 < asignado confirmado < importe.
  - `pagado`: asignado confirmado = importe.
  - `vencido`: no está pagado y hoy es posterior a la fecha de vencimiento + los días de gracia.
  - Un movimiento **declarado** ("he enviado el pago") no cambia el estado del plazo. El plazo muestra
    aparte "1 pago por confirmar".
  - El día de vencimiento lo fija el acuerdo de cada participante. Los días de gracia
    (7 por defecto) se configuran por grupo.
- **Asignación de un cobro.** Al confirmarlo, se propone asignarlo a los plazos más antiguos sin pagar
  (el líder puede editar la propuesta). Lo que sobra queda como **saldo a favor**.
- **Dos tipos de anticipo, que nunca se mezclan:**
  1. **Saldo monetario.** Dinero confirmado sin asignar, para plazos futuros.
     - Se aplica a cada plazo nuevo cuando vence, por el importe que tenga ese plazo, y la asignación
       queda registrada y visible ("Aplicado desde saldo a favor").
     - No fija precios: si el precio sube, el saldo alcanza para menos plazos.
     - La UI muestra el saldo en euros y, aparte, una estimación de cuántos plazos cubriría al precio
       actual, rotulada como estimación.
  2. **Acuerdo de cobertura a precio pactado.** Deja cubiertos periodos concretos a un importe fijo.
     - Ejemplo: "marzo 2026 a febrero 2027 por 48,00 €".
     - Requiere confirmación expresa del líder, después de ver una explicación de qué pasa si el coste
       real cambia: quién asume la diferencia (el líder o un ajuste para el participante), elegido
       al crear el acuerdo.
     - Sin esa confirmación no existe el precio pactado: el plazo anual se comporta como en el punto
       anterior, con ajustes visibles si el coste cambia.
  - Los acuerdos, sus plazos y los movimientos se conservan siempre, también los cerrados o sustituidos.
- **Cálculos por participante:**
  - importe exigible hasta hoy (plazos vencidos);
  - pagado y confirmado;
  - pendiente vencido;
  - pagos declarados por confirmar;
  - saldo a favor;
  - ajustes pendientes;
  - próximo vencimiento según su acuerdo;
  - "cubierto hasta": último día del último periodo del proveedor cuyo coste atribuido está cubierto
    por plazos pagados del todo, sin huecos desde el inicio de la participación.
  - Un pago parcial nunca marca un periodo como cubierto.
  - Se rotula como **cobertura económica registrada**: la app no puede verificar el acceso real
    al servicio.
- **Tesorería del líder,** por grupo y por moneda:
  - Pagado al proveedor: pagos al proveedor confirmados.
  - Cobrado: cobros confirmados menos devoluciones.
  - Coste atribuido sin cubrir: la suma de los costes atribuidos a los demás hasta el periodo actual
    que todavía no están cubiertos. Incluye lo vencido, lo que aún no vence y lo que espera
    confirmación, cada parte con su desglose.
  - Cobrado por adelantado: lo que los demás han pagado por encima de su coste atribuido hasta hoy
    (plazos anuales que cubren periodos futuros y saldo a favor).
  - Adelanto neto: pagado − cobrado.
  - Mi parte económica: la suma de los costes atribuidos al líder.
  - Invariante comprobada en las pruebas: adelanto neto = mi parte + coste atribuido sin cubrir −
    cobrado por adelantado (cuando los pagos al proveedor coinciden con los periodos). Si no se cumple,
    la diferencia aparece como "diferencia sin explicar" y no se esconde.

### 2.9 Paneles sin doble conteo

- **Mi parte.**
  - Suscripciones personales: el importe completo.
  - Suscripciones compartidas: solo mi cuota (en las que lidero, mi parte económica).
  - El precio completo de un grupo nunca se suma.
- **Pagos reales del mes.** Muestra lo que salió de mi bolsillo (pagos personales, mis cobros enviados y
  confirmados, y mis pagos al proveedor como líder), menos los reembolsos recibidos de los miembros.
  - Resultado: **gasto neto real**, con el desglose a la vista.
  - Los reembolsos no son ingresos ni gastos nuevos.
- **Importe completo.** Cuenta cada suscripción una sola vez, aunque yo sea líder y miembro de cosas
  distintas. Rótulo fijo: "No es tu gasto personal".
- **Mismos números en todo el panel.** Las tarjetas y los gráficos salen de la misma consulta y los mismos
  filtros. Una sola función de agregación alimenta el panel entero.

### 2.10 Catálogo inicial (España)

- **Pocos planes y bien contrastados.** Se siembran consultando la página oficial de cada uno justo antes
  de crear la migración. Candidatos:
  - Spotify Premium (Individual, Duo, Familiar).
  - YouTube Premium (Individual, Familiar).
  - Netflix (Estándar con anuncios, Estándar, Premium).
  - Disney+.
  - Microsoft 365 (Personal, Familia).
  - Apple One o iCloud+.
- **Datos desconocidos.** Cualquier dato no verificable queda vacío y se muestra como "Desconocido".
- **Condiciones.** Cada plan guarda sus condiciones (convivencia, familia, mismo hogar). La app las
  muestra al crear el grupo y al aceptar una invitación, y no ofrece nada para eludirlas.
- **Logotipos (cambio del 2026-11-24, a petición del usuario).** Los servicios conocidos muestran su
  logotipo en su color de marca (trazos de Simple Icons, CC0, en `src/lib/brand-icons.ts`), solo para
  identificarlos. Los que no tienen logotipo disponible mantienen el monograma con el color de su categoría.
- **El prototipo de la fase 1 solo usa servicios y planes ficticios**, rotulados como tales. Ninguna
  condición comercial del prototipo describe un servicio real.

### 2.11 Privacidad entre participantes

- **El miembro solo accede a lo suyo.** Un miembro solo puede leer sus propios costes atribuidos,
  acuerdos, plazos, movimientos, asignaciones y saldo.
  - Se aplica en **todas** las vías: políticas RLS de cada tabla, cualquier vista (siempre con
    `security_invoker = on`, para que respete la RLS de quien consulta), cada función RPC (que filtra
    por `auth.uid()` en su propio código, porque una función `SECURITY DEFINER` ignora la RLS) y las
    respuestas del servidor (los Server Components piden solo los campos de la persona).
- **Lo que un miembro sí ve del grupo:**
  - servicio, plan, precio total y regla de reparto;
  - su propio coste atribuido;
  - el número de plazas ocupadas, reservadas y libres;
  - el nombre visible de los demás participantes.
  - **No** ve importes, deudas, acuerdos, cobertura, contactos ni movimientos de nadie más.
- **Reparto con cuotas fijas.** El miembro ve su cuota, pero no la de los demás. La regla general solo
  dice "cuotas personalizadas".
- **La tira de cobertura de todos es solo para el líder.** Cada miembro ve únicamente la suya.
- **Pruebas por cada vía de lectura.** Con la identidad de un miembro, las pruebas de la fase 3 y la 4
  intentan leer los datos de otro participante por cada tabla, vista y RPC, y comprueban que el
  resultado es vacío o un error.

### 2.12 Historial y bajas

**Principio:** el historial económico compartido no se borra en cascada, y ninguna suscripción
compartida se queda sin responsable.

- **Salir de un grupo.**
  - La participación pasa a `salió`, con `left_on` (por defecto, al terminar el periodo actual).
  - Desde entonces no se generan costes atribuidos ni plazos nuevos, y los plazos futuros sin pagar
    de su acuerdo se cancelan, con motivo.
  - Lo que ya debía sigue a la vista, para el líder y para quien salió.
  - Si tenía saldo a favor o había pagado periodos posteriores a su salida, el líder ve el importe
    a devolver. Solo se considera devuelto cuando el líder registra la devolución.
  - Todos sus movimientos y asignaciones se conservan.
- **Archivar a un participante** (decisión del líder). Tiene el mismo efecto que salir, y además lo
  oculta de las listas activas. Su historial sigue en "Participantes anteriores".
- **Transferir el liderazgo.**
  - En una sola transacción: el nuevo líder acepta y se intercambian los roles. El antiguo líder pasa
    a miembro (o sale, si así lo indicó).
  - Los pagos al proveedor anteriores conservan quién los hizo (`paid_by_member_id`). La tesorería
    histórica de cada líder sigue siendo suya y no pasa al nuevo líder.
- **Cerrar un grupo.** El líder puede cerrarlo cuando se cancela la suscripción. Queda en solo lectura,
  con todo su historial.
- **Eliminar una cuenta.**
  - **Bloqueada mientras sea líder** de un grupo con otros participantes activos: primero tiene que
    transferir el liderazgo o cerrar el grupo.
  - **Datos solo suyos** (perfil, suscripciones personales y sus movimientos): se eliminan.
  - **Participaciones en grupos:** se conservan **anonimizadas**. `user_id` pasa a nulo, el nombre
    pasa a "Participante eliminado", se borran sus contactos y se marca `anonymized_at`.
    Los importes, plazos y movimientos se conservan para que las cuentas del grupo sigan cuadrando.
  - **Claves foráneas** hacia `auth.users` y `profiles`: `ON DELETE SET NULL` en todo lo compartido,
    y `ON DELETE CASCADE` solo en lo privado.
  - **Mecanismo pendiente de aprobar en la fase 2.** Borrar un usuario de `auth.users` exige la API de
    administración. La app nunca tendrá la clave `service_role`, así que la opción es una Edge Function
    con el secreto guardado en Supabase (nunca en el repositorio) o, en el MVP, una solicitud que
    anonimiza todo y deja el borrado final al administrador desde el panel.

---

## 3. Modelo de datos y matriz de permisos

### 3.1 Tablas (esquema `public`, todas con RLS)

| # | Tabla | Para qué | Fase |
|---|---|---|---|
| 1 | `profiles` | `id` = `auth.users.id` (FK, borrado en cascada), nombre visible, `avatar_hue`, `currency` (EUR), `timezone` (Europe/Madrid), `monthly_budget_cents` (opcional). Se crea con un trigger al registrarse. | 2 |
| 2 | `categories` | Catálogo fijo (vídeo, música, software, almacenamiento, juegos, noticias, otros), con clave y nombre. | 2 |
| 3 | `services` | Nombre, URL y categoría. `owner_id` nulo = catálogo; con valor = servicio personalizado y privado. | 2 |
| 4 | `plans` | Plan comercial estable: servicio, nombre y mercado (`ES`). | 2 |
| 5 | `plan_versions` | Datos versionados: precio orientativo, moneda y periodicidad (nulos si no se conocen), máximo de cuentas, perfiles, reproducciones simultáneas, si el titular cuenta, condiciones, URL oficial, `verified_at` y estado (`verified`, `pending` o `custom`). | 2 |
| 6 | `subscriptions` | Lo contratado: modo `personal`/`shared`, `owner_id` (el propietario o el líder actual, actualizado solo por funciones), servicio, versión de plan con la que se contrató, categoría, nombre, moneda, periodicidad, ancla de renovación, `next_renewal_date`, `auto_renew`, estado, `paid_through_date`, `cancelled_on`, URL de gestión, notas, días de recordatorio, `custom_max_members`, modo de reparto, días de gracia y `archived_at`. | 2 (compartido: 3) |
| 7 | `subscription_prices` | Historial de precios: importe, `effective_from` y autor. Índice único `(subscription_id, effective_from)`. | 2 |
| 8 | `subscription_members` | Participación: `user_id` (nulo si es invitado), `guest_name`, rol, `occupies_seat`, estado, `joined_on`, `left_on`, `fixed_share_cents`. Índices únicos parciales contra duplicados y para un solo líder activo. Restricción: debe tener `user_id` o `guest_name`. | 3 |
| 9 | `member_contacts` | Contacto privado del invitado. Está en una tabla aparte para que la RLS lo restrinja al líder, ya que RLS filtra filas y no columnas. | 3 |
| 10 | `invitations` | `token_hash` único, participante objetivo opcional (para vincular un invitado), email restringido opcional, si reserva plaza, `expires_at`, estado, quién la aceptó, cuándo, y los términos mostrados. | 3 |
| 11 | `leadership_transfers` | Transferencia de liderazgo: de quién, a quién, estado y caducidad. | 3 |
| 12 | `billing_periods` | Periodos del proveedor: `[period_start, period_end)`, precio, moneda, modo de reparto, número de participantes y regla de céntimos. Índice único `(subscription_id, period_start)`. | 4 |
| 13 | `cost_shares` | Costes atribuidos (la fotografía del reparto): periodo, participante, importe y tipo (`regular`, `initial` o `rounding`). Índice único `(period_id, member_id, kind)`. | 4 |
| 14 | `payment_agreements` | Acuerdo de pago de cada participante: periodicidad (`monthly` o `yearly`), día de vencimiento, `valid_from`, `valid_to`, precio pactado opcional, quién asume la diferencia y `confirmed_by`/`confirmed_at` del líder. Los acuerdos anteriores se conservan. | 4 |
| 15 | `installments` | Plazos (vencimientos reales): acuerdo, rango de periodos que cubre, importe, si es estimado o pactado, fecha de vencimiento y estado de cancelación con su motivo. | 4 |
| 16 | `installment_adjustments` | Ajustes pendientes cuando el coste real de un periodo difiere de lo estimado en un plazo: importe con signo, motivo y periodo. | 4 |
| 17 | `ledger_entries` | Movimientos: tipo, participante, `paid_by_member_id`, importe (> 0), moneda, `occurred_on`, concepto, referencia, estado, quién lo declaró y quién lo confirmó, `voids_entry_id` e `idempotency_key` (único por suscripción). | 2 (pagos personales), 4 |
| 18 | `allocations` | Asignaciones: movimiento → plazo (o → ajuste), importe (> 0) y origen (`manual` o `credit`, si viene del saldo a favor). Ni un movimiento ni un plazo pueden asignarse por encima de su importe; lo garantiza una función con bloqueo. | 4 |
| 19 | `renewal_payments` | Enlaza un movimiento personal con la fecha del calendario de renovaciones que paga. El calendario se calcula; no se guarda. | 2 |
| 20 | `audit_log` | Quién, qué entidad y cuándo, con los datos en `jsonb`. Se escribe solo desde funciones. | 3–4 |

Entidades que **no** entran en el MVP, por innecesarias:

- **Una tabla `groups` separada.** El grupo es una suscripción compartida, y separarla duplicaría
  el líder, la moneda y el precio.
- **Tablas de notificaciones.** Los avisos se calculan en el momento a partir de las fechas.
- **Tablas de preferencias aparte.** Las preferencias caben en `profiles`.

### 3.2 Cómo se aplica la autorización

1. **Las tablas no se escriben directamente.** Salvo el perfil propio y los datos básicos de una
   suscripción personal, las tablas solo conceden `SELECT` a `authenticated`, filtrado por RLS.
   Todas las escrituras críticas pasan por funciones SQL `SECURITY DEFINER` con `search_path = ''`, que:
   - comprueban `auth.uid()` y el rol en `subscription_members`;
   - validan las entradas;
   - bloquean las filas necesarias;
   - escriben y auditan, todo en una sola transacción.
2. **Funciones auxiliares** `is_member(sub)` e `is_leader(sub)`. Son `STABLE SECURITY DEFINER`, se usan en
   las políticas y evitan la recursión de RLS.
3. **El rol nunca sale de la metadata del usuario** (`raw_user_meta_data`), sino siempre de
   `subscription_members`. En `profiles` solo se pueden actualizar columnas concretas
   (`GRANT UPDATE (display_name, …)`), así que no hay forma de "ascender" editando el perfil.
4. **Validación en dos capas.** Los Server Actions validan antes de llamar a `supabase.rpc()`, con el
   cliente de servidor y la clave publicable. La base de datos vuelve a validar con restricciones
   y funciones.
5. **Contra dobles envíos.** Cada formulario lleva una `idempotency_key` (UUID generado al renderizar),
   respaldada por un índice único. El botón se desactiva mientras se envía.
6. **Errores.** El servidor registra el error interno y la UI recibe un mensaje en español.
   El código de error interno nunca se muestra.

### 3.3 Matriz de permisos

Leyenda: ✔ permitido · ✖ denegado · "propio" = solo sus filas · "nombres" = solo nombre visible y estado de plaza.

| Acción | Anónimo | Usuario ajeno | Miembro | Líder | Propietario personal |
|---|---|---|---|---|---|
| Leer catálogo (servicios, planes y versiones) | ✖ | ✔ | ✔ | ✔ | ✔ |
| Crear servicio personalizado | ✖ | ✔ (privado) | ✔ | ✔ | ✔ |
| Leer o editar el propio perfil | ✖ | propio | propio | propio | propio |
| Ver el perfil de otros | ✖ | ✖ | nombres de su grupo | nombres de su grupo | ✖ |
| Leer una suscripción por su ID | ✖ | ✖ | ✔ (datos del plan, precio total y reparto) | ✔ | ✔ |
| Editar una suscripción | ✖ | ✖ | ✖ | ✔ (función) | ✔ |
| Ver participantes | ✖ | ✖ | nombres y plazas | ✔ todo | — |
| Ver el contacto de un invitado | ✖ | ✖ | ✖ | ✔ | — |
| Ver costes atribuidos, acuerdos, plazos, saldo y movimientos | ✖ | ✖ | propio (por tabla, vista, RPC y servidor) | ✔ todo | ✔ |
| Ver la tira de cobertura | ✖ | ✖ | solo la propia | ✔ de todos | — |
| Crear o confirmar un acuerdo a precio pactado | ✖ | ✖ | proponer el propio | ✔ confirmar | — |
| Declarar "he enviado el pago" | ✖ | ✖ | ✔ (propio) | ✔ (en nombre de un invitado) | — |
| Confirmar o rechazar un cobro | ✖ | ✖ | ✖ (tampoco el suyo propio) | ✔ | — |
| Registrar un pago al proveedor | ✖ | ✖ | ✖ | ✔ | ✔ |
| Anular o ajustar un movimiento | ✖ | ✖ | ✖ | ✔ (movimiento nuevo y auditado) | ✔ |
| Crear o revocar invitaciones | ✖ | ✖ | ✖ | ✔ | — |
| Ver la vista previa de una invitación | ✖ (se pide iniciar sesión) | ✔ (con token válido) | ✔ | ✔ | — |
| Aceptar una invitación | ✖ | ✔ (atómico, con plaza y sin duplicado) | ✖ (ya es miembro) | ✖ | — |
| Salir del grupo | — | — | ✔ | ✖ (antes debe transferir) | — |
| Proponer o aceptar una transferencia de liderazgo | ✖ | ✖ | aceptar (si es el destinatario) | proponer | — |
| Leer la auditoría | ✖ | ✖ | ✖ | ✔ (de su grupo) | ✔ |

### 3.4 Índices previstos

- Índice en cada clave foránea.
- `subscription_members (user_id) WHERE status = 'active'`, para "mis grupos".
- `installments (agreement_id, due_date)`.
- `cost_shares (member_id, period_id)`.
- `ledger_entries (subscription_id, occurred_on)`.
- `invitations (token_hash)`, único.
- `subscriptions (owner_id, status)`.
- `subscriptions (next_renewal_date)`, para próximos vencimientos.

---

## 4. Mapa de pantallas y flujos

### 4.1 Rutas

```
/acceso                        Iniciar sesión
/registro                      Crear cuenta
/recuperar                     Pedir enlace de recuperación
/restablecer                   Nueva contraseña (tras el enlace)
/auth/confirm                  Route handler: verifica token_hash (confirmación y recuperación)

/                              Resumen (dashboard)
/suscripciones                 Lista: personales y compartidas (filtros: tipo, rol, categoría, estado)
/suscripciones/nueva           Crear (personal; opción "compartir" que la convierte en grupo)
/suscripciones/[id]            Detalle (pestañas en compartidas: Resumen · Participantes · Pagos · Ajustes)
/suscripciones/[id]/editar     Editar datos y precio (con fecha de entrada en vigor)
/grupos                        Mis grupos: los que lidero y en los que participo
/pagos                         Bandeja: cobros declarados por confirmar (líder) y mis pagos declarados
/invitaciones                  Invitaciones recibidas pendientes y enviadas (con caducidad y revocar)
/invitacion/[token]            Vista previa y aceptación (exige sesión; vuelve aquí tras iniciar sesión)
/ajustes                       Perfil, preferencias (moneda, zona horaria) y presupuesto
```

Si el proxy ve que no hay sesión, redirige a `/acceso?siguiente=…`, con las cookies copiadas
mediante `withSupabaseCookies`.

### 4.2 Flujos principales

1. **Registro.** Email y contraseña → correo de confirmación → `/auth/confirm` → se crea el perfil
   (trigger) → bienvenida en el Resumen vacío, con la acción "Añadir tu primera suscripción".
2. **Suscripción personal.** Elegir un servicio del catálogo o crear uno personalizado → plan opcional
   (precio orientativo visible, editable) → importe contratado, periodicidad, fechas y estado → guardar.
   El detalle muestra la próxima renovación como previsión, con el botón "Registrar pago".
3. **Crear un grupo.** Desde una suscripción, "Compartir" → elegir el máximo de plazas (del plan
   verificado o manual) → elegir el modo de reparto → el grupo queda en borrador → añadir invitados
   o crear invitaciones → el grupo se activa con 2 participantes.
4. **Invitar.** El líder crea la invitación (restringida a un email o no, si reserva plaza, caducidad) →
   copia el enlace → el destinatario lo abre, inicia sesión, revisa los términos y acepta (comprobación
   atómica) → empieza a contar desde el siguiente periodo o con una cuota inicial acordada.
5. **Cobro.** El miembro pulsa "He enviado el pago" y lo declara (importe, fecha, concepto) → el pago
   aparece en `/pagos` del líder → el líder confirma con una asignación propuesta (editable) o lo rechaza
   con un motivo → se recalculan la cobertura y el saldo.
6. **Pago al proveedor.** El líder lo registra (importe, fecha, periodo) → se actualiza el adelanto neto.
7. **Transferir el liderazgo.** El líder lo propone → el destinatario acepta → se cambian los roles
   en una transacción.

---

## 5. Propuesta visual

**Criterio acordado (revisión 2).**
- Las skills orientan; no son restricciones absolutas, y no hacen falta más sorteos de estilo para avanzar.
- Se parte de la dirección pastel. Se permiten KPI, varios colores en gráficos y cualquier recurso que
  mejore la comprensión y la accesibilidad.
- Los céntimos se ven a tamaño y contraste completos.
- Ningún estado depende solo del color: siempre lleva texto, un icono o una marca distinta.
- Las tablas de abajo quedan como orientación de partida.

### 5.1 Cómo combino las tres skills (contradicciones y decisión)

| Tema | Impeccable | Taste skill (pantallas de app) | Decisión |
|---|---|---|---|
| Proceso | Exige `PRODUCT.md` (init con tu aprobación), un sorteo de dirección con `concept-seed` y una página de decisión. Al final, un revisor independiente y `DESIGN.md`. | Sortea un estilo de app con `draw.mjs --app`, y luego `lint` e `inspect --app` a 1440, 768 y 390 px. | **Uso las dos en orden.** Taste ya ha repartido el estilo de base (abajo). Cuando apruebes el punto 1, escribo `PRODUCT.md` y ejecuto el sorteo de Impeccable, que puede proponer alternativas; te las presento en su página de decisión. La revisión final usa `inspect --app` de Taste y `detect` + revisor de Impeccable. |
| Color en la estructura | En modo Operate, una pantalla gris con un solo acento es "el estándar sin pulir". Pide que el color haga trabajo real: estados, series, selección. | El color va en los datos, no en la estructura. Nunca una barra lateral oscura o saturada. Presupuesto de color del 5–8 %. | **El color hace trabajo, pero no en la estructura.** Fondo neutro ligeramente teñido. Cada **persona** y cada **categoría** tienen un tono pálido propio, y los estados (pagada, parcial, vencida) tienen su par pálido y oscuro. Barra lateral sobre el fondo, sin saturar. |
| Movimiento | En Operate, 150–250 ms y solo para comunicar estados. | Sin entradas animadas en pantallas de app; solo feedback. | Las dos coinciden: hover, foco, pulsación y apertura de diálogos. Nada se anima al cargar. Con `prefers-reduced-motion` no hay desplazamientos. |
| Fuente | Las interfaces de producto admiten fuentes de trabajo; tiene una lista de fuentes "de defecto" a evitar en superficies de marca. | La ficha asigna Manrope, con sus cifras como seña de identidad. | **Manrope** mediante `next/font/google`: se aloja en el build y no añade dependencias. No está en la lista de Impeccable. Sustituye a Geist. |
| Tema oscuro | — | La ficha es de tema claro. | Modern Web Guidance pide respetar la preferencia del sistema. En el MVP declaro `color-scheme: light` y dejo los tokens preparados; el tema oscuro queda para la fase 6. |
| Fechas | — | — | Modern Web Guidance: `Temporal` no funciona en Safari. La aritmética de fechas va en SQL (§2.2), sin polyfill. |
| Diálogos | En Operate, "el modal como primera opción suele ser pereza". | — | Modern Web Guidance (`dialog`): `<dialog>` nativo con `showModal()`, solo para confirmar acciones destructivas o irreversibles (anular un movimiento, revocar, salir). Lo demás se hace en línea o en una página propia. |

### 5.2 Estilo de base repartido por Taste skill

**`pastel-consumer`**, semilla `528998681`. Taste repartió también `achromatic-ledger`, un libro de
cuentas sin color en la estructura, y lo descarto. Esta app trata de dinero entre **personas**:
el color identifica a cada persona y su estado de pago, y una pantalla sin color escondería
justo eso.

- **Seña del estilo.** Tonos pálidos por persona y por categoría, cuyo texto es el oscuro de su mismo tono.
  Un radio grande y único: 20 px en las tarjetas, que baja a 10, 8 y 5 px en los elementos interiores.
  Dinero tranquilo: los gastos en tinta y el rojo solo para lo **vencido**.
- **Tokens principales.** Fondo `#f3f5f7`; superficies `#ffffff`; texto `#1b1d1f`; secundario `#5c6064`.
  Acento de datos cobalto `#1d5fd6` (pálido `#dcf1ff`, oscuro `#0a3a80`). Positivo `#2f7a45`;
  negativo `#c41c29`. Pares de píldora para estado positivo, negativo, de aviso, neutro y de acento.
  Botón principal casi negro.
- **Tipografía.** Una sola familia, Manrope (400, 500 y 600) y cinco tamaños: título 28, sección 20,
  cifra principal 32, cuerpo 16 y pequeño 14. Las cifras usan `tabular-nums`. Los céntimos van al mismo
  tamaño y color que los euros.
- **Estructura.** Barra lateral de 240 px con etiquetas, sobre el mismo fondo y sin barra superior.
  En el móvil se pliega en una barra de 48 px con el nombre de la pantalla y un menú que abre una hoja
  a pantalla completa.
- **Se evita salvo que mejore la comprensión.** Degradados, brillos, cristal, iconos en círculos de
  color, sparklines, emoji, filas alternas en las tablas y cabeceras en mayúsculas. Los KPI y los
  gráficos con varios colores se permiten cuando ayudan, siempre con etiquetas de texto.

### 5.3 Lo que hace que sea esta app y no una plantilla

- **La cara: las cifras y las personas.**
  - Cada importe en Manrope 600, con los céntimos en gris.
  - Cada participante con su inicial sobre su tono pálido propio (separados al menos 60° de tono).
  - Cada servicio con su logotipo o, si no lo hay, un monograma sobre el tono de su categoría.
- **Elemento propio 1: la tira de cobertura.** Una fila por participante, con **un segmento por plazo
  de su acuerdo**: un plazo mensual ocupa un periodo y uno anual ocupa doce, como una sola barra.
  El líder ve la tira de todos; cada miembro solo la suya.
  Cada estado tiene una **marca distinta**, para que no dependa solo del color:
  - pagada: relleno pálido y ✓;
  - parcial: rayado diagonal y el importe pendiente;
  - pendiente: contorno;
  - vencida: contorno rojo y la palabra "Vencida";
  - proyectada: contorno discontinuo.
  Hoy se marca con una línea cobalto de 1 px, y "cubierto hasta" aparece al final de la fila.
- **Elemento propio 2: las plazas.** El máximo del plan dibujado como fila de asientos:
  - ocupada: inicial sobre el tono de la persona;
  - reservada: contorno discontinuo con "hasta 24 nov";
  - libre: contorno vacío.
  Si el máximo no está verificado, se rotula como tal.

### 5.4 Planteamiento del dashboard

**Pregunta de la pantalla:** "¿Cuánto me cuestan de verdad mis suscripciones y qué tengo que pagar o cobrar ahora?"
**El hallazgo, debajo del título:** el aviso más urgente con datos, por ejemplo
"Lucía debe 8,00 € de octubre en Spotify Familiar · vencida hace 9 días".

Escritorio (1440 × 900); todos los bloques asoman en la primera pantalla:

```
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ ◐ NombreApp  │ Resumen                                  [Mi parte|Importe completo|Lidero]  │
│              │ Lucía debe 8,00 € de octubre · Spotify Familiar      [Noviembre 2026 ▾]      │
│ Resumen      │ [Personal/Compartida ▾] [Rol ▾] [Categoría ▾] [Estado ▾]                     │
│ Suscripciones│ ┌───────────────────────┐ ┌───────────────────────────────────────────────┐  │
│ Grupos       │ │ Mi parte al mes       │ │ Próximos pagos y renovaciones          Ver todo│  │
│ Pagos      2 │ │ 47,83 €  equivalente  │ │ 21 nov  [S] Spotify Familiar  tu cuota  4,00 €│  │
│ Invitaciones │ │ 573,96 € al año       │ │ 24 nov  [N] Netflix Estándar  previsión 13,99 │  │
│              │ │ ▓▓▓▓▓▓▓▓░░ 80 % de    │ │ 01 dic  [M] Microsoft 365     renovación anual│  │
│              │ │ tu presupuesto (60 €) │ │ 03 dic  [Y] YouTube Familiar  cobro pendiente │  │
│              │ │ ─────────────────────  │ └───────────────────────────────────────────────┘  │
│              │ │ Vídeo        21,98 €  │ ┌──────────────────────┐ ┌──────────────────────┐  │
│              │ │  Netflix     13,99    │ │ Por cobrar (líder)   │ │ Gasto real registrado│  │
│              │ │  Disney+      7,99    │ │ 16,00 €  2 personas  │ │ ▁▃▅▂▆▃▇▅ 12 meses    │  │
│              │ │ Música        4,00 €  │ │ Lucía  8,00 vencida  │ │ neto: pagado − cobros│  │
│              │ │ Software      5,83 €  │ │ Pablo  8,00 pendiente│ │ nov: 31,98 €         │  │
│ Ajustes      │ │ …                     │ └──────────────────────┘ └──────────────────────┘  │
│ (avatar) Ana │ └───────────────────────┘                                                    │
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

- **Columna izquierda fija** (patrón *finance home* de la ficha). Abre con **Mi parte al mes**, que es la
  cifra mayor de la pantalla (32 px), seguida del anual equivalente y de la barra de presupuesto
  (solo si hay presupuesto). Debajo, el árbol por categoría con el mensual equivalente de cada
  suscripción, alineado a la derecha.
- **Rejilla derecha de dos columnas:**
  - **Próximos pagos y renovaciones** (filas de dos líneas). Cada fila dice qué es: tu cuota, previsión,
    renovación o cobro pendiente.
  - **Por cobrar** (solo si lideras algo), con la antigüedad de la deuda y la acción "Registrar cobro".
  - **Gasto real registrado.** Columnas mensuales de un solo tono, con proyección discontinua y
    rotulada; el gasto neto separa lo pagado de lo reembolsado.
  - Debajo, fuera de la primera pantalla: distribución por categoría y por servicio (listas de barras
    finas) y cobros confirmados frente a pendientes.
- **Las tres vistas** son un control segmentado. Cambian los datos, no la estructura:
  - **Importe completo** sustituye "Mi parte" por "Importe total de tus planes", con el rótulo
    "No es tu gasto personal".
  - **Grupos que lidero** muestra la tesorería (pagado al proveedor, cobrado, pendiente, adelanto neto,
    tu parte).
- **Estados.**
  - Vacío (cuenta nueva): la estructura y el título se mantienen y aparece la acción "Añadir tu primera suscripción".
  - Cero: "0,00 €".
  - Dato que falta: "—".
  - Carga: barras grises del tamaño real del dato.
  - Error: dentro del bloque que falla, con "Reintentar".
- **Móvil (390 px).** Barra de 48 px y menú en hoja → el control segmentado se desplaza dentro de su
  propia fila → "Mi parte" es la primera tarjeta → los próximos pagos → el resto apilado.
  Los filtros se recogen en una sola fila de chips o en la hoja "Filtros".

**Pantalla representativa propuesta:** el Resumen (arriba) más el detalle de un grupo, que es donde viven
la tira de cobertura y las plazas. Se construyen primero como **prototipo con datos de muestra**,
en una ruta que solo existe en desarrollo, para que los revises en el navegador antes de tocar la base
de datos.

---

## 6. Plan por fases con criterios de aceptación

En todas las fases: antes de cerrar, `npm run lint`, `npm run typecheck`, `npm run build` y las pruebas
de la fase. Las migraciones se guardan en `supabase/migrations/` y se aplican con `apply_migration` tras
tu aprobación. Los commits los propongo al final de cada fase y esperan tu visto bueno.

### Fase 1: Sistema visual, prototipo y bases de prueba (sin cambios en la base de datos)

- `PRODUCT.md` a partir de este documento.
- La dirección pastel ya aprobada, sin más sorteos de estilo.
- Tres prototipos: el Resumen, el detalle de un grupo visto por el líder y el detalle del mismo grupo
  visto por un miembro.
- Los tokens en `globals.css` (`@theme` de Tailwind 4), Manrope, los componentes base (botón, campo,
  selector, píldora, tarjeta, tabla, control segmentado, estados vacío, de carga y de error) y la
  estructura (barra lateral y plegado en el móvil).
- Un prototipo del Resumen y del detalle de grupo con datos de muestra. Los totales se calculan a partir
  de las filas, con aserciones.
- Las bases de prueba: Vitest para los cálculos (si lo apruebas) y pgTAP para la base de datos.

**Criterio de aceptación:**
- `inspect --app` sin errores a 1440, 768 y 390 px.
- `impeccable detect` revisado.
- Capturas revisadas con Playwright (estados vacío, de carga, de error, foco y desbordamientos).
- Tu aprobación del sistema visual.

### Fase 2: Autenticación, perfil y suscripciones personales

- **Correo resuelto al empezar la fase, no al final.** El correo de Supabase por defecto solo envía a
  direcciones del equipo del proyecto. Para probar el registro y la recuperación con otros usuarios
  hace falta un **SMTP propio** desde el primer día de la fase 2.
  - Te propondré opciones concretas (un proveedor transaccional con dominio verificado, o el SMTP de un
    buzón propio para pruebas) para que apruebes una, porque es un servicio externo.
  - La configuración se hace en el panel de Supabase. Las credenciales nunca van al repositorio.
  - Para pruebas automáticas sin buzones reales, se usan direcciones de un dominio que controles, o
    un buzón de captura del propio proveedor si lo ofrece.
- Registro, inicio de sesión, cierre de sesión y recuperación.
- Perfil (nombre, color del avatar, moneda, zona horaria y presupuesto).
- Migraciones de las tablas 1–7 y de la parte personal de la 14.
- Catálogo verificado de España.
- Crear, editar y ver el detalle de una suscripción personal, con su historial de precios y "Registrar pago".
- Propuesta de una migración aparte para retirar `demo_items` y su diagnóstico.

**Criterio de aceptación (pruebas):**
- Equivalentes mensual y anual.
- Cancelación con un periodo aún pagado.
- Renovaciones a final de mes y en año bisiesto.
- Un usuario B no puede leer ni modificar una suscripción de A por su ID.
- Nadie puede editar el rol desde el perfil.
- Las previsiones nunca se cuentan como pagos.

### Fase 3: Grupos, participantes, invitados e invitaciones

- Convertir una suscripción en compartida: capacidad, plazas, borrador o activo.
- Invitados con contacto privado.
- Invitaciones: token con hash, caducidad, revocación, reserva de plaza y destinatario restringido.
- Aceptación atómica.
- Vincular un invitado a una cuenta.
- Salir y archivar participantes.
- Transferir el liderazgo.
- Auditoría.

**Criterio de aceptación (pruebas):**
- Dos aceptaciones simultáneas de la última plaza: solo una entra. Se prueba con dos sesiones reales
  en paralelo.
- Una invitación caducada, revocada o ya usada se rechaza.
- Un invitado vinculado conserva su historial y no se duplica.
- Un ajeno no puede leer el grupo.
- El líder no puede salir sin transferir.
- Un miembro no ve contactos ni importes de otros.

### Fase 4: Periodos, cuotas, pagos y cobertura

- Fotografía de cada periodo y reparto (igualitario con redondeo determinista, o cuotas fijas).
- Cuota inicial acordada.
- Acuerdos de pago (mensual o anual) y sus plazos.
- Ajustes pendientes.
- Acuerdos a precio pactado con confirmación expresa del líder.
- Movimientos con estados e idempotencia.
- Asignaciones, saldo a favor, anulaciones y ajustes.
- Bandeja `/pagos`.

**Criterio de aceptación (pruebas):**
- 24 € entre 6 son 4 € cada uno.
- Un plan con plazas libres no se divide por el máximo.
- Céntimos (10 € entre 3) y cuotas fijas.
- Un invitado cuenta en el reparto.
- Un miembro con acuerdo anual y otro mensual sobre un proveedor mensual: el anual tiene un solo
  plazo, nunca doce deudas.
- Saldo monetario frente a acuerdo a precio pactado cuando sube el precio.
- Un miembro no puede leer costes, plazos ni movimientos de otro por ninguna tabla, vista o RPC.
- Pago parcial.
- Pago declarado sin confirmar: no cuenta.
- Un miembro no puede confirmar su propio pago.
- Un cambio de precio o de miembros no altera el pasado.
- Se cumple la invariante de tesorería.

### Fase 5: Dashboard, gráficos y detalle

- Las tres vistas del Resumen, filtros, gráficos (SVG propios a partir de `charts.js` de Taste, sin
  librería) y la lista de vencimientos.
- Detalle completo: porcentajes, presupuesto, proyección, ahorro frente al plan completo, y comparación
  con una alternativa individual solo si hay un precio oficial verificado.

**Criterio de aceptación (pruebas):**
- No hay doble conteo entre personal, cuota y precio completo.
- Las tarjetas y los gráficos coinciden con los mismos filtros.
- Con denominador 0 se muestra "—".
- Las monedas se separan.

### Fase 6: Recordatorios, exportación y mejoras

- Avisos dentro de la app antes de cada renovación.
- Exportación a CSV.
- Subida de avatar (Supabase Storage).
- Tema oscuro.
- Opcional: `pg_cron` para abrir periodos cada día.
- Opcional: recordatorios por correo (requieren el SMTP ya configurado en la fase 2 y tu aprobación).

**Cuándo se escriben las pruebas:** cada fase añade las suyas. Las de permisos usan identidades reales:
en pgTAP, `set local role authenticated` más los claims `request.jwt.claims` de los usuarios A, B y C.
La de concurrencia usa dos clientes `supabase-js` con sesiones distintas.

---

## 7. Configuración manual necesaria (Supabase Dashboard)

1. **Authentication > URL Configuration.** *Site URL* `http://localhost:3000` (y más adelante el dominio
   de producción); en *Redirect URLs*, `http://localhost:3000/**`.
2. **Authentication > Email Templates.** Los enlaces de *Confirm signup* y *Reset password* deben apuntar
   a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`. Te paso el texto exacto en la fase 2.
3. **Límites del correo de Supabase.** El servicio de correo por defecto solo envía a direcciones del
   equipo del proyecto y con un límite bajo por hora. Para probar con otros usuarios, el SMTP propio
   se configura **al empezar la fase 2** (ver §6).
4. **Authentication > Providers > Email.** Revisar la longitud mínima de la contraseña (propongo 8)
   y mantener activada la confirmación del email.

---

## 8. Preguntas abiertas

Son las preguntas que no se pueden cerrar con un valor predeterminado. Están en el mensaje del chat.
