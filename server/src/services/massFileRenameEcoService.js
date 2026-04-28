import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatEcoNumber } from './ecoSettingsService.js';
import {
  doesStageMatchEcoPipelineTypes,
  getPrimaryEcoPipelineType,
} from './ecoPipelineService.js';
import { regenerateCadText } from './cadFileService.js';
import { assertSafeLeafName, resolvePathWithinBase } from '../utils/safeFsPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_BASE = path.resolve(__dirname, '../../..', 'library');

const PRE_PRODUCTION_STATUSES = new Set([
  'new',
  'reviewing',
  'prototype',
]);

const FILE_TYPE_SUBDIR = Object.freeze({
  footprint: 'footprint',
  symbol: 'symbol',
  model: 'model',
  pspice: 'pspice',
  pad: 'pad',
});

export const MASS_FILE_RENAME_LABEL = 'Shared File Rename';

export const resolveMassFileRenamePipelineTypes = (originalStatuses = []) => {
  const pipelineTypes = new Set(['filename']);

  originalStatuses.forEach((status) => {
    if (status === 'production') {
      pipelineTypes.add('prod_status_change');
    }

    if (PRE_PRODUCTION_STATUSES.has(status)) {
      pipelineTypes.add('proto_status_change');
    }
  });

  return [...pipelineTypes];
};

export const buildMassFileRenameSummary = (files = [], affectedComponentCount = 0) => {
  if (!Array.isArray(files) || files.length === 0) {
    return `Shared file rename (${affectedComponentCount} part${affectedComponentCount === 1 ? '' : 's'})`;
  }

  if (files.length === 1) {
    const [file] = files;
    return `${file.old_file_name} -> ${file.new_file_name} (${affectedComponentCount} part${affectedComponentCount === 1 ? '' : 's'})`;
  }

  const firstFile = files[0];
  return `${firstFile.old_file_name} +${files.length - 1} file${files.length === 2 ? '' : 's'} -> ${firstFile.new_file_name} (${affectedComponentCount} part${affectedComponentCount === 1 ? '' : 's'})`;
};

const consumeNextEcoNumber = async (client) => {
  let settingsResult = await client.query('SELECT * FROM eco_settings LIMIT 1 FOR UPDATE');

  if (settingsResult.rows.length === 0) {
    settingsResult = await client.query(`
      INSERT INTO eco_settings (prefix, leading_zeros, next_number)
      VALUES ($1, 1, 1)
      RETURNING *
    `, ['ECO-']);
  }

  const settings = settingsResult.rows[0];
  const nextNumber = Number.isInteger(settings.next_number) ? settings.next_number : 1;
  const ecoNumber = formatEcoNumber(settings.prefix, nextNumber);

  await client.query(
    'UPDATE eco_settings SET next_number = $1, leading_zeros = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [nextNumber + 1, settings.id],
  );

  return ecoNumber;
};

