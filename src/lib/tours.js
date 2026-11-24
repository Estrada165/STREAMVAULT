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
}
