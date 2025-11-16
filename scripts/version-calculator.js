#!/usr/bin/env node

/**
 * Version Calculator
 *
 * Calcola la nuova versione basata sui commit analysis e Semantic Versioning.
 * Supporta pre-release versions, build metadata e branch-specific versioning.
 */

const fs = require('fs');
const path = require('path');

class VersionCalculator {
  constructor(options = {}) {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.silent = options.silent || false;
  }

  /**
   * Logs a message if not in silent mode
   * @param {string} message The message to log
   */
  log(message) {
    if (!this.silent) {
      console.log(message);
    }
  }

  /**
   * Parse di una versione semantic
   * @param {string} version La versione da parsare (es: "1.2.3-alpha.1+build.123")
   * @returns {Object} Oggetto con componenti della versione
   */
  parseVersion(version) {
    const regex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = version.match(regex);

    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || null,
      build: match[5] || null,
      original: version,
    };
  }

  /**
   * Costruisce una stringa di versione dai componenti
   * @param {Object} versionComponents I componenti della versione
   * @returns {string} La stringa di versione formattata
   */
  buildVersion(versionComponents) {
    let version = `${versionComponents.major}.${versionComponents.minor}.${versionComponents.patch}`;

    if (versionComponents.prerelease) {
      version += `-${versionComponents.prerelease}`;
    }

    if (versionComponents.build) {
      version += `+${versionComponents.build}`;
    }

    return version;
  }

  /**
   * Calcola la nuova versione basata sul tipo di release
   * @param {string} currentVersion La versione corrente
   * @param {string} releaseType Il tipo di release (major, minor, patch)
   * @param {Object} options Opzioni aggiuntive per il calcolo
   * @returns {Object} Oggetto con la nuova versione e metadati
   */
  calculateNewVersion(currentVersion, releaseType, options = {}) {
    const {
      prerelease = null,
      build = null,
      resetLowerVersions = true,
    } = options;

    if (releaseType === 'none') {
      return {
        newVersion: currentVersion,
        previousVersion: currentVersion,
        releaseType: 'none',
        bumped: false,
        components: this.parseVersion(currentVersion),
      };
    }

    const current = this.parseVersion(currentVersion);
    const newComponents = { ...current };

    // Reset build metadata per nuove release
    newComponents.build = build;
    newComponents.prerelease = prerelease;

    switch (releaseType) {
      case 'major':
        newComponents.major += 1;
        if (resetLowerVersions) {
          newComponents.minor = 0;
          newComponents.patch = 0;
        }
        break;

      case 'minor':
        newComponents.minor += 1;
        if (resetLowerVersions) {
          newComponents.patch = 0;
        }
        break;

      case 'patch':
        newComponents.patch += 1;
        break;

      default:
        throw new Error(`Invalid release type: ${releaseType}`);
    }

    const newVersion = this.buildVersion(newComponents);

    return {
      newVersion,
      previousVersion: currentVersion,
      releaseType,
      bumped: true,
      components: newComponents,
      bump: {
        major: newComponents.major - current.major,
        minor: newComponents.minor - current.minor,
        patch: newComponents.patch - current.patch,
      },
    };
  }

  /**
   * Calcola una versione pre-release
   * @param {string} currentVersion La versione corrente
   * @param {string} prereleaseType Il tipo di pre-release (alpha, beta, rc)
   * @param {number} increment L'incremento per il pre-release
   * @returns {Object} Oggetto con la nuova versione pre-release
   */
  calculatePrereleaseVersion(
    currentVersion,
    prereleaseType = 'alpha',
    increment = 1,
  ) {
    const current = this.parseVersion(currentVersion);
    const newComponents = { ...current };

    if (current.prerelease) {
      // Se esiste già un prerelease, incrementa o cambia tipo
      const prereleaseMatch = current.prerelease.match(
        /^([a-zA-Z]+)\.?(\d+)?$/,
      );

      if (prereleaseMatch) {
        const existingType = prereleaseMatch[1];
        const existingNumber = parseInt(prereleaseMatch[2] || '0', 10);

        if (existingType === prereleaseType) {
          // Incrementa il numero esistente
          newComponents.prerelease = `${prereleaseType}.${existingNumber + increment}`;
        } else {
          // Cambia tipo di prerelease
          newComponents.prerelease = `${prereleaseType}.${increment}`;
        }
      } else {
        // Formato prerelease non riconosciuto, crea nuovo
        newComponents.prerelease = `${prereleaseType}.${increment}`;
      }
    } else {
      // Nessun prerelease esistente, crea nuovo
      newComponents.prerelease = `${prereleaseType}.${increment}`;
    }

    const newVersion = this.buildVersion(newComponents);

    return {
      newVersion,
      previousVersion: currentVersion,
      releaseType: 'prerelease',
      bumped: true,
      components: newComponents,
      prereleaseInfo: {
        type: prereleaseType,
        increment,
      },
    };
  }

  /**
   * Ottiene la versione corrente dal package.json
   * @returns {string} La versione corrente
   */
  getCurrentVersion() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      return packageJson.version || '0.0.0';
    } catch (error) {
      console.warn(
        '⚠️  Could not read current version from package.json, using 0.0.0',
      );
      return '0.0.0';
    }
  }

  /**
   * Aggiorna la versione nel package.json e sincronizza package-lock.json
   * @param {string} newVersion La nuova versione
   * @param {boolean} dryRun Se true, non scrive il file ma mostra cosa farebbe
   * @returns {boolean} True se l'operazione è riuscita
   */
  updatePackageVersion(newVersion, dryRun = false) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      const oldVersion = packageJson.version;

      packageJson.version = newVersion;

      if (dryRun) {
        this.log(
          `🧪 DRY RUN: Would update package.json version from ${oldVersion} to ${newVersion}`,
        );
        this.log(
          `🧪 DRY RUN: Would synchronize package-lock.json with new version`,
        );
        return true;
      }

      // Update package.json
      fs.writeFileSync(
        this.packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
      );
      this.log(
        `📦 Updated package.json version from ${oldVersion} to ${newVersion}`,
      );

      // Synchronize package-lock.json with new version
      this.updatePackageLockVersion(newVersion);

      return true;
    } catch (error) {
      this.log(`❌ Error updating package.json: ${error.message}`);
      return false;
    }
  }

  /**
   * Sincronizza la versione nel package-lock.json
   * @param {string} newVersion La nuova versione
   * @returns {boolean} True se l'operazione è riuscita
   */
  updatePackageLockVersion(newVersion) {
    try {
      const packageLockPath = path.join(
        path.dirname(this.packageJsonPath),
        'package-lock.json',
      );

      if (!fs.existsSync(packageLockPath)) {
        this.log(`⚠️  package-lock.json not found, skipping sync`);
        return true;
      }

      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      const oldLockVersion = packageLock.version;

      // Update root version
      packageLock.version = newVersion;

      // Update version in packages[""] if exists
      if (packageLock.packages && packageLock.packages['']) {
        packageLock.packages[''].version = newVersion;
      }

      fs.writeFileSync(
        packageLockPath,
        JSON.stringify(packageLock, null, 2) + '\n',
      );

      this.log(
        `🔒 Synchronized package-lock.json version from ${oldLockVersion} to ${newVersion}`,
      );
      return true;
    } catch (error) {
      this.log(`❌ Error updating package-lock.json: ${error.message}`);
      return false;
    }
  }

  /**
   * Valida una versione semantic
   * @param {string} version La versione da validare
   * @returns {boolean} True se la versione è valida
   */
  isValidVersion(version) {
    try {
      this.parseVersion(version);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Compara due versioni
   * @param {string} version1 Prima versione
   * @param {string} version2 Seconda versione
   * @returns {number} -1 se v1 < v2, 0 se v1 === v2, 1 se v1 > v2
   */
  compareVersions(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    // Compara major.minor.patch
    for (const component of ['major', 'minor', 'patch']) {
      if (v1[component] < v2[component]) return -1;
      if (v1[component] > v2[component]) return 1;
    }

    // Se major.minor.patch sono uguali, controlla prerelease
    if (v1.prerelease && !v2.prerelease) return -1;
    if (!v1.prerelease && v2.prerelease) return 1;
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    }

    return 0;
  }

  /**
   * Genera suggerimenti per il versioning
   * @param {string} currentVersion La versione corrente
   * @param {Object} analysis L'analisi dei commit
   * @returns {Object} Suggerimenti per il versioning
   */
  generateVersionSuggestions(currentVersion, analysis) {
    const suggestions = {
      current: currentVersion,
      recommendations: [],
    };

    if (!analysis.needsRelease) {
      suggestions.recommendations.push({
        version: currentVersion,
        type: 'none',
        reason: 'No release needed - no significant changes found',
      });
      return suggestions;
    }

    // Suggerimento principale basato sull'analisi
    const mainSuggestion = this.calculateNewVersion(
      currentVersion,
      analysis.releaseType,
    );
    suggestions.recommendations.push({
      version: mainSuggestion.newVersion,
      type: analysis.releaseType,
      reason: `Based on ${analysis.summary.total} commits with ${analysis.releaseType} changes`,
      primary: true,
    });

    // Suggerimenti alternativi
    if (analysis.releaseType !== 'major') {
      const majorSuggestion = this.calculateNewVersion(currentVersion, 'major');
      suggestions.recommendations.push({
        version: majorSuggestion.newVersion,
        type: 'major',
        reason: 'Force major release for breaking changes',
        alternative: true,
      });
    }

    // Suggerimento prerelease
    const prereleaseSuggestion = this.calculatePrereleaseVersion(
      currentVersion,
      'beta',
      1,
    );
    suggestions.recommendations.push({
      version: prereleaseSuggestion.newVersion,
      type: 'prerelease',
      reason: 'Beta release for testing',
      alternative: true,
    });

    return suggestions;
  }
}

