const { createMysqlConnection } = require('../config/database');

async function listClients(_req, res, next) {
  let connection;

  try {
    connection = await createMysqlConnection();
    const [rows] = await connection.execute(
      'SELECT id, client_id, mac_address, driver_name, plat_nomor, is_active, created_at FROM registered_clients ORDER BY created_at DESC'
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function createClient(req, res, next) {
  let connection;

  try {
    const { client_id, mac_address, driver_name, plat_nomor, is_active = 1 } = req.body;

    if (!client_id || !mac_address) {
      return res.status(400).json({ success: false, message: 'client_id and mac_address are required' });
    }

    connection = await createMysqlConnection();
    const [result] = await connection.execute(
      'INSERT INTO registered_clients (client_id, mac_address, driver_name, plat_nomor, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [client_id, mac_address, driver_name || null, plat_nomor || null, Number(is_active) ? 1 : 0]
    );

    return res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function updateClient(req, res, next) {
  let connection;

  try {
    const { id } = req.params;
    const { client_id, mac_address, driver_name, plat_nomor, is_active } = req.body;

    connection = await createMysqlConnection();
    await connection.execute(
      'UPDATE registered_clients SET client_id = ?, mac_address = ?, driver_name = ?, plat_nomor = ?, is_active = ? WHERE id = ?',
      [client_id, mac_address, driver_name || null, plat_nomor || null, Number(is_active) ? 1 : 0, id]
    );

    return res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function deleteClient(req, res, next) {
  let connection;

  try {
    const { id } = req.params;
    connection = await createMysqlConnection();
    await connection.execute('DELETE FROM registered_clients WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = {
  listClients,
  createClient,
  updateClient,
  deleteClient
};
