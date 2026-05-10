/**
 * Google Apps Script para Cuenta Clara / préstamos.
 * Funciona como mini API entre editor.html / visor.html y Google Drive.
 *
 * Propiedades necesarias en Project Settings > Script properties:
 *   ADMIN_TOKEN = token largo secreto para guardar
 *   FOLDER_ID   = ID de la carpeta de Drive donde se guardará el JSON cifrado
 *   FILE_NAME   = estado_prestamos_cifrado.json
 */

function doGet(e) {
  const action = (e.parameter.action || 'get').toLowerCase();
  const callback = e.parameter.callback || '';
  try {
    if (action === 'ping') {
      return output_({ ok: true, message: 'API funcionando', now: new Date().toISOString() }, callback);
    }
    if (action === 'get') {
      const props = PropertiesService.getScriptProperties();
      const folderId = props.getProperty('FOLDER_ID');
      const fileName = props.getProperty('FILE_NAME') || 'estado_prestamos_cifrado.json';
      if (!folderId) throw new Error('Falta configurar FOLDER_ID en Script properties.');
      const folder = DriveApp.getFolderById(folderId);
      const file = findFile_(folder, fileName);
      if (!file) return output_({ ok: false, code: 'NOT_FOUND', error: 'Todavía no existe archivo guardado.' }, callback);
      const text = file.getBlob().getDataAsString('UTF-8');
      return output_({ ok: true, fileName: fileName, updated: file.getLastUpdated().toISOString(), data: JSON.parse(text) }, callback);
    }
    return output_({ ok: false, error: 'Acción no reconocida.' }, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty('ADMIN_TOKEN');
    const folderId = props.getProperty('FOLDER_ID');
    const fileName = props.getProperty('FILE_NAME') || 'estado_prestamos_cifrado.json';
    if (!expectedToken) throw new Error('Falta configurar ADMIN_TOKEN en Script properties.');
    if (!folderId) throw new Error('Falta configurar FOLDER_ID en Script properties.');

    let adminToken = '';
    let encrypted = null;

    // Caso 1: POST desde form HTML
    if (e.parameter && e.parameter.adminToken) {
      adminToken = e.parameter.adminToken;
      encrypted = JSON.parse(e.parameter.encrypted || '{}');
    }

    // Caso 2: POST JSON directo
    if (!adminToken && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents || '{}');
      adminToken = body.adminToken || '';
      encrypted = body.encrypted || null;
    }

    if (adminToken !== expectedToken) throw new Error('ADMIN_TOKEN inválido. No se guardó nada.');
    if (!encrypted || !encrypted.payload || !encrypted.iv || !encrypted.salt) throw new Error('JSON cifrado inválido.');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const folder = DriveApp.getFolderById(folderId);
      const content = JSON.stringify(encrypted, null, 2);
      const file = findFile_(folder, fileName);
      if (file) {
        file.setContent(content);
      } else {
        folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      }
    } finally {
      lock.releaseLock();
    }

    return output_({ ok: true, saved: true, fileName: fileName, updated: new Date().toISOString() }, '');
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, '');
  }
}

function findFile_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
