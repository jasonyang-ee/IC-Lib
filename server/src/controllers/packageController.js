import * as packageService from '../services/packageService.js';

const sendServiceError = (error, res, next) => {
  if (error instanceof packageService.PackageServiceError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Package name or alias already exists' });
  }
  return next(error);
};

export const getPackages = async (req, res, next) => {
  try {
    if (Object.hasOwn(req.query, 'resolve')) {
      return res.json(await packageService.resolvePackage(req.query.resolve));
    }
    return res.json(await packageService.listPackages());
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const getPackageById = async (req, res, next) => {
  try {
    const packageRow = await packageService.getActivePackage(req.params.id);
    if (!packageRow) return res.status(404).json({ error: 'Package not found' });
    return res.json(packageRow);
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const createPackage = async (req, res, next) => {
  try {
    return res.status(201).json(await packageService.createPackage(req.body));
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const updatePackage = async (req, res, next) => {
  try {
    return res.json(await packageService.updatePackage(req.params.id, req.body));
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const deletePackage = async (req, res, next) => {
  try {
    const result = await packageService.deletePackage(req.params.id);
    return res.json({
      message: result.deactivated ? 'Built-in package deactivated successfully' : 'Package deleted successfully',
      ...result,
    });
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const createAlias = async (req, res, next) => {
  try {
    return res.status(201).json(await packageService.createAlias(req.params.id, req.body?.alias));
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const updateAlias = async (req, res, next) => {
  try {
    return res.json(await packageService.updateAlias(req.params.id, req.params.aliasId, req.body?.alias));
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const deleteAlias = async (req, res, next) => {
  try {
    await packageService.deleteAlias(req.params.id, req.params.aliasId);
    return res.json({ message: 'Package alias deleted successfully' });
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};

export const promoteAlias = async (req, res, next) => {
  try {
    return res.json(await packageService.promoteAlias(req.params.id, req.body?.alias));
  } catch (error) {
    return sendServiceError(error, res, next);
  }
};
