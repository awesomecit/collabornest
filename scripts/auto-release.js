#!/usr/bin/env node

/**
 * Auto Release Script
 *
 * Gestisce il processo di rilascio automatico con:
 * - Analisi intelligente dei commit
 * - Calcolo automatico della versione
 * - Generazione del changelog
 * - Tagging Git e push automatico
 * - Rollback in caso di errori
 * - Configurazione JSON granulare per branch-specific behavior
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoRelease {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      force: options.force || false,
      releaseType: options.releaseType || null,
      skipTests: options.skipTests || false,
      skipBuild: options.skipBuild || false,
      ...options,
    };

    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    this.backupSuffix = '.backup-' + Date.now();

    // Load release configuration
    this.config = this.loadConfig();
    this.currentBranch = this.getCurrentBranch();
    this.branchConfig = this.getBranchConfig();
  }

  /**
   * Load release configuration from .release-config.json
   * @returns {Object} Configuration object
   */
  loadConfig() {
    const configPath = path.join(process.cwd(), '.release-config.json');
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.warn(
        'Warning: Could not load .release-config.json, using defaults',
      );
    }

    // Default configuration if file not found
    return {
      enabled: true,
      branches: {
        main: {
          autoRelease: true,
          releaseType: 'auto',
          runBuild: true,
          pushTag: true,
        },
        master: {
          autoRelease: true,
          releaseType: 'auto',
          runBuild: true,
          pushTag: true,
        },
      },
      versioning: { strategy: 'semver', syncLockFile: true },
      git: { tagPrefix: 'v', remoteName: 'origin' },
    };
  }

  /**
   * Get current git branch
   * @returns {string} Current branch name
   */
  getCurrentBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get configuration for current branch (supports wildcards)
   * @returns {Object} Branch-specific configuration
   */
  getBranchConfig() {
    if (!this.config.branches) {
      return null;
    }

    // Exact match first
    if (this.config.branches[this.currentBranch]) {
      return this.config.branches[this.currentBranch];
    }

    // Wildcard match
    for (const [pattern, config] of Object.entries(this.config.branches)) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        if (regex.test(this.currentBranch)) {
          return config;
        }
      }
    }

    return null;
  }

  /**
   * Esegue un comando con gestione degli errori
   * @param {string} command Il comando da eseguire
   * @param {boolean} silent Se true, non mostra l'output
   * @param {boolean} alwaysExecute Se true, esegue anche in dry-run mode (per comandi di sola lettura)
   * @returns {string} L'output del comando
   */
  execCommand(command, silent = false, alwaysExecute = false) {
    try {
      const options = {
        encoding: 'utf8',
        stdio: silent ? ['pipe', 'pipe', 'ignore'] : 'inherit',
      };

      if (this.options.dryRun && !alwaysExecute) {
        console.log(`🧪 DRY RUN: Would execute: ${command}`);
        return '';
      }

      return execSync(command, options);
    } catch (error) {
      throw new Error(`Command failed: ${command}\nError: ${error.message}`);
    }
  }

  /**
   * Verifica la coerenza delle versioni tra package.json, package-lock.json e Git tags
   * @returns {Object} Risultato della verifica
   */
  checkVersionConsistency() {
    console.log('🔍 Checking version consistency...');

    try {
      // Legge versione da package.json
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      const packageVersion = packageJson.version;

      // Legge versione da package-lock.json
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');
      let lockVersion = null;
      if (fs.existsSync(packageLockPath)) {
        const packageLock = JSON.parse(
          fs.readFileSync(packageLockPath, 'utf8'),
        );
        lockVersion = packageLock.version;
      }

      // Legge ultimo tag Git dal remote
      let latestTag = null;
      try {
        const tagOutput = this.execCommand(
          'git describe --tags --abbrev=0 origin/main 2>/dev/null || echo ""',
          true,
          true,
        );
        latestTag = tagOutput.trim();
        if (latestTag.startsWith('v')) {
          latestTag = latestTag.substring(1); // Rimuove 'v' prefix
        }
      } catch (error) {
        // Nessun tag trovato
      }

      console.log(`📦 Version Analysis:`);
      console.log(`   • package.json: ${packageVersion}`);
      console.log(`   • package-lock.json: ${lockVersion || 'not found'}`);
      console.log(`   • Latest Git tag: ${latestTag || 'no tags found'}`);

      // Controlli di coerenza
      const issues = [];

      if (lockVersion && packageVersion !== lockVersion) {
        issues.push(
          `Version mismatch: package.json (${packageVersion}) vs package-lock.json (${lockVersion})`,
        );
      }

      if (latestTag && packageVersion !== latestTag) {
        issues.push(
          `Version mismatch: package.json (${packageVersion}) vs latest Git tag (${latestTag})`,
        );
      }

      if (issues.length > 0) {
        console.log('❌ Version consistency issues found:');
        issues.forEach(issue => console.log(`   • ${issue}`));
        return {
          consistent: false,
          issues,
          versions: {
            package: packageVersion,
            lock: lockVersion,
            tag: latestTag,
          },
        };
      }

      console.log('✅ All versions are consistent');
      return {
        consistent: true,
        issues: [],
        versions: {
          package: packageVersion,
          lock: lockVersion,
          tag: latestTag,
        },
      };
    } catch (error) {
      throw new Error(`Failed to check version consistency: ${error.message}`);
    }
  }

  /**
   * Verifica che siamo sul branch corretto per il release
   * @returns {boolean} True se il branch è corretto
   */
  checkBranch() {
    try {
      // Per la verifica del branch, eseguiamo sempre il comando reale anche in dry-run
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
      }).trim();

      if (currentBranch !== 'main' && currentBranch !== 'master') {
        console.log(`⚠️ Release can only be performed from main/master branch`);
        console.log(`   Current branch: ${currentBranch}`);
        return false;
      }

      console.log(`✅ Branch verification passed: ${currentBranch}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to check current branch: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica che non ci siano modifiche non committed
   * @returns {boolean} True se il working directory è pulito
   */
  checkWorkingDirectory() {
    try {
      const status = execSync('git status --porcelain', {
        encoding: 'utf8',
      }).trim();

      if (status) {
        console.log(
          `⚠️ Working directory is not clean. Please commit or stash changes first.`,
        );
        console.log(`   Uncommitted changes:`);
        status.split('\n').forEach(line => {
          console.log(`   ${line}`);
        });
        return false;
      }

      console.log(`✅ Working directory is clean`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to check working directory: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica che siamo sincronizzati con il repository remoto
   * @returns {boolean} True se siamo sincronizzati
   */
  checkRemoteSync() {
    try {
      // Fetch per ottenere lo stato aggiornato del remoto
      if (!this.options.dryRun) {
        execSync('git fetch origin', { stdio: 'ignore' });
      }

      const localCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
      }).trim();
      const remoteCommit = execSync(
        'git rev-parse origin/HEAD 2>/dev/null || git rev-parse origin/main 2>/dev/null || git rev-parse origin/master',
        {
          encoding: 'utf8',
        },
      ).trim();

      if (localCommit !== remoteCommit) {
        console.log(`⚠️ Local branch is not synchronized with remote`);
        console.log(`   Local:  ${localCommit.substring(0, 8)}`);
        console.log(`   Remote: ${remoteCommit.substring(0, 8)}`);
        console.log(`   Please pull latest changes first`);
        return false;
      }

      console.log(`✅ Local branch is synchronized with remote`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Could not verify remote sync: ${error.message}`);
      // Non blocchiamo il release per problemi di connettività remota
      return true;
    }
  }

  /**
   * Analizza i commit per determinare il tipo di release
   * @returns {Object} Risultati dell'analisi
   */
  async analyzeCommits() {
    console.log('🔍 Analyzing commits for release...');

    try {
      if (this.options.dryRun) {
        console.log(
          '🧪 DRY RUN: Would analyze commits with release-analyzer.js',
        );
      }

      const analysisOutput = this.execCommand(
        'node scripts/release-analyzer.js --json',
        true,
        true, // alwaysExecute = true per comandi di sola lettura
      );
      const analysis = JSON.parse(analysisOutput);

      console.log(`📊 Analysis completed:`);
      console.log(
        `   • Needs Release: ${analysis.analysis.needsRelease ? '✅ Yes' : '❌ No'}`,
      );
      console.log(`   • Release Type: ${analysis.analysis.releaseType}`);
      console.log(`   • Total Commits: ${analysis.analysis.summary.total}`);

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze commits: ${error.message}`);
    }
  }

  /**
   * Calcola la nuova versione
   * @param {string} releaseType Il tipo di release
   * @returns {Object} Informazioni sulla nuova versione
   */
  async calculateVersion(releaseType) {
    console.log(`🔢 Calculating new version for ${releaseType} release...`);

    try {
      if (this.options.dryRun) {
        console.log(`🧪 DRY RUN: Would calculate version for ${releaseType}`);
        // Anche in dry-run, calcoliamo la versione reale per simulazione accurata
        const versionOutput = this.execCommand(
          `node scripts/version-calculator.js ${releaseType} --json --dry-run`,
          true,
          true, // alwaysExecute = true per comandi di sola lettura
        );
        const versionInfo = JSON.parse(versionOutput);

        console.log(`📦 Version calculation (DRY RUN):`);
        console.log(`   • Current: ${versionInfo.previousVersion}`);
        console.log(`   • New: ${versionInfo.newVersion}`);
        console.log(`   • Bumped: ${versionInfo.bumped ? '✅ Yes' : '❌ No'}`);

        return versionInfo;
      }

      const versionOutput = this.execCommand(
        `node scripts/version-calculator.js ${releaseType} --json`,
        true,
        true, // alwaysExecute = true per comandi di sola lettura
      );
      const versionInfo = JSON.parse(versionOutput);

      console.log(`📦 Version calculation:`);
      console.log(`   • Current: ${versionInfo.previousVersion}`);
      console.log(`   • New: ${versionInfo.newVersion}`);
      console.log(`   • Bumped: ${versionInfo.bumped ? '✅ Yes' : '❌ No'}`);

      return versionInfo;
    } catch (error) {
      throw new Error(`Failed to calculate version: ${error.message}`);
    }
  }

  /**
   * Crea un backup dei file critici
   */
  createBackups() {
    console.log('💾 Creating backups...');

    const filesToBackup = [this.packageJsonPath, this.changelogPath];

    if (this.options.dryRun) {
      filesToBackup.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          console.log(`   🟡 DRY RUN: would backup ${path.basename(filePath)}`);
        }
      });
      return;
    }

    filesToBackup.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const backupPath = filePath + this.backupSuffix;
        fs.copyFileSync(filePath, backupPath);
        console.log(`   📁 Backed up: ${path.basename(filePath)}`);
      }
    });
  }

  /**
   * Ripristina i file dal backup
   */
  restoreBackups() {
    console.log('🔄 Restoring from backups...');

    const filesToRestore = [this.packageJsonPath, this.changelogPath];

    if (this.options.dryRun) {
      filesToRestore.forEach(filePath => {
        const backupPath = filePath + this.backupSuffix;
        if (fs.existsSync(backupPath)) {
          console.log(
            `   🟡 DRY RUN: would restore ${path.basename(filePath)} from backup`,
          );
        }
      });
      return;
    }

    filesToRestore.forEach(filePath => {
      const backupPath = filePath + this.backupSuffix;
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        fs.unlinkSync(backupPath);
        console.log(`   📁 Restored: ${path.basename(filePath)}`);
      }
    });
  }

  /**
   * Pulisce i file di backup
   */
  cleanupBackups() {
    console.log('🧹 Cleaning up backups...');

    const filesToCleanup = [
      this.packageJsonPath + this.backupSuffix,
      this.changelogPath + this.backupSuffix,
    ];

    if (this.options.dryRun) {
      filesToCleanup.forEach(backupPath => {
        if (fs.existsSync(backupPath)) {
          console.log(
            `   🟡 DRY RUN: would remove backup ${path.basename(backupPath)}`,
          );
        }
      });
      return;
    }

    filesToCleanup.forEach(backupPath => {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log(`   🗑️  Removed: ${path.basename(backupPath)}`);
      }
    });
  }

  /**
   * Aggiorna la versione nel package.json
   * @param {string} newVersion La nuova versione
   */
  updatePackageVersion(newVersion) {
    console.log(`📝 Updating package.json to version ${newVersion}...`);

    if (!this.options.dryRun) {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      packageJson.version = newVersion;
      fs.writeFileSync(
        this.packageJsonPath,
        JSON.stringify(packageJson, null, 2) + '\n',
      );
      console.log(`   ✅ Package version updated`);
    } else {
      console.log(
        `   🟡 DRY RUN: package.json would be updated to ${newVersion}`,
      );
    }
  }

  /**
   * Genera il changelog
   * @param {string} version La versione per il changelog
   */
  generateChangelog(version) {
    console.log('📖 Generating changelog...');

    if (this.options.dryRun) {
      console.log('   🟡 DRY RUN: Would generate changelog');
      return;
    }

    try {
      this.execCommand('npm run release:changelog');
      console.log('   ✅ Changelog generated');
    } catch (error) {
      console.warn(`   ⚠️  Changelog generation failed: ${error.message}`);
    }
  }

  /**
   * Genera le release notes
   * @param {string} version La versione per le release notes
   * @param {Object} analysis L'analisi dei commit
   */
  generateReleaseNotes(version, analysis) {
    console.log('📋 Generating release notes...');

    if (this.options.dryRun) {
      console.log('   🟡 DRY RUN: Would generate release notes');
      return;
    }

    try {
      this.execCommand('npm run release:notes');
      console.log('   ✅ Release notes generated');
    } catch (error) {
      console.warn(`   ⚠️  Release notes generation failed: ${error.message}`);
    }
  }

  /**
   * Esegue i test
   */
  runTests() {
    if (this.options.skipTests) {
      console.log('⚡ Skipping tests (--skip-tests)');
      return;
    }

    console.log('🧪 Running tests...');
    this.execCommand('npm run test:coverage:check');
    if (!this.options.dryRun) {
      console.log('   ✅ Tests passed');
    }
  }

  /**
   * Esegue il build
   */
  runBuild() {
    if (this.options.skipBuild) {
      console.log('⚡ Skipping build (--skip-build)');
      return;
    }

    console.log('🏗️ Building project...');
    this.execCommand('npm run build');
    if (!this.options.dryRun) {
      console.log('   ✅ Build completed');
    }
  }

  /**
   * Committa i cambiamenti
   * @param {string} version La versione del release
   */
  commitChanges(version) {
    console.log(`📝 Committing release changes...`);

    this.execCommand('git add .');
    this.execCommand(`git commit -m "chore(release): bump version to ${version}

- Update package.json version
- Generate changelog
- Prepare for release"`);

    console.log('   ✅ Changes committed');
  }

  /**
   * Crea il tag Git
   * @param {string} version La versione per il tag
   */
  createGitTag(version) {
    console.log(`🏷️ Creating Git tag v${version}...`);

    const tagMessage = `Release v${version}

$(git log --oneline --since="$(git describe --tags --abbrev=0 2>/dev/null || echo 'HEAD')" --pretty=format:"- %s" | head -10)`;

    this.execCommand(`git tag -a v${version} -m "${tagMessage}"`);
    console.log('   ✅ Git tag created');
  }

  /**
   * Pusha i cambiamenti e i tag
   */
  pushChanges() {
    console.log('🚀 Pushing changes and tags...');

    // Imposta variabile per evitare loop del pre-push hook
    process.env.SKIP_PRE_PUSH_HOOK = 'true';

    this.execCommand('git push origin HEAD');
    this.execCommand('git push origin --tags');

    console.log('   ✅ Changes and tags pushed');
  }

  /**
   * Esegue il rilascio completo
   */
  async performRelease() {
    let releaseStarted = false;

    try {
      console.log('🚀 Starting automated release process...\n');

      // Fase 0: Verifiche di sicurezza
      console.log('🔐 Running security checks...');

      if (!this.checkBranch() && !this.options.force) {
        return {
          success: false,
          reason: 'Wrong branch - releases only allowed from main/master',
        };
      }

      if (!this.checkWorkingDirectory() && !this.options.force) {
        return {
          success: false,
          reason: 'Working directory not clean - commit or stash changes first',
        };
      }

      if (!this.checkRemoteSync() && !this.options.force) {
        return {
          success: false,
          reason: 'Not synchronized with remote - pull latest changes first',
        };
      }

      // Controllo coerenza versioni
      const versionCheck = this.checkVersionConsistency();
      if (!versionCheck.consistent && !this.options.force) {
        return {
          success: false,
          reason:
            'Version inconsistency detected - fix version conflicts first',
          details: versionCheck.issues,
        };
      }

      console.log('✅ All security checks passed\n');

      // Fase 1: Analisi
      const analysis = await this.analyzeCommits();

      if (!analysis.analysis.needsRelease && !this.options.force) {
        console.log(
          '📝 No release needed. Use --force to create release anyway.',
        );
        return { success: false, reason: 'No release needed' };
      }

      const releaseType =
        this.options.releaseType === 'auto'
          ? analysis.analysis.releaseType
          : this.options.releaseType || analysis.analysis.releaseType;

      // Fase 2: Calcolo versione
      const versionInfo = await this.calculateVersion(releaseType);

      if (!versionInfo.bumped && !this.options.force) {
        console.log(
          '📝 No version bump needed. Use --force to create release anyway.',
        );
        return { success: false, reason: 'No version bump needed' };
      }

      // Fase 3: Backup
      this.createBackups();
      releaseStarted = true;

      // Fase 4: Test e Build
      this.runTests();
      this.runBuild();

      // Fase 5: Aggiornamenti
      this.updatePackageVersion(versionInfo.newVersion);
      this.generateChangelog(versionInfo.newVersion);

      // Fase 6: Git operations
      this.commitChanges(versionInfo.newVersion);
      this.createGitTag(versionInfo.newVersion);
      this.pushChanges();

      // Fase 7: Cleanup
      this.cleanupBackups();

      console.log(
        `\n🎉 Release v${versionInfo.newVersion} completed successfully!`,
      );
      console.log(`📊 Release Summary:`);
      console.log(`   • Type: ${releaseType}`);
      console.log(
        `   • Version: ${versionInfo.previousVersion} → ${versionInfo.newVersion}`,
      );
      console.log(`   • Commits: ${analysis.analysis.summary.total}`);

      return {
        success: true,
        version: versionInfo.newVersion,
        type: releaseType,
        summary: analysis.analysis.summary,
      };
    } catch (error) {
      console.error(`\n❌ Release failed: ${error.message}`);

      if (releaseStarted) {
        console.log('🔄 Attempting rollback...');
        try {
          this.restoreBackups();
          console.log('✅ Rollback completed');
        } catch (rollbackError) {
          console.error(`❌ Rollback failed: ${rollbackError.message}`);
        }
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Esegue il workflow di release completo: analizza, aggiorna file, committa, crea tag e pusha
   * Questo metodo implementa il flusso richiesto dall'utente con configurazione branch-specific
   */
  async performWorkflowRelease() {
    try {
      console.log('Starting workflow release process...\n');

      // Check if releases are enabled globally
      if (!this.config.enabled) {
        console.log('Releases are disabled in configuration');
        return { success: false, reason: 'Releases disabled' };
      }

      // Check branch-specific configuration
      if (this.branchConfig) {
        console.log(`Current branch: ${this.currentBranch}`);
        console.log(
          `Branch config: ${JSON.stringify(this.branchConfig, null, 2)}`,
        );

        if (!this.branchConfig.autoRelease && !this.options.force) {
          console.log(
            `Auto-release is disabled for branch ${this.currentBranch}`,
          );
          return {
            success: false,
            reason: 'Auto-release disabled for this branch',
          };
        }

        if (this.branchConfig.skipIfNoChanges && !this.options.force) {
          const hasChanges = this.execCommand(
            'git status --porcelain',
            true,
            true,
          );
          if (!hasChanges.trim()) {
            console.log('No changes detected, skipping release');
            return { success: false, reason: 'No changes' };
          }
        }
      } else {
        console.log(
          `Warning: No configuration found for branch ${this.currentBranch}, proceeding with defaults`,
        );
      }

      // Fase 1: Analisi dei commit semantici
      console.log('Step 1: Analyzing semantic commits...');
      const analysis = await this.analyzeCommits();

      if (!analysis.analysis.needsRelease && !this.options.force) {
        console.log('📝 No semantic commits found - no release needed.');
        return { success: false, reason: 'No release needed' };
      }

      const releaseType =
        this.options.releaseType === 'auto'
          ? analysis.analysis.releaseType
          : this.options.releaseType || analysis.analysis.releaseType;

      const versionInfo = await this.calculateVersion(releaseType);

      console.log(
        `✅ Release needed: ${releaseType} (${versionInfo.previousVersion} → ${versionInfo.newVersion})`,
      );

      // Fase 2: Aggiorna package.json e package-lock.json
      console.log('\n📝 Step 2: Updating package files...');
      this.updatePackageVersion(versionInfo.newVersion);

      // Aggiorna package-lock.json se esiste
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');
      if (fs.existsSync(packageLockPath)) {
        const packageLock = JSON.parse(
          fs.readFileSync(packageLockPath, 'utf8'),
        );
        packageLock.version = versionInfo.newVersion;
        if (!this.options.dryRun) {
          fs.writeFileSync(
            packageLockPath,
            JSON.stringify(packageLock, null, 2) + '\n',
          );
          console.log(
            `✅ Updated package-lock.json to v${versionInfo.newVersion}`,
          );
        } else {
          console.log(
            `🟡 DRY RUN: package-lock.json would be updated to v${versionInfo.newVersion}`,
          );
        }
      }

      // Fase 3: Genera changelog e release notes
      console.log('\n📄 Step 3: Generating documentation...');
      this.generateChangelog(
        versionInfo.newVersion,
        analysis.analysis.summary,
        analysis.commits,
      );
      this.generateReleaseNotes(versionInfo.newVersion, analysis.analysis);
      console.log(`✅ Generated CHANGELOG.md and RELEASE_NOTES.md`);

      // Fase 4: Committa i file di release
      console.log('\n💾 Step 4: Committing release files...');
      this.execCommand(
        'git add package.json package-lock.json CHANGELOG.md RELEASE_NOTES.md',
      );
      this
        .execCommand(`git commit -m "chore(release): prepare release v${versionInfo.newVersion}

- Update package.json and package-lock.json to v${versionInfo.newVersion}
- Generate changelog and release notes
- Prepare for automated release workflow

[skip ci]"`);
      console.log(`✅ Committed release files for v${versionInfo.newVersion}`);

      // Fase 5: Crea e pusha il tag
      console.log('\n🏷️ Step 5: Creating and pushing tag...');
      this.execCommand(
        `git tag -a v${versionInfo.newVersion} -m "Release v${versionInfo.newVersion}"`,
      );
      console.log(`✅ Created tag v${versionInfo.newVersion}`);

      this.execCommand(`git push origin v${versionInfo.newVersion}`);
      console.log(`✅ Pushed tag v${versionInfo.newVersion} to remote`);

      console.log(
        `\n🎉 Workflow release v${versionInfo.newVersion} completed successfully!`,
      );
      console.log(`📊 Release Summary:`);
      console.log(`   • Type: ${releaseType}`);
      console.log(
        `   • Version: ${versionInfo.previousVersion} → ${versionInfo.newVersion}`,
      );
      console.log(`   • Commits: ${analysis.analysis.summary.total}`);
      console.log(
        `   • Files: package.json, package-lock.json, CHANGELOG.md, RELEASE_NOTES.md`,
      );
      console.log(`   • Tag: v${versionInfo.newVersion} (pushed to remote)`);

      return {
        success: true,
        version: versionInfo.newVersion,
        type: releaseType,
        summary: analysis.analysis.summary,
        workflow: true,
      };
    } catch (error) {
      console.error(`\n❌ Workflow release failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// Esecuzione script se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    skipTests: args.includes('--skip-tests'),
    skipBuild: args.includes('--skip-build'),
    workflow: args.includes('--workflow=true'),
    releaseType: args.find(arg => arg.startsWith('--type='))?.split('=')[1],
  };

  console.log('🔧 Auto-Release Configuration:');
  console.log(`   • Dry Run: ${options.dryRun ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Force: ${options.force ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Skip Tests: ${options.skipTests ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Skip Build: ${options.skipBuild ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Workflow Mode: ${options.workflow ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Release Type: ${options.releaseType || 'auto-detect'}`);
  console.log('');

  const autoRelease = new AutoRelease(options);

  // Usa il workflow se richiesto
  const releaseMethod = options.workflow
    ? autoRelease.performWorkflowRelease()
    : autoRelease.performRelease();

  releaseMethod
    .then(result => {
      if (result.success) {
        console.log('\n✨ Automated release completed successfully!');
        process.exit(0);
      } else {
        // Distinguiamo tra skip intenzionale ed errore reale
        const isSkip =
          result.reason &&
          (result.reason.includes('No release needed') ||
            result.reason.includes('No version bump needed') ||
            result.reason.includes('Wrong branch') ||
            result.reason.includes('Working directory not clean') ||
            result.reason.includes('Not synchronized with remote'));

        if (isSkip) {
          console.log(
            `\n📝 Release skipped: ${result.reason || 'Unknown reason'}`,
          );
          process.exit(0); // Exit pulito per skip intenzionale
        } else {
          console.log(
            `\n❌ Release failed: ${result.reason || 'Unknown reason'}`,
          );
          process.exit(1); // Exit di errore per problemi reali
        }
      }
    })
    .catch(error => {
      console.error(`\n💥 Fatal error: ${error.message}`);
      process.exit(2);
    });
}

module.exports = AutoRelease;