export const createMassFileRenameEco = async (client, {
  user,
  files,
  affectedComponents,
  notes = null,
} = {}) => {
  if (!user?.id) {
    throw new Error('User context is required for shared file rename ECOs');
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('At least one renamed file is required');
  }

  if (!Array.isArray(affectedComponents) || affectedComponents.length === 0) {
    throw new Error('At least one affected component is required');
  }

  const pipelineTypes = resolveMassFileRenamePipelineTypes(
    affectedComponents.map((component) => component.approval_status),
  );
  const pipelineType = getPrimaryEcoPipelineType(pipelineTypes);

  const stageOrderResult = await client.query(`
    SELECT stage_order, pipeline_types
    FROM eco_approval_stages
    WHERE is_active = true
    ORDER BY stage_order ASC, id ASC
  `);

  const matchingStageOrders = stageOrderResult.rows
    .filter((stage) => doesStageMatchEcoPipelineTypes(stage.pipeline_types, pipelineTypes))
    .map((stage) => stage.stage_order)
    .filter((stageOrder) => stageOrder !== null && stageOrder !== undefined);

  const firstStageOrder = matchingStageOrders.length > 0
    ? Math.min(...matchingStageOrders)
    : null;

  const ecoNumber = await consumeNextEcoNumber(client);
  const summary = buildMassFileRenameSummary(files, affectedComponents.length);
  const ecoNotes = notes || summary;

  const ecoResult = await client.query(`
    INSERT INTO eco_orders (
      eco_number,
      component_id,
      part_number,
      initiated_by,
      notes,
      current_stage_order,
      pipeline_type,
      pipeline_types
    )
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    ecoNumber,
    MASS_FILE_RENAME_LABEL,
    user.id,
    ecoNotes,
    firstStageOrder,
    pipelineType,
    pipelineTypes,
  ]);

  const eco = ecoResult.rows[0];

  for (const file of files) {
    await client.query(`
      INSERT INTO eco_file_rename_files (
        eco_id,
        cad_file_id,
        file_type,
        old_file_name,
        new_file_name
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      eco.id,
      file.cad_file_id,
      file.file_type,
      file.old_file_name,
      file.new_file_name,
    ]);
  }

  for (const component of affectedComponents) {
    await client.query(`
      INSERT INTO eco_file_rename_components (
        eco_id,
        component_id,
        part_number,
        original_approval_status
      )
      VALUES ($1, $2, $3, $4)
    `, [
      eco.id,
      component.id,
      component.part_number,
      component.approval_status,
    ]);
  }

  await client.query(`
    UPDATE components
    SET
      approval_status = 'reviewing',
      approval_user_id = $1,
      approval_date = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY($2::uuid[])
  `, [
    user.id,
    affectedComponents.map((component) => component.id),
  ]);

  return {
    eco,
    summary,
    pipelineTypes,
  };
};

export const getMassFileRenameContext = async (db, ecoId) => {
  const [filesResult, componentsResult] = await Promise.all([
    db.query(`
      SELECT
        eff.*,
        cf.file_name as current_file_name,
        cf.file_type as current_file_type
      FROM eco_file_rename_files eff
      LEFT JOIN cad_files cf ON eff.cad_file_id = cf.id
      WHERE eff.eco_id = $1
      ORDER BY eff.id ASC
    `, [ecoId]),
    db.query(`
      SELECT
        efc.*,
        c.approval_status as current_approval_status
      FROM eco_file_rename_components efc
      LEFT JOIN components c ON efc.component_id = c.id
      WHERE efc.eco_id = $1
      ORDER BY efc.part_number ASC
    `, [ecoId]),
  ]);

  if (filesResult.rows.length === 0) {
    return null;
  }

  return {
    files: filesResult.rows,
    components: componentsResult.rows,
  };
};

export const attachMassFileRenameMetadata = async (db, ecos) => {
  if (!Array.isArray(ecos) || ecos.length === 0) {
    return ecos;
  }

  const ecoIds = [...new Set(ecos.map((eco) => eco.id).filter(Boolean))];
  if (ecoIds.length === 0) {
    return ecos;
  }

  const [filesResult, componentsResult] = await Promise.all([
    db.query(`
      SELECT *
      FROM eco_file_rename_files
      WHERE eco_id = ANY($1::uuid[])
      ORDER BY eco_id ASC, id ASC
    `, [ecoIds]),
    db.query(`
      SELECT *
      FROM eco_file_rename_components
      WHERE eco_id = ANY($1::uuid[])
      ORDER BY eco_id ASC, part_number ASC
    `, [ecoIds]),
  ]);

  const filesByEcoId = new Map();
  filesResult.rows.forEach((row) => {
    if (!filesByEcoId.has(row.eco_id)) {
      filesByEcoId.set(row.eco_id, []);
    }
    filesByEcoId.get(row.eco_id).push(row);
  });

  const componentsByEcoId = new Map();
  componentsResult.rows.forEach((row) => {
    if (!componentsByEcoId.has(row.eco_id)) {
      componentsByEcoId.set(row.eco_id, []);
    }
    componentsByEcoId.get(row.eco_id).push(row);
  });

  return ecos.map((eco) => {
    const files = filesByEcoId.get(eco.id) || [];
    if (files.length === 0) {
      return eco;
    }

    const affectedComponents = componentsByEcoId.get(eco.id) || [];
    return {
      ...eco,
      is_mass_file_rename: true,
      component_part_number: eco.component_part_number || MASS_FILE_RENAME_LABEL,
      component_description: eco.component_description || buildMassFileRenameSummary(files, affectedComponents.length),
      mass_file_rename_files: files,
      affected_component_count: affectedComponents.length,
      affected_components: affectedComponents,
    };
  });
};

