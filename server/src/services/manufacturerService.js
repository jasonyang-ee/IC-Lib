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

  const created = await db.query(
    'INSERT INTO manufacturers (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
    [trimmed],
  );
  if (created.rows[0]) return created.rows[0].id;
  // Do not abort an enclosing catalog transaction when another insert wins.
  const duplicate = await db.query(
    'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)',
    [trimmed],
  );
  if (!duplicate.rows[0]) throw new Error('Manufacturer changed during creation; retry the save');
  return duplicate.rows[0].id;
};
