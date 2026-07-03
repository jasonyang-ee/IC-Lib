/**
 * Single get-or-create path for manufacturers (T9/D9). Matching is
 * case-insensitive (`LOWER(name)`) everywhere so `TI` and `ti` never become
 * two rows. `db` is the pool or a transaction client.
 */
export const getOrCreateManufacturer = async (db, name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed === 'N/A') {
    return null;
  }

  const existing = await db.query(
    'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)',
    [trimmed],
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  try {
    const created = await db.query(
      'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id',
      [trimmed],
    );
    return created.rows[0].id;
  } catch (error) {
    // Concurrent create of the same name: fall back to the winner's row.
    if (error.code !== '23505') {
      throw error;
    }
    const duplicate = await db.query(
      'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)',
      [trimmed],
    );
    return duplicate.rows[0]?.id || null;
  }
};
