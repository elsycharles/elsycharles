import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import template from './template.js';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

/**
 * Get simple today's date in Madagascar timezone (UTC+3)
 */
function getTodayDate() {
  const now = new Date();
  // Convert to Madagascar time (UTC+3)
  const madagascarTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return madagascarTime.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC' // Use UTC since we already adjusted the time
  });
}

/**
 * Generate the new README content
 */
function generateReadme() {
  const todayDate = getTodayDate();
  const tagline = CONFIG.profile.tagline.replace(/\s+/g, '%20').replace(/,/g, '%2C');
  
  // Replace placeholders in template
  return template
    .replace('{{TAGLINE}}', tagline)
    .replace('{{TODAY_DATE}}', todayDate);
}

/**
 * Write README file
 */
async function writeReadme(content) {
  const readmePath = join(__dirname, '..', 'README.md');
  try {
    await fs.writeFile(readmePath, content, 'utf8');
    console.log('✅ README.md updated successfully!');
  } catch (error) {
    console.error('❌ Error writing README.md:', error);
    throw error;
  }
}

/**
 * Coin flip: returns 1 (push today) or 0 (skip today)
 */
function coinFlip() {
  return Math.random() < 0.5 ? 1 : 0;
}

/**
 * Random integer in [min, max]
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function git(command) {
  execSync(`git ${command}`, { cwd: ROOT, stdio: 'inherit' });
}

// Commits authored by this bot are not counted in the profile contributions
const BOT_IDENTITY = '-c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com"';

/**
 * Commit the README date update as the bot, so it does not count as a contribution
 */
function commitReadmeAsBot() {
  const changed = execSync('git status --porcelain README.md', { cwd: ROOT }).toString().trim();
  if (!changed) return;
  git('add README.md');
  git(`${BOT_IDENTITY} commit -m "🤖 Auto-update README.md - ${new Date().toISOString()}"`);
}

/**
 * Create `count` commits, each appending a timestamped line to the activity file
 */
async function createActivityCommits(count) {
  const { file } = CONFIG.activity;
  const activityPath = join(ROOT, file);

  for (let i = 1; i <= count; i++) {
    const timestamp = new Date().toISOString();
    await fs.appendFile(activityPath, `${timestamp} - ${i}/${count}\n`, 'utf8');
    git(`add README.md ${file}`);
    git(`commit -m "🤖 Activity ${i}/${count} - ${timestamp}"`);
  }
}

/**
 * Main function
 * Usage: node src/index.js [--commit] [--force]
 *   --commit  roll the coin: 1 = random commits as the user, 0 = README date commit as the bot (used by CI)
 *   --force   skip the coin flip and always commit
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const shouldCommit = args.includes('--commit');
    const force = args.includes('--force');

    console.log('🚀 Generating README.md...');
    
    const readmeContent = generateReadme();
    await writeReadme(readmeContent);
    
    console.log(`✅ README updated with date: ${getTodayDate()}`);

    if (!shouldCommit) return;

    if (!force && coinFlip() === 0) {
      console.log('🎲 Coin flip = 0, README date committed as bot (no contribution).');
      commitReadmeAsBot();
    } else {
      const { minCommits, maxCommits } = CONFIG.activity;
      const count = randomInt(minCommits, maxCommits);
      console.log(`🎲 Coin flip = 1, creating ${count} commits...`);
      await createActivityCommits(count);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate README:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}