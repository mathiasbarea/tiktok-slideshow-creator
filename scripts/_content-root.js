const path = require('path');

function findOpenClawHome(startDir = __dirname) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (path.basename(currentDir).toLowerCase() === '.openclaw') {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function getCanonicalWorkspaceContentRoot(startDir = __dirname) {
  const openClawHome = findOpenClawHome(startDir);
  if (!openClawHome) return null;
  return path.join(openClawHome, 'workspace', 'content');
}

function isWithin(parentDir, candidateDir) {
  const relative = path.relative(path.resolve(parentDir), path.resolve(candidateDir));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function resolveContentRoot(dirArg, { scriptDir = __dirname } = {}) {
  const canonicalContentRoot = getCanonicalWorkspaceContentRoot(scriptDir);
  if (!dirArg) {
    return canonicalContentRoot || path.resolve('content');
  }

  const resolvedDir = path.resolve(dirArg);
  if (!canonicalContentRoot) {
    return resolvedDir;
  }

  const workspaceDir = path.dirname(canonicalContentRoot);
  if (resolvedDir === canonicalContentRoot) {
    return resolvedDir;
  }

  if (resolvedDir === workspaceDir || isWithin(workspaceDir, resolvedDir)) {
    throw new Error(`Refusing to use non-canonical OpenClaw content root "${resolvedDir}". Use "${canonicalContentRoot}" instead.`);
  }

  return resolvedDir;
}

module.exports = {
  getCanonicalWorkspaceContentRoot,
  resolveContentRoot,
};