// Esecuzione script se chiamato direttamente
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const releaseType = args[0] || 'patch';
  const dryRun = args.includes('--dry-run');
  const prerelease = args
    .find(arg => arg.startsWith('--prerelease='))
    ?.split('=')[1];
  const build = args.find(arg => arg.startsWith('--build='))?.split('=')[1];
  const jsonOutput = args.includes('--json');

  const calculator = new VersionCalculator({ silent: jsonOutput });

  try {
    const currentVersion = calculator.getCurrentVersion();

    calculator.log(`📦 Current version: ${currentVersion}`);
    calculator.log(`🎯 Release type: ${releaseType}`);

    const options = {};
    if (prerelease) options.prerelease = prerelease;
    if (build) options.build = build;

    let result;
    if (releaseType === 'prerelease') {
      const prereleaseType = prerelease || 'alpha';
      result = calculator.calculatePrereleaseVersion(
        currentVersion,
        prereleaseType,
      );
    } else {
      result = calculator.calculateNewVersion(
        currentVersion,
        releaseType,
        options,
      );
    }

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      calculator.log(`🔢 New version: ${result.newVersion}`);
      calculator.log(`📊 Bumped: ${result.bumped ? '✅ Yes' : '❌ No'}`);

      if (result.bump) {
        calculator.log(`   • Major: +${result.bump.major}`);
        calculator.log(`   • Minor: +${result.bump.minor}`);
        calculator.log(`   • Patch: +${result.bump.patch}`);
      }
    }

    if (result.bumped && !dryRun) {
      calculator.updatePackageVersion(result.newVersion, dryRun);
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ Version calculation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = VersionCalculator;
