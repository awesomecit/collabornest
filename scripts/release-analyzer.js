#!/usr/bin/env node

/**
 * Semantic Release Analyzer
 *
 * Analizza i com    const commitList = this.getCommitsSince(lastTag);
    if (commitList.length === 0) {
      if (lastTag) {
        this.log('📝 No new commits found since last release');
        return [];
      }
    } else {
      this.log(`📝 Found ${commitList.length} commits since last release`);
    }t dal ultimo release per determinare se è necessario un nuovo rilascio
 * e calcola il tipo di versione bump richiesto secondo Semantic Versioning.
 *
 * Supporta conventional commits:
 * - feat: minor version bump
 * - fix: patch version bump
 * - BREAKING CHANGE: major version bump
 * - docs, style, refactor, test, chore: no version bump
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ReleaseAnalyzer {
  constructor(options = {}) {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
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
   * Ottiene l'ultimo tag di release dal repository Git
   * @returns {string|null} L'ultimo tag o null se non esistono tag
   */
  getLastReleaseTag() {
    try {
      const lastTag = execSync('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      this.log(`📍 Last release tag found: ${lastTag}`);
      return lastTag;
    } catch (error) {
      this.log(
        '📍 No previous release tags found, analyzing from first commit',
      );
      return null;
    }
  }

  /**
   * Ottiene tutti i commit dal ultimo release
   * @param {string|null} lastTag L'ultimo tag di release
   * @returns {string[]} Array di messaggi di commit
   */
  getCommitsSinceLastRelease(lastTag) {
    try {
      const gitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      const commits = execSync(`git log ${gitRange} --pretty=format:"%s"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      if (!commits) {
        console.log('📝 No new commits found since last release');
        return [];
      }

      const commitList = commits.split('\n').filter(commit => commit.trim());
      this.log(`📝 Found ${commitList.length} commits since last release`);
      return commitList;
    } catch (error) {
      this.log('❌ Error getting commits:', error.message);
      return [];
    }
  }

  /**
   * Analizza un singolo commit per determinarne il tipo
   * Utilizza regex per parsare i conventional commits invece di libreria esterna
   * @param {string} commitMessage Il messaggio del commit
   * @returns {Object} Oggetto con tipo e dettagli del commit
   */
  analyzeCommit(commitMessage) {
    try {
      // Regex per conventional commits: type(scope): subject
      const conventionalCommitRegex = /^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/;
      const match = commitMessage.match(conventionalCommitRegex);

      let analysis = {
        type: 'unknown',
        scope: null,
        subject: commitMessage,
        isBreaking: false,
        originalMessage: commitMessage,
      };

      if (match) {
        analysis.type = match[1].toLowerCase();
        analysis.scope = match[2] || null;
        analysis.subject = match[3] || commitMessage;
      }

      // Controlla per breaking changes
      analysis.isBreaking =
        /BREAKING[\s\-]?CHANGE/i.test(commitMessage) ||
        commitMessage.includes('!:');

      // Determina il livello di release
      if (analysis.isBreaking) {
        analysis.releaseType = 'major';
      } else if (['feat', 'feature'].includes(analysis.type)) {
        analysis.releaseType = 'minor';
      } else if (['fix', 'bugfix', 'patch'].includes(analysis.type)) {
        analysis.releaseType = 'patch';
      } else {
        analysis.releaseType = 'none';
      }

      return analysis;
    } catch (error) {
      console.warn(`⚠️  Could not parse commit: ${commitMessage}`);
      return {
        type: 'unknown',
        scope: null,
        subject: commitMessage,
        isBreaking: false,
        releaseType: 'none',
        originalMessage: commitMessage,
      };
    }
  }

  /**
   * Analizza tutti i commit e determina il tipo di release necessario
   * @param {string[]} commits Array di messaggi di commit
   * @returns {Object} Analisi completa dei commit
   */
  analyzeCommits(commits) {
    if (commits.length === 0) {
      return {
        needsRelease: false,
        releaseType: 'none',
        summary: {
          total: 0,
          major: 0,
          minor: 0,
          patch: 0,
          none: 0,
        },
        commits: [],
      };
    }

    const analyzedCommits = commits.map(commit => this.analyzeCommit(commit));

    // Conta i tipi di commit
    const summary = {
      total: analyzedCommits.length,
      major: analyzedCommits.filter(c => c.releaseType === 'major').length,
      minor: analyzedCommits.filter(c => c.releaseType === 'minor').length,
      patch: analyzedCommits.filter(c => c.releaseType === 'patch').length,
      none: analyzedCommits.filter(c => c.releaseType === 'none').length,
    };

    // Determina il tipo di release (priority: major > minor > patch)
    let releaseType = 'none';
    let needsRelease = false;

    if (summary.major > 0) {
      releaseType = 'major';
      needsRelease = true;
    } else if (summary.minor > 0) {
      releaseType = 'minor';
      needsRelease = true;
    } else if (summary.patch > 0) {
      releaseType = 'patch';
      needsRelease = true;
    }

    return {
      needsRelease,
      releaseType,
      summary,
      commits: analyzedCommits,
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
      this.log(
        '⚠️  Could not read current version from package.json, using 0.0.0',
      );
      return '0.0.0';
    }
  }

  /**
   * Esegue l'analisi completa e restituisce i risultati
   * @returns {Object} Risultati dell'analisi completa
   */
  analyze() {
    this.log('🔍 Starting release analysis...\n');

    const currentVersion = this.getCurrentVersion();
    this.log(`📦 Current version: ${currentVersion}`);

    const lastTag = this.getLastReleaseTag();
    const commits = this.getCommitsSinceLastRelease(lastTag);
    const analysis = this.analyzeCommits(commits);

    const result = {
      currentVersion,
      lastReleaseTag: lastTag,
      analysis,
      timestamp: new Date().toISOString(),
    };

    this.log('\n📊 Release Analysis Results:');
    this.log(`   Needs Release: ${analysis.needsRelease ? '✅ Yes' : '❌ No'}`);
    this.log(`   Release Type: ${analysis.releaseType}`);
    this.log(`   Total Commits: ${analysis.summary.total}`);
    this.log(`   • Major: ${analysis.summary.major}`);
    this.log(`   • Minor: ${analysis.summary.minor}`);
    this.log(`   • Patch: ${analysis.summary.patch}`);
    this.log(`   • No Release: ${analysis.summary.none}`);

    return result;
  }

  /**
   * Salva i risultati dell'analisi in un file JSON
   * @param {Object} results I risultati dell'analisi
   * @param {string} outputFile Il percorso del file di output
   */
  saveResults(results, outputFile = 'release-analysis.json') {
    try {
      const outputPath = path.join(process.cwd(), outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      this.log(`\n💾 Analysis saved to: ${outputFile}`);
    } catch (error) {
      this.log(`❌ Error saving results: ${error.message}`);
    }
  }
}

// Esecuzione script se chiamato direttamente
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const saveToFile = args.includes('--save');
  const outputFile =
    args.find(arg => arg.startsWith('--output='))?.split('=')[1] ||
    'release-analysis.json';
  const jsonOutput = args.includes('--json');

  const analyzer = new ReleaseAnalyzer({ silent: jsonOutput });

  try {
    const results = analyzer.analyze();

    if (jsonOutput) {
      // Only output JSON, suppress normal output
      console.log(JSON.stringify(results, null, 2));
    }

    if (saveToFile) {
      analyzer.saveResults(results, outputFile);
    }

    // Exit with appropriate code
    process.exit(results.analysis.needsRelease ? 0 : 1);
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(`❌ Release analysis failed: ${error.message}`);
    }
    process.exit(2);
  }
}

module.exports = ReleaseAnalyzer;