export const buildMassFileRenameCadRows = (context) => {
  if (!context?.files) {
    return [];
  }

  return context.files.map((file) => ({
    action: 'rename',
    cad_file_id: file.cad_file_id,
    file_type: file.file_type,
    file_name: file.old_file_name,
    new_file_name: file.new_file_name,
    existing_file_name: file.current_file_name,
    existing_file_type: file.current_file_type,
  }));
};

export const restoreMassFileRenameStatuses = async (client, ecoId, actorId = null) => {
  const result = await client.query(`
    UPDATE components AS c
    SET
      approval_status = efc.original_approval_status,
      approval_user_id = $2,
      approval_date = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    FROM eco_file_rename_components AS efc
    WHERE efc.eco_id = $1
      AND c.id = efc.component_id
    RETURNING c.id, c.part_number, c.approval_status
  `, [ecoId, actorId]);

  return result.rows;
};

export const applyMassFileRenameEco = async (client, ecoId, actorId = null) => {
  const context = await getMassFileRenameContext(client, ecoId);
  if (!context) {
    throw new Error(`Shared file rename ECO ${ecoId} has no staged files`);
  }

  const renamedPaths = [];
  const fileTypesByComponentId = new Map();

  try {
    for (const file of context.files) {
      const subdir = FILE_TYPE_SUBDIR[file.file_type];
      if (!subdir) {
        throw new Error(`Unsupported CAD file type: ${file.file_type}`);
      }

      const oldFileName = assertSafeLeafName(file.old_file_name, 'oldFileName');
      const newFileName = assertSafeLeafName(file.new_file_name, 'newFileName');

      const currentFileResult = await client.query(
        'SELECT id, file_name, file_type FROM cad_files WHERE id = $1',
        [file.cad_file_id],
      );

      if (currentFileResult.rows.length === 0) {
        throw new Error(`CAD file ${file.cad_file_id} no longer exists`);
      }

      const currentFile = currentFileResult.rows[0];
      const currentFileName = assertSafeLeafName(currentFile.file_name, 'fileName');

      if (currentFileName !== oldFileName && currentFileName !== newFileName) {
        throw new Error(`CAD file "${oldFileName}" changed while ECO was pending`);
      }

      if (currentFileName === oldFileName) {
        const oldPath = resolvePathWithinBase(LIBRARY_BASE, subdir, oldFileName);
        const newPath = resolvePathWithinBase(LIBRARY_BASE, subdir, newFileName);

        if (oldFileName !== newFileName && fs.existsSync(newPath)) {
          throw new Error(`File "${newFileName}" already exists in the ${file.file_type} directory`);
        }

        if (fs.existsSync(oldPath) && oldFileName !== newFileName) {
          fs.renameSync(oldPath, newPath);
          renamedPaths.push({ oldPath, newPath });
        }

        await client.query(`
          UPDATE cad_files
          SET file_name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [newFileName, `${subdir}/${newFileName}`, currentFile.id]);
      }

      context.components.forEach((component) => {
        if (!component.component_id) {
          return;
        }

        if (!fileTypesByComponentId.has(component.component_id)) {
          fileTypesByComponentId.set(component.component_id, new Set());
        }

        fileTypesByComponentId.get(component.component_id).add(file.file_type);
      });
    }

    for (const [componentId, fileTypes] of fileTypesByComponentId.entries()) {
      for (const fileType of fileTypes) {
        await regenerateCadText(componentId, fileType, client);
      }
    }

    const restoredComponents = await restoreMassFileRenameStatuses(client, ecoId, actorId);

    return {
      deleted: false,
      statusChange: restoredComponents.length > 0,
      renamedFilesApplied: context.files.length,
      affectedComponentsRestored: restoredComponents.length,
    };
  } catch (error) {
    for (let index = renamedPaths.length - 1; index >= 0; index -= 1) {
      const renamedPath = renamedPaths[index];
      try {
        if (fs.existsSync(renamedPath.newPath)) {
          fs.renameSync(renamedPath.newPath, renamedPath.oldPath);
        }
      } catch {
        // Best-effort filesystem rollback while the database transaction rolls back.
      }
    }

    throw error;
  }
};
