/* NY27 — guía web móvil. Sin frameworks ni compilación.
   Contenido: data/dia-1.json … data/dia-6.json. Estructura y textos: UX.md. Visual y movimiento: DESIGN.md.

   Tiempo: Open-Meteo (https://open-meteo.com), servicio gratuito sin clave ni tarjeta.
   Open-Meteo pide atribución (CC BY 4.0). Pendiente de decidir dónde mostrarla. */
(function () {
  'use strict';

  var DIAS = [1, 2, 3, 4, 5, 6];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var SECCIONES = [['lugares', 'Lugares'], ['comer', 'Comer'], ['tiendas', 'Tiendas'], ['cine', 'Cine'], ['wc', 'WC']];
  var PASOS = [['linea', 'Línea'], ['salida', 'Salida'], ['direccion', 'Dirección'], ['transbordos', 'Transbordos'], ['llegada', 'Llegada']];

  // Manhattan (ubicación fija; la app no usa la ubicación del móvil)
  var TIEMPO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.7831&longitude=-73.9712' +
    '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min' +
    '&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=1';

  // Código del tiempo del servicio (WMO) -> icono de icons/. Dos nombres = [día, noche].
  // Sin icono propio (niebla, llovizna helada, lluvia helada) y códigos desconocidos: cloudy.svg
  var ICONO_TIEMPO = {
    0: ['day', 'night'], 1: ['day', 'night'],
    2: ['cloudy-day-1', 'cloudy-night-1'],
    3: 'cloudy',
    51: 'rainy-1', 53: 'rainy-1', 55: 'rainy-3',
    61: 'rainy-1', 63: 'rainy-3', 65: 'rainy-6',
    80: 'rainy-1', 81: 'rainy-3', 82: 'rainy-6',
    71: 'snowy-3', 73: 'snowy-5', 75: 'snowy-6', 77: 'snowy-3',
    85: 'snowy-3', 86: 'snowy-6',
    95: 'thunder', 96: 'thunder', 99: 'thunder'
  };
  function iconoTiempo(codigo, esDia) {
    var e = ICONO_TIEMPO[codigo];
    if (Array.isArray(e)) return e[esDia ? 0 : 1];
    return e || 'cloudy';
  }

  var REDUCIR = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var estado = {
    datos: {},            // n -> contenido del día (o null si no se pudo cargar)
    dia: 1,
    tiempo: { estado: 'cargando' },
    pantalla: null,       // 'dia' | 'zona' | 'transporte'
    inicioHecho: false,
    scrollDia: 0
  };

  var raiz = document.getElementById('app');

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(v) { return (typeof v === 'string' || typeof v === 'number') && String(v).trim() ? String(v).trim() : ''; }
  function elementos(a) { return Array.isArray(a) ? a.filter(function (e) { return e && txt(e.nombre); }) : []; }

  function parseFecha(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function fechaLarga(iso) { var f = parseFecha(iso); return f ? f.d + ' de ' + MESES[f.m - 1] : ''; }
  function fechaCorta(iso) { var f = parseFecha(iso); return f ? String(f.d) : ''; }

  // Movimiento de entrada (DESIGN.md, sección 11). Con "reducir movimiento", sin animación.
  function cls(tipo) { return REDUCIR ? '' : ' anim-' + tipo; }
  function sty(ms) { return REDUCIR || !ms ? '' : ' style="--d:' + ms + 'ms"'; }
  function retrasoTarjeta(i, base) { return i < 6 ? base + i * 120 : base; }

  // Enlace a Google Maps: abre la ficha del sitio (nombre + dirección), no la ruta
  function mapsUrl(e) {
    var q = [txt(e.nombre), txt(e.direccion)].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  /* ---------- Datos ---------- */
  // Formato plano: lista "zonas" en orden de visita, cada una con su campo "tramo" ("mañana", "tarde").
  // Se agrupa en tramos consecutivos para que la app trabaje siempre con "tramos".
  function agruparZonas(zonas) {
    var tramos = [], actual = null;
    zonas.forEach(function (z) {
      if (!z) return;
      var et = txt(z.tramo);
      et = et ? et.charAt(0).toUpperCase() + et.slice(1).toLowerCase() : '';
      if (!actual || (et && et !== actual.etiqueta)) {
        actual = { etiqueta: et, zonas: [] };
        tramos.push(actual);
      }
      actual.zonas.push(z);
    });
    return tramos;
  }

  function normalizar(d) {
    if (!d || typeof d !== 'object') return null;
    if (!Array.isArray(d.tramos) && Array.isArray(d.zonas)) d.tramos = agruparZonas(d.zonas);
    var k = 0;
    (Array.isArray(d.tramos) ? d.tramos : []).forEach(function (t) {
      (t && Array.isArray(t.zonas) ? t.zonas : []).forEach(function (z) {
        if (z) { k++; z._id = txt(z.id) || ('z' + k); }
      });
    });
    return d;
  }

  function cargarDia(n) {
    return fetch('data/dia-' + n + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) { throw new Error('http'); } return r.json(); })
      .then(function (d) { estado.datos[n] = normalizar(d); })
      .catch(function () { estado.datos[n] = null; });
  }

  function diaDeHoy() {
    var t = new Date();
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    var iso = t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
    for (var i = 0; i < DIAS.length; i++) {
      var d = estado.datos[DIAS[i]];
      if (d && d.fecha === iso) return DIAS[i];
    }
    return 1;
  }

  function zonasDelDia(n) {
    var d = estado.datos[n], out = [];
    if (!d || !Array.isArray(d.tramos)) return out;
    d.tramos.forEach(function (t) {
      (t && Array.isArray(t.zonas) ? t.zonas : []).forEach(function (z) { if (z && txt(z.nombre)) out.push(z); });
    });
    return out;
  }
  function buscarZona(n, id) {
    var zs = zonasDelDia(n);
    for (var i = 0; i < zs.length; i++) { if (zs[i]._id === id) return zs[i]; }
    return null;
  }

  /* ---------- Tiempo ---------- */
  function pedirTiempo() {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var corte = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    fetch(TIEMPO_URL, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) { throw new Error('http'); } return r.json(); })
      .then(function (j) {
        var t = j && j.current && j.current.temperature_2m;
        var mx = j && j.daily && j.daily.temperature_2m_max && j.daily.temperature_2m_max[0];
        var mn = j && j.daily && j.daily.temperature_2m_min && j.daily.temperature_2m_min[0];
        [t, mx, mn].forEach(function (v) { if (typeof v !== 'number' || !isFinite(v)) { throw new Error('datos'); } });
        var codigo = j.current.weather_code;
        var esDia = j.current.is_day !== 0;
        estado.tiempo = { estado: 'ok', actual: Math.round(t), max: Math.round(mx), min: Math.round(mn), icono: iconoTiempo(codigo, esDia) };
      })
      .catch(function () { estado.tiempo = { estado: 'error' }; })
      .then(function () { clearTimeout(corte); pintarTiempo(); });
  }

  function pintarTiempo() {
    var temp = document.getElementById('t-actual');
    var pil = document.getElementById('t-pildora');
    if (!temp || !pil) return;
    var t = estado.tiempo;
    if (t.estado === 'ok') {
      temp.textContent = t.actual + '°';
      temp.hidden = false;
      pil.innerHTML = '<img src="icons/weather/' + t.icono + '.svg" alt="" width="24" height="24"><span>Máx. ' + t.max + '°</span><span aria-hidden="true">·</span><span>Mín. ' + t.min + '°</span>';
      pil.hidden = false;
    } else if (t.estado === 'error') {
      temp.hidden = true;
      pil.innerHTML = '<span>Sin datos</span>';
      pil.hidden = false;
    } else {
      temp.hidden = true;
      pil.hidden = true;
    }
  }

  /* ---------- Pantalla Día ---------- */
  function htmlTabs() {
    return DIAS.map(function (n) {
      var d = estado.datos[n], f = d && d.fecha, sel = n === estado.dia;
      return '<button type="button" class="tab" role="tab" data-dia="' + n + '" aria-selected="' + sel + '"' +
        ' aria-label="Día ' + n + (f ? ', ' + esc(fechaLarga(f)) : '') + '">' +
        '<span class="tab-fecha">' + (esc(fechaCorta(f)) || '&nbsp;') + '</span>' +
        '<span class="tab-num">' + n + '</span></button>';
    }).join('');
  }

  function htmlTransTarjeta(tr, retraso) {
    var min = txt(tr.minutos);
    return '<button type="button" class="tarjeta-trans' + cls('sube') + '"' + sty(retraso) + ' data-ir="transporte">' +
      '<span class="ic ic-tren"></span>' +
      '<span class="trans-texto"><span class="trans-titulo">Cómo llegar</span>' +
      (min ? '<span class="trans-sub">' + esc(min) + ' min</span>' : '') + '</span>' +
      '<span class="ic ic-chevron"></span></button>';
  }

  function htmlZonaTarjeta(z, retraso) {
    return '<button type="button" class="tarjeta-zona' + cls('sube') + '"' + sty(retraso) + ' data-zona="' + esc(z._id) + '">' +
      '<span class="zona-nombre">' + esc(z.nombre) + '</span>' +
      '<span class="zona-flecha"><span class="ic ic-flecha"></span></span></button>';
  }

  function tieneTransporte(tr) {
    if (!tr || typeof tr !== 'object') return false;
    return ['minutos', 'linea', 'salida', 'direccion', 'transbordos', 'llegada'].some(function (k) { return txt(tr[k]) !== ''; });
  }

  function htmlRuta(n, base) {
    var d = estado.datos[n];
    if (!d) return '';
    var modulos = [];
    (Array.isArray(d.tramos) ? d.tramos : []).forEach(function (t) {
      if (!t) return;
      var items = [];
      (Array.isArray(t.zonas) ? t.zonas : []).forEach(function (z) {
        if (z && txt(z.nombre)) items.push({ tipo: 'zona', z: z });
      });
      modulos.push({ etiqueta: txt(t.etiqueta), items: items });
    });
    // Cómo llegar es el primer paso de la ruta (dentro del primer módulo)
    if (tieneTransporte(d.transporte)) {
      if (!modulos.length) modulos.push({ etiqueta: '', items: [] });
      modulos[0].items.unshift({ tipo: 'trans', tr: d.transporte });
    }
    var html = '', i = 0;
    modulos.forEach(function (m) {
      if (!m.items.length) return;
      var tarjetas = '', primero = null;
      m.items.forEach(function (it) {
        var r = retrasoTarjeta(i++, base);
        if (primero === null) primero = r;
        tarjetas += it.tipo === 'trans' ? htmlTransTarjeta(it.tr, r) : htmlZonaTarjeta(it.z, r);
      });
      html += '<section class="modulo">' +
        (m.etiqueta ? '<p class="etiqueta' + cls('sube') + '"' + sty(primero) + '>' + esc(m.etiqueta) + '</p>' : '') +
        tarjetas + '</section>';
    });
    return html;
  }

  function renderDia(completa) {
    var n = estado.dia, d = estado.datos[n];
    document.documentElement.className = 'pantalla-dia';
    estado.pantalla = 'dia';
    var base = completa ? 600 : 0;
    raiz.innerHTML =
      '<main class="pantalla">' +
      '<img class="dia-hero" src="img/cabecera.png" alt="" width="393" height="218" draggable="false">' +
      '<header class="dia-cab' + (completa ? cls('funde') : '') + '">' +
        '<div class="dia-cab-texto"><p class="d-xl">NY27</p><p class="d-xl" id="t-actual" hidden></p></div>' +
        '<div class="pildora" id="t-pildora" hidden></div>' +
      '</header>' +
      '<div class="dia-cuerpo">' +
        '<div' + (completa ? ' class="' + cls('sube').trim() + '"' + sty(300) : '') + '>' +
          '<nav class="tabs" role="tablist" aria-label="Días">' + htmlTabs() + '</nav>' +
          '<p class="fecha-dia" id="fecha-dia">' + esc(d ? fechaLarga(d.fecha) : '') + '</p>' +
        '</div>' +
        '<div class="ruta" id="ruta">' + htmlRuta(n, base) + '</div>' +
      '</div></main>';
    pintarTiempo();
  }

  // Cambio de tab: solo se animan las tarjetas del nuevo día
  function cambiarDia(n) {
    if (n === estado.dia) return;
    estado.dia = n;
    history.replaceState(history.state, '', '#/dia/' + n);
    var d = estado.datos[n];
    Array.prototype.forEach.call(raiz.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(+b.getAttribute('data-dia') === n));
    });
    document.getElementById('fecha-dia').textContent = d ? fechaLarga(d.fecha) : '';
    document.getElementById('ruta').innerHTML = htmlRuta(n, 0);
  }

  /* ---------- Pantalla Zona ---------- */
  function htmlVolver() {
    return '<button type="button" class="volver" data-volver><span class="ic ic-volver"></span><span>Volver</span></button>';
  }

  function renderZona(n, id) {
    var z = buscarZona(n, id);
    if (!z) { irDiaSinHistorial(); return; }
    document.documentElement.className = 'pantalla-clara';
    estado.pantalla = 'zona';

    var secciones = SECCIONES.map(function (s) { return { key: s[0], nombre: s[1], items: elementos(z[s[0]]) }; })
      .filter(function (s) { return s.items.length; });

    var accesos = secciones.map(function (s, i) {
      return '<button type="button" class="acceso" data-acceso="' + s.key + '" aria-pressed="' + (i === 0) + '">' + s.nombre + '</button>';
    }).join('');

    var fila = 0;
    var cuerpo = secciones.map(function (s) {
      var lis = s.items.map(function (e) {
        var desc = txt(e.descripcion);
        var li = '<li' + (REDUCIR ? '' : ' class="anim-sube"') + sty(retrasoTarjeta(fila++, 0)) + '>' +
          '<a class="elemento" href="' + esc(mapsUrl(e)) + '" target="_blank" rel="noopener">' +
          '<span class="elemento-texto"><span class="elemento-nombre">' + esc(e.nombre) + '</span>' +
          (desc ? '<span class="elemento-desc" style="display:block">' + esc(desc) + '</span>' : '') + '</span>' +
          '<span class="ic ic-pin"></span></a></li>';
        return li;
      }).join('');
      return '<section class="seccion" id="sec-' + s.key + '">' +
        '<h2 class="seccion-titulo"><span class="ic ic-sec ic-' + s.key + '"></span>' + s.nombre + '</h2>' +
        '<ul class="lista">' + lis + '</ul></section>';
    }).join('');

    raiz.innerHTML =
      '<main class="pantalla pantalla-interior">' +
      htmlVolver() +
      '<header class="zona-cab"><h1>' + esc(z.nombre) + '</h1>' +
        (txt(z.descripcion) ? '<p>' + esc(z.descripcion) + '</p>' : '') + '</header>' +
      (secciones.length ? '<nav class="accesos" aria-label="Secciones de la zona">' + accesos + '</nav>' : '') +
      (secciones.length ? '<div class="secciones">' + cuerpo + '</div>' : '') +
      '</main>';
  }

  /* ---------- Pantalla Cómo llegar ---------- */
  function renderTransporte(n) {
    var d = estado.datos[n];
    if (!d || !tieneTransporte(d.transporte)) { irDiaSinHistorial(); return; }
    var tr = d.transporte;
    var zs = zonasDelDia(n);
    var destino = zs.length ? zs[0].nombre : '';
    document.documentElement.className = 'pantalla-clara';
    estado.pantalla = 'transporte';

    var pasos = PASOS.filter(function (p) { return txt(tr[p[0]]) !== ''; });
    var html = pasos.map(function (p, i) {
      var k = p[0], v = esc(txt(tr[k]));
      var cuerpo;
      if (k === 'linea') {
        cuerpo = '<div class="paso-tarjeta paso-linea"><span class="paso-cat">' + p[1] + '</span><span class="linea-circulo">' + v + '</span></div>';
      } else {
        var grande = (k === 'transbordos' || k === 'llegada');
        cuerpo = '<div class="paso-tarjeta"><span class="paso-cat">' + p[1] + '</span><span class="paso-valor' + (grande ? ' h4' : '') + '">' + v + '</span></div>';
      }
      return '<div class="paso' + cls('sube') + '"' + sty(retrasoTarjeta(i, 0)) + '>' + (i > 0 ? '<div class="conector"></div>' : '') + cuerpo + '</div>';
    }).join('');

    raiz.innerHTML =
      '<main class="pantalla pantalla-interior">' +
      htmlVolver() +
      '<header class="trans-cab"><div class="trans-cab-fila"><span class="ic ic-tren"></span><h1>Cómo llegar</h1></div>' +
        (destino ? '<p>' + esc(destino) + '</p>' : '') + '</header>' +
      '<div class="pasos">' + html + '</div></main>';
  }

  /* ---------- Navegación (dos niveles) ---------- */
  function leerRuta() {
    var p = (location.hash || '').replace(/^#\/?/, '').split('/');
    var dia = parseInt(p[1], 10);
    var zona = null;
    try { zona = p[2] ? decodeURIComponent(p[2]) : null; } catch (e) { zona = null; }
    return { pant: p[0], dia: DIAS.indexOf(dia) >= 0 ? dia : null, zona: zona };
  }

  function pintar() {
    var r = leerRuta();
    if (r.dia !== null) estado.dia = r.dia;
    if (r.pant === 'zona' && r.dia !== null && r.zona) {
      renderZona(estado.dia, r.zona);
      window.scrollTo(0, 0);
    } else if (r.pant === 'transporte' && r.dia !== null) {
      renderTransporte(estado.dia);
      window.scrollTo(0, 0);
    } else {
      var primera = !estado.inicioHecho;
      renderDia(primera);
      estado.inicioHecho = true;
      window.scrollTo(0, primera ? 0 : estado.scrollDia);
    }
  }

  function ir(hash) {
    if (estado.pantalla === 'dia') estado.scrollDia = window.pageYOffset || 0;
    var n = ((history.state && history.state.n) || 0) + 1;
    history.pushState({ n: n }, '', hash);
    pintar();
  }

  function irDiaSinHistorial() {
    history.replaceState({ n: 0 }, '', '#/dia/' + estado.dia);
    pintar();
  }

  function volver() {
    if (history.state && history.state.n > 0) history.back();
    else irDiaSinHistorial();
  }

  raiz.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dia],[data-zona],[data-ir],[data-volver],[data-acceso]');
    if (!b || !raiz.contains(b)) return;
    if (b.hasAttribute('data-dia')) {
      cambiarDia(parseInt(b.getAttribute('data-dia'), 10));
    } else if (b.hasAttribute('data-zona')) {
      ir('#/zona/' + estado.dia + '/' + encodeURIComponent(b.getAttribute('data-zona')));
    } else if (b.hasAttribute('data-ir')) {
      ir('#/transporte/' + estado.dia);
    } else if (b.hasAttribute('data-volver')) {
      volver();
    } else if (b.hasAttribute('data-acceso')) {
      var k = b.getAttribute('data-acceso');
      Array.prototype.forEach.call(raiz.querySelectorAll('.acceso'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      var sec = document.getElementById('sec-' + k);
      if (sec) sec.scrollIntoView({ block: 'start' });   // salto directo, sin animación
    }
  });

  window.addEventListener('popstate', pintar);

  /* ---------- Arranque ---------- */
  function arrancar() {
    pedirTiempo();   // se pide al abrir la app
    Promise.all(DIAS.map(cargarDia)).then(function () {
      estado.dia = diaDeHoy();   // cada apertura vuelve al día de hoy (o al Día 1 antes del viaje)
      history.replaceState({ n: 0 }, '', location.pathname + location.search + '#/dia/' + estado.dia);
      pintar();
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* sin conexión o sin permiso: la app sigue funcionando */ });
    });
  }

  arrancar();
})();
