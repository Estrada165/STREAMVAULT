// StreamVault · Pasos de las guías (ver components/shared/Tour.jsx)
// target: selector del elemento que se ilumina (lista = el primero visible). Sin target → al centro.
export const TOURS = {
  'codebot-connect': [
    {
      title: 'Entrega con bot de códigos',
      text: 'Si tienes <b>StreamPanel</b>, cada cuenta que vendas aquí le dará al comprador su <b>propio enlace</b> para sacar los códigos de inicio de sesión, hogar o viaje. Sin asignar nada a mano.',
    },
    {
      target: '[data-tour="codebot-card"]',
      title: 'Aquí se conecta',
      text: 'Esta tarjeta une tu tienda con tu StreamPanel. Solo se hace una vez.',
    },
    {
      target: '[data-tour="codebot-key"]',
      title: 'Pega tu clave',
      text: 'En StreamPanel entra a <b>Configuración → Tienda StreamVault</b>, toca <b>Generar clave</b>, cópiala y pégala aquí. Luego toca <b>Conectar</b>.',
    },
    {
      title: 'Después, en cada producto',
      text: 'Abre un producto y activa <b>Bot de códigos</b>: eliges la plataforma y qué códigos podrá pedir el comprador. Para perfiles vienen marcados solo los necesarios.',
    },
  ],

  'codebot-product-intro': [
    {
      target: '[data-tour="codebot-section"]',
      title: 'Nuevo: bot de códigos',
      text: 'Activa este interruptor y cada venta de este producto le dará al comprador su <b>propio enlace</b> para sacar códigos de tu StreamPanel. Ideal para Netflix, Disney+ y similares.',
    },
  ],

  'codebot-product': [
    {
      target: '[data-tour="codebot-section"]',
      title: 'Bot de códigos',
      text: 'Actívalo y cada venta de este producto genera el enlace de códigos del comprador. <b>Solo funciona con correos que ya registraste en tu StreamPanel.</b>',
    },
    {
      target: '[data-tour="codebot-platform"]',
      title: 'La plataforma en tu bot',
      text: 'Se elige sola por el nombre. Revisa que sea la misma con la que vinculaste los correos en StreamPanel.',
    },
    {
      target: '[data-tour="codebot-types"]',
      title: 'Qué códigos puede pedir',
      text: 'Para <b>perfiles</b> te recomendamos solo inicio de sesión, hogar y viaje: así nadie puede cambiar la contraseña de la cuenta que comparten.',
    },
  ],

  'codebot-stock': [
    {
      target: '[data-tour="codebot-stock-badge"]',
      title: '¿Está en tu bot?',
      text: 'Cada correo muestra si está registrado en tu StreamPanel con esta plataforma. <b>✓ En tu bot</b> = el comprador recibirá su enlace. <b>⚠</b> = regístralo allá o se venderá sin enlace.',
    },
  ],

  'codebot-order': [
    {
      target: '[data-tour="codebot-order"]',
      title: 'Este pedido incluye bot de códigos',
      text: '<b>Obtener código</b> abre el bot en otra pestaña y <b>Copiar enlace</b> te lo deja listo para pasárselo a tu cliente. El enlace dura lo mismo que el pedido y solo muestra ese correo.',
    },
    {
      target: '[data-tour="codebot-send"]',
      title: 'Va solo en el mensaje',
      text: 'Al enviar las credenciales por WhatsApp, el enlace de códigos se agrega automáticamente.',
    },
  ],

  /* ═══════════ Guías de cada pantalla (salen la primera vez) ═══════════ */

  // ── PROVEEDOR ──
  'p-inicio': [
    { title: '¡Bienvenido a tu panel!', text: 'Aquí manejas tu tienda: productos, stock, distribuidores, ventas y soporte. Te mostramos lo principal en 1 minuto.' },
    { target: ['main div:has(> [data-tour="stat"])', '[data-tour="stat"]'], title: 'Tus números', text: 'Ingresos, pedidos activos, distribuidores y stock disponible, siempre al día.' },
    { target: '[data-tour="dash-chart"]', title: 'Ventas de la semana', text: 'Cuánto vendiste los últimos 7 días y día por día.' },
    { target: ['[data-tour="nav-proveedor-productos"]', '[data-tour=\"menu-btn\"]'], title: '1 · Crea tus productos', text: 'Empieza aquí: cada producto es lo que tus distribuidores ven en la tienda (precio, duración, tipo).' },
    { target: ['[data-tour="nav-proveedor-stock"]', '[data-tour=\"menu-btn\"]'], title: '2 · Carga tu stock', text: 'Las cuentas (correo, contraseña, perfil) que se entregan solas al vender.' },
    { target: ['[data-tour="nav-proveedor-distribuidores"]', '[data-tour=\"menu-btn\"]'], title: '3 · Activa a tus distribuidores', text: 'Se registran con tu código, tú los activas y les recargas saldo.' },
    { target: ['[data-tour="nav-proveedor-pendientes"]', '[data-tour=\"menu-btn\"]'], title: 'Lo que espera por ti', text: 'Distribuidores por activar, pedidos sin credenciales y tickets abiertos, todo junto.' },
    { target: '[data-tour="tour-btn"]', title: 'Guías en cada pantalla', text: 'Cada sección tiene su guía. Tócala cuando quieras repasar.' },
  ],
  'p-pendientes': [
    { title: 'Bandeja de pendientes', text: 'Todo lo que necesita una acción tuya, en un solo lugar. Cuando esté vacía, estás al día.' },
    { target: 'main section.card', title: 'Atiende desde aquí', text: 'Activa distribuidores, carga credenciales de pedidos «a pedido» y responde tickets sin cambiar de pantalla.' },
  ],
  'p-productos': [
    { title: 'Tus productos', text: 'Es tu catálogo: lo que tus distribuidores ven y compran en la tienda.' },
    { target: '[data-tour="page-action"] > *', title: 'Nuevo producto', text: 'Elige plataforma, tipo (perfil, cuenta completa…), duración, precio y si se entrega <b>al instante</b> (con stock) o <b>a pedido</b>.' },
    { target: 'main input[placeholder^="Buscar"]', title: 'Encuéntralo rápido', text: 'Busca por nombre o plataforma.' },
    { target: '[data-tour="tabs"]', title: 'Filtra', text: 'Mira todos, solo los visibles en la tienda o los ocultos.' },
    { target: '[data-tour="prod-grid"] > :first-child', title: 'Cada tarjeta', text: 'Edita, oculta o muestra en la tienda, y revisa cuánto stock le queda.' },
  ],
  'p-stock': [
    { title: 'Stock', text: 'Aquí van las cuentas que se entregan solas cuando un distribuidor compra.' },
    { target: '[data-tour="stock-products"]', title: 'Elige el producto', text: 'El número indica cuántas cuentas disponibles le quedan. En rojo = sin stock.' },
    { target: '[data-tour="stock-add"]', title: 'Agrega una cuenta', text: 'Correo, contraseña, perfil y PIN. Solo lo que ese tipo de producto necesita.' },
    { target: '[data-tour="stock-bulk"]', title: 'O varias de golpe', text: 'Pega una cuenta por línea (correo|clave|perfil|pin) y se cargan todas juntas.' },
    { target: '[data-tour="stock-list"] [data-tour="tabs"]', title: 'Disponible y vendido', text: 'En <b>Vendido</b> ves a quién se entregó cada cuenta y puedes editarla si hay que cambiar la contraseña.' },
  ],
  'p-ventas': [
    { title: 'Ventas', text: 'Todos los pedidos de tus distribuidores: qué compraron, para qué cliente y cuándo vence.' },
    { target: 'main input[placeholder^="Pedido"]', title: 'Busca', text: 'Por número de pedido, cliente, producto, distribuidor o correo.' },
    { target: '[data-tour="tabs"]', title: 'Por estado', text: '<b>Pendientes</b> son pedidos «a pedido» esperando que cargues las credenciales.' },
    { target: ['[data-tour="sales-list"]', 'main article.card'], title: 'Acciones del pedido', text: 'Carga credenciales, renueva (cobra del saldo del distribuidor), o libera/borra un pedido.' },
  ],
  'p-distribuidores': [
    { title: 'Tu red de distribuidores', text: 'Quiénes venden tus productos, su saldo y sus movimientos.' },
    { target: '[data-tour="dist-invite"]', title: 'Invita', text: 'Comparte tu código o enlace. Se registran con él y aparecen aquí <b>por activar</b>.' },
    { target: ['main div:has(> [data-tour="stat"])', '[data-tour="stat"]'], title: 'Resumen', text: 'Total, activos, por activar y el saldo que hay en tu red.' },
    { target: '[data-tour="dist-list"]', title: 'Cada distribuidor', text: 'Actívalo, recárgale saldo (cuando te pague por Yape/Plin), mira su historial o bloquéalo.' },
    { target: '[data-tour="tabs"]', title: 'Movimientos de saldo', text: 'Todas las recargas, compras y devoluciones de tu red, con fecha.' },
  ],
  'p-avisos': [
    { title: 'Avisos', text: 'Mensajes para tus distribuidores: promos, cambios de precio, horarios. Les aparecen al entrar a la tienda.' },
    { target: '[data-tour="page-action"] > *', title: 'Crea un aviso', text: 'Con título, mensaje, imagen y un botón con enlace. Puedes programar desde y hasta cuándo se muestra.' },
  ],
  'p-soporte': [
    { title: 'Soporte', text: 'Los tickets que abren tus distribuidores cuando una cuenta falla.' },
    { target: '[data-tour="tabs"]', title: 'Abiertos primero', text: 'Atiende los abiertos; los resueltos quedan como historial.' },
    { target: '[data-tour="tickets-list"]', title: 'Responde', text: 'Contesta, cambia las credenciales, renueva o anula el pedido con devolución. El distribuidor recibe el aviso al instante.' },
  ],
  'p-config': [
    { title: 'Configuración', text: 'Tu marca, cómo te encuentran tus distribuidores y cómo te pagan.' },
    { target: '[data-tour="tabs"]', title: 'Por pestañas', text: '<b>Tienda</b>: marca e invitación. <b>Pagos</b>: Yape, Plin, etc. <b>Bot de códigos</b>: StreamPanel. <b>Asistente</b>: respuestas automáticas.' },
    { target: '[data-tour="cfg-brand"]', title: 'Tu marca', text: 'Nombre, logo y colores que ven tus distribuidores.' },
    { target: '[data-tour="cfg-invite"]', title: 'Invitación y soporte', text: 'Tu código para que se registren y el WhatsApp donde te llegan avisos de recargas y tickets.' },
  ],

  // ── DISTRIBUIDOR ──
  'd-tienda': [
    { title: '¡Bienvenido a la tienda!', text: 'Aquí compras las cuentas que luego vendes a tus clientes. Te mostramos cómo en 1 minuto.' },
    { target: ['[data-tour="store-balance"]', '[data-tour="side-balance"]'], title: 'Tu saldo', text: 'Las compras se pagan con tu saldo. Recárgalo y tu proveedor lo acredita al confirmar el pago.' },
    { target: '[data-tour="store-methods"]', title: 'Cómo recargar', text: 'Elige Yape, Plin u otro método, mira los datos y avísale a tu proveedor por WhatsApp con un toque.' },
    { target: '[data-tour="store-search"]', title: 'Busca y filtra', text: 'Por nombre, solo lo disponible, y los <b>Avisos</b> de tu proveedor (promos, cambios).' },
    { target: '[data-tour="store-grid"] > :first-child', title: 'Cada producto', text: 'Precio, duración y stock. Los iconos de abajo muestran detalles, garantía y términos. Toca <b>Agregar</b>.' },
    { target: ['[data-tour="nav-carrito"]', '[data-tour=\"menu-btn\"]'], title: 'Paga en el carrito', text: 'Pon el nombre y WhatsApp de tu cliente y compra. Recibes las credenciales al instante.' },
    { target: ['[data-tour="nav-dashboard"]', '[data-tour=\"menu-btn\"]'], title: 'Tus pedidos', text: 'Ahí ves todo lo que compraste, cuándo vence y lo envías a tu cliente.' },
  ],
  'd-pedidos': [
    { title: 'Mis pedidos', text: 'Todo lo que compraste: credenciales, vencimientos y avisos a tus clientes.' },
    { target: ['main div:has(> [data-tour="stat"])', '[data-tour="stat"]'], title: 'De un vistazo', text: 'Activos, por vencer, pendientes y expirados.' },
    { target: '[data-tour="expiring"]', title: 'Vencen pronto', text: 'Recuérdale a tu cliente por WhatsApp o renueva antes de que venza, con un toque.' },
    { target: '[data-tour="tabs"]', title: 'Por estado', text: '<b>Pendientes</b> = pedidos «a pedido» que tu proveedor está preparando.' },
    { target: '[data-tour="orders-list"] > :first-child', title: 'Cada pedido', text: '<b>Enviar</b> manda las credenciales a tu cliente por WhatsApp. También puedes renovar, editar los datos del cliente o pedir soporte. Toca la flecha para ver las credenciales.' },
  ],
  'd-saldo': [
    { title: 'Mi saldo', text: 'Cada recarga, compra y devolución, con el saldo que te quedó después.' },
    { target: '[data-tour="saldo-card"]', title: 'Saldo disponible', text: 'Toca <b>Recargar saldo</b> para ver los métodos de pago de tu proveedor.' },
  ],
  'd-carrito': [
    { title: 'Tu carrito', text: 'Revisa lo que vas a comprar. Cada unidad es un pedido.' },
    { target: '[data-tour="cart-items"]', title: 'Productos', text: 'Cambia cantidades o quita lo que no quieras.' },
    { target: '[data-tour="cart-summary"]', title: 'Paga con tu saldo', text: 'Al comprar pones el nombre y WhatsApp de tu cliente (opcional). Las cuentas se entregan al instante.' },
  ],
  'd-soporte': [
    { title: 'Soporte', text: 'Si una cuenta falla, abre un ticket desde <b>Mis pedidos</b> con el botón de soporte del pedido. Aquí ves cómo va.' },
    { target: '[data-tour="dist-tickets"]', title: 'Tus tickets', text: 'Estado, respuesta de tu proveedor y un botón para escribirle por WhatsApp.' },
  ],
  'd-perfil': [
    { title: 'Mi perfil', text: 'Tus datos, tu contraseña, tus colores y el mensaje que envías a tus clientes.' },
    { target: '[data-tour="profile-template"]', title: 'Plantilla de WhatsApp', text: 'Personaliza el mensaje con las credenciales. Toca una variable (cliente, correo, contraseña…) para agregarla.' },
    { target: '[data-tour="profile-colors"]', title: 'Tus colores', text: 'Cambia los colores del panel solo para ti.' },
  ],
}

// Pantalla → guía que sale la primera vez (y con el botón de la cabecera)
export const ROUTE_TOURS = {
  '/proveedor': 'p-inicio',
  '/proveedor/pendientes': 'p-pendientes',
  '/proveedor/productos': 'p-productos',
  '/proveedor/stock': 'p-stock',
  '/proveedor/ventas': 'p-ventas',
  '/proveedor/distribuidores': 'p-distribuidores',
  '/proveedor/avisos': 'p-avisos',
  '/proveedor/soporte': 'p-soporte',
  '/proveedor/configuracion': 'p-config',
  '/tienda': 'd-tienda',
  '/dashboard': 'd-pedidos',
  '/saldo': 'd-saldo',
  '/carrito': 'd-carrito',
  '/soporte': 'd-soporte',
  '/perfil': 'd-perfil',
}
